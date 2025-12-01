"""AWS DynamoDB 및 S3 클라이언트"""
import boto3
from boto3.dynamodb.conditions import Key
from app.config import settings
from typing import Optional, Dict, Any, List
from decimal import Decimal
import base64
import shortuuid
from datetime import datetime


class DynamoDBClient:
    """DynamoDB 클라이언트"""

    def __init__(self):
        # boto3가 자동으로 credentials를 찾음:
        # 1. 환경 변수 (AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY)
        # 2. EC2 IAM Role (배포 환경)
        self.dynamodb = boto3.resource("dynamodb", region_name=settings.aws_region)
        self.table = self.dynamodb.Table(settings.dynamodb_table_name)

    # ===== Workspace 메서드 =====
    def create_workspace(self, name: str, description: Optional[str] = None) -> Dict[str, Any]:
        """워크스페이스 생성"""
        workspace_id = f"ws-{shortuuid.uuid()[:8]}"
        now = datetime.utcnow().isoformat()

        item = {
            "PK": f"WS#{workspace_id}",
            "SK": "METADATA",
            "id": workspace_id,
            "name": name,
            "description": description or "",
            "createdAt": now,
            "functionCount": 0,
            "invocations24h": 0,
            "errorRate": Decimal("0"),
        }

        self.table.put_item(Item=item)
        return item

    def get_workspace(self, workspace_id: str) -> Optional[Dict[str, Any]]:
        """워크스페이스 조회"""
        response = self.table.get_item(
            Key={"PK": f"WS#{workspace_id}", "SK": "METADATA"}
        )
        return response.get("Item")

    def list_workspaces(self) -> List[Dict[str, Any]]:
        """워크스페이스 목록 조회"""
        # 모든 워크스페이스 스캔 (실제 프로덕션에서는 GSI 사용 권장)
        response = self.table.scan(
            FilterExpression="begins_with(PK, :pk) AND SK = :sk",
            ExpressionAttributeValues={":pk": "WS#", ":sk": "METADATA"},
        )
        return response.get("Items", [])

    def update_workspace(
        self, workspace_id: str, name: Optional[str] = None, description: Optional[str] = None
    ) -> Optional[Dict[str, Any]]:
        """워크스페이스 수정"""
        update_expr = []
        expr_values = {}

        if name is not None:
            update_expr.append("name = :name")
            expr_values[":name"] = name

        if description is not None:
            update_expr.append("description = :desc")
            expr_values[":desc"] = description

        if not update_expr:
            return self.get_workspace(workspace_id)

        response = self.table.update_item(
            Key={"PK": f"WS#{workspace_id}", "SK": "METADATA"},
            UpdateExpression="SET " + ", ".join(update_expr),
            ExpressionAttributeValues=expr_values,
            ReturnValues="ALL_NEW",
        )
        return response.get("Attributes")

    def delete_workspace(self, workspace_id: str):
        """워크스페이스 삭제 (함수도 함께 삭제)"""
        # 워크스페이스의 모든 함수 조회
        functions = self.list_functions(workspace_id)

        # 모든 함수 삭제
        for func in functions:
            self.delete_function(workspace_id, func["id"])

        # 워크스페이스 메타데이터 삭제
        self.table.delete_item(Key={"PK": f"WS#{workspace_id}", "SK": "METADATA"})

    # ===== Function 메서드 =====
    def create_function(
        self, workspace_id: str, function_data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """함수 생성"""
        function_id = f"fn-{shortuuid.uuid()[:8]}"
        now = datetime.utcnow().isoformat()

        item = {
            "PK": f"WS#{workspace_id}",
            "SK": f"FN#{function_id}",
            "id": function_id,
            "workspaceId": workspace_id,
            "name": function_data["name"],
            "description": function_data.get("description", ""),
            "runtime": function_data.get("runtime", "Python 3.12"),
            "memory": function_data.get("memory", 256),
            "timeout": function_data.get("timeout", 30),
            "httpMethods": function_data.get("httpMethods", ["GET"]),
            "environmentVariables": function_data.get("environmentVariables", {}),
            "code": function_data["code"],  # Base64 인코딩된 코드
            "invocationUrl": None,  # MVP에서는 null
            "status": "active",
            "lastModified": now,
            "lastDeployed": None,
            "invocations24h": 0,
            "errors24h": 0,
            "avgDuration": Decimal("0"),
        }

        self.table.put_item(Item=item)

        # 워크스페이스의 functionCount 증가
        self.table.update_item(
            Key={"PK": f"WS#{workspace_id}", "SK": "METADATA"},
            UpdateExpression="SET functionCount = functionCount + :inc",
            ExpressionAttributeValues={":inc": 1},
        )

        return item

    def get_function(self, workspace_id: str, function_id: str) -> Optional[Dict[str, Any]]:
        """함수 조회"""
        response = self.table.get_item(
            Key={"PK": f"WS#{workspace_id}", "SK": f"FN#{function_id}"}
        )
        return response.get("Item")

    def list_functions(self, workspace_id: str) -> List[Dict[str, Any]]:
        """함수 목록 조회"""
        response = self.table.query(
            KeyConditionExpression=Key("PK").eq(f"WS#{workspace_id}")
            & Key("SK").begins_with("FN#")
        )
        return response.get("Items", [])

    def update_function(
        self, workspace_id: str, function_id: str, updates: Dict[str, Any]
    ) -> Optional[Dict[str, Any]]:
        """함수 수정"""
        update_expr = ["lastModified = :now"]
        expr_values = {":now": datetime.utcnow().isoformat()}

        for key, value in updates.items():
            if value is not None:
                update_expr.append(f"{key} = :{key}")
                expr_values[f":{key}"] = value

        response = self.table.update_item(
            Key={"PK": f"WS#{workspace_id}", "SK": f"FN#{function_id}"},
            UpdateExpression="SET " + ", ".join(update_expr),
            ExpressionAttributeValues=expr_values,
            ReturnValues="ALL_NEW",
        )
        return response.get("Attributes")

    def delete_function(self, workspace_id: str, function_id: str):
        """함수 삭제"""
        # 함수 로그 삭제
        logs = self.list_logs(function_id)
        for log in logs:
            self.table.delete_item(
                Key={"PK": f"FN#{function_id}", "SK": f"LOG#{log['timestamp']}#{log['id']}"}
            )

        # 함수 삭제
        self.table.delete_item(Key={"PK": f"WS#{workspace_id}", "SK": f"FN#{function_id}"})

        # 워크스페이스의 functionCount 감소
        self.table.update_item(
            Key={"PK": f"WS#{workspace_id}", "SK": "METADATA"},
            UpdateExpression="SET functionCount = functionCount - :dec",
            ExpressionAttributeValues={":dec": 1},
        )

    # ===== ExecutionLog 메서드 =====
    def create_log(self, log_data: Dict[str, Any]) -> Dict[str, Any]:
        """실행 로그 생성"""
        log_id = shortuuid.uuid()[:8]
        timestamp = log_data.get("timestamp", datetime.utcnow().isoformat())

        item = {
            "PK": f"FN#{log_data['functionId']}",
            "SK": f"LOG#{timestamp}#{log_id}",
            "id": log_id,
            "functionId": log_data["functionId"],
            "timestamp": timestamp,
            "status": log_data["status"],
            "duration": log_data["duration"],
            "statusCode": log_data["statusCode"],
            "requestBody": log_data.get("requestBody"),
            "responseBody": log_data.get("responseBody"),
            "logs": log_data.get("logs", []),
            "level": log_data.get("level", "info"),
        }

        self.table.put_item(Item=item)
        return item

    def list_logs(self, function_id: str, limit: int = 100) -> List[Dict[str, Any]]:
        """함수 실행 로그 조회"""
        response = self.table.query(
            KeyConditionExpression=Key("PK").eq(f"FN#{function_id}")
            & Key("SK").begins_with("LOG#"),
            Limit=limit,
            ScanIndexForward=False,  # 최신순 정렬
        )
        return response.get("Items", [])


class S3Client:
    """S3 클라이언트"""

    def __init__(self):
        self.s3 = boto3.client("s3", region_name=settings.aws_region)
        self.bucket_name = settings.s3_bucket_name

    def save_code(self, workspace_id: str, function_id: str, code_base64: str) -> str:
        """함수 코드 S3에 저장"""
        # Base64 디코딩
        decoded_code = base64.b64decode(code_base64).decode("utf-8")

        # S3 키: {workspace_id}/{function_id}.py
        s3_key = f"{workspace_id}/{function_id}.py"

        self.s3.put_object(
            Bucket=self.bucket_name, Key=s3_key, Body=decoded_code, ContentType="text/plain"
        )

        return s3_key

    def get_code(self, workspace_id: str, function_id: str) -> str:
        """S3에서 함수 코드 조회 (Base64 인코딩)"""
        s3_key = f"{workspace_id}/{function_id}.py"

        response = self.s3.get_object(Bucket=self.bucket_name, Key=s3_key)
        code = response["Body"].read().decode("utf-8")

        # Base64 인코딩하여 반환
        return base64.b64encode(code.encode("utf-8")).decode("utf-8")

    def delete_code(self, workspace_id: str, function_id: str):
        """S3에서 함수 코드 삭제"""
        s3_key = f"{workspace_id}/{function_id}.py"
        self.s3.delete_object(Bucket=self.bucket_name, Key=s3_key)


# 전역 클라이언트 인스턴스
db_client = DynamoDBClient()
s3_client = S3Client()
