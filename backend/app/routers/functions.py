"""Function API 라우터"""
from fastapi import APIRouter, HTTPException, status, Request
from app.models import FunctionCreate, FunctionUpdate, FunctionConfig
from app.database import db_client, s3_client
from typing import List, Any, Dict, Optional
from datetime import datetime
import base64
import httpx
import uuid
import time
import re
import logging
from urllib.parse import urlparse
logger = logging.getLogger(__name__)

router = APIRouter()


def normalize_invocation_url(url: str) -> str:
    """Ensure invocation URLs always include a scheme for httpx."""
    if not url:
        return ""

    normalized = url.strip()
    parsed = urlparse(normalized)
    if parsed.scheme:
        return normalized
    return f"http://{normalized}"


def build_fallback_host(function: Dict[str, Any], namespace: str = "default") -> Optional[str]:
    """Build a K8s Service DNS name from the function name for fallback lookups."""
    name = function.get("name")
    if not name:
        return None

    # K8s service DNS label rules: lower-case alphanumeric or '-', must start/end with alnum
    slug = re.sub(r"[^a-z0-9-]+", "-", name.strip().lower()).strip("-")
    if not slug:
        return None

    return f"{slug}.{namespace}.svc.cluster.local"


@router.post(
    "/workspaces/{workspace_id}/functions",
    response_model=FunctionConfig,
    status_code=status.HTTP_201_CREATED,
)
async def create_function(workspace_id: str, function: FunctionCreate):
    """함수 생성"""
    # 워크스페이스 존재 확인
    workspace = db_client.get_workspace(workspace_id)
    if not workspace:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "error": {
                    "code": "NOT_FOUND",
                    "message": f"Workspace {workspace_id} not found",
                }
            },
        )

    # Base64 검증
    try:
        base64.b64decode(function.code)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "error": {
                    "code": "VALIDATION_ERROR",
                    "message": "Invalid Base64 encoded code",
                    "details": {"field": "code"},
                }
            },
        )

    # HTTP 메서드 검증
    if not function.httpMethods:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "error": {
                    "code": "VALIDATION_ERROR",
                    "message": "At least one HTTP method is required",
                    "details": {"field": "httpMethods"},
                }
            },
        )

    try:
        # DynamoDB에 함수 생성
        item = db_client.create_function(
            workspace_id,
            {
                "name": function.name,
                "description": function.description,
                "runtime": function.runtime,
                "memory": function.memory,
                "timeout": function.timeout,
                "httpMethods": function.httpMethods,
                "environmentVariables": function.environmentVariables,
                "code": function.code,
            },
        )

        # S3에 코드 저장
        s3_client.save_code(workspace_id, item["id"], function.code)

        return FunctionConfig(
            id=item["id"],
            workspaceId=item["workspaceId"],
            name=item["name"],
            description=item.get("description", ""),
            runtime=item["runtime"],
            memory=item["memory"],
            timeout=item["timeout"],
            httpMethods=item["httpMethods"],
            environmentVariables=item["environmentVariables"],
            code=item["code"],
            invocationUrl=item.get("invocationUrl"),
            status=item["status"],
            lastModified=datetime.fromisoformat(item["lastModified"]),
            lastDeployed=None,
            invocations24h=item.get("invocations24h", 0),
            errors24h=item.get("errors24h", 0),
            avgDuration=item.get("avgDuration", 0.0),
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"error": {"code": "CREATE_ERROR", "message": str(e)}},
        )


@router.get("/workspaces/{workspace_id}/functions", response_model=List[FunctionConfig])
async def list_functions(workspace_id: str):
    """함수 목록 조회"""
    # 워크스페이스 존재 확인
    workspace = db_client.get_workspace(workspace_id)
    if not workspace:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "error": {
                    "code": "NOT_FOUND",
                    "message": f"Workspace {workspace_id} not found",
                }
            },
        )

    try:
        items = db_client.list_functions(workspace_id)

        return [
            FunctionConfig(
                id=item["id"],
                workspaceId=item["workspaceId"],
                name=item["name"],
                description=item.get("description", ""),
                runtime=item["runtime"],
                memory=item["memory"],
                timeout=item["timeout"],
                httpMethods=item["httpMethods"],
                environmentVariables=item["environmentVariables"],
                code=item["code"],
                invocationUrl=item.get("invocationUrl"),
                status=item["status"],
                lastModified=datetime.fromisoformat(item["lastModified"]),
                lastDeployed=(
                    datetime.fromisoformat(item["lastDeployed"])
                    if item.get("lastDeployed")
                    else None
                ),
                invocations24h=item.get("invocations24h", 0),
                errors24h=item.get("errors24h", 0),
                avgDuration=item.get("avgDuration", 0.0),
            )
            for item in items
        ]
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"error": {"code": "LIST_ERROR", "message": str(e)}},
        )


@router.get(
    "/workspaces/{workspace_id}/functions/{function_id}", response_model=FunctionConfig
)
async def get_function(workspace_id: str, function_id: str):
    """함수 상세 조회"""
    item = db_client.get_function(workspace_id, function_id)

    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "error": {
                    "code": "NOT_FOUND",
                    "message": f"Function {function_id} not found",
                }
            },
        )

    return FunctionConfig(
        id=item["id"],
        workspaceId=item["workspaceId"],
        name=item["name"],
        description=item.get("description", ""),
        runtime=item["runtime"],
        memory=item["memory"],
        timeout=item["timeout"],
        httpMethods=item["httpMethods"],
        environmentVariables=item["environmentVariables"],
        code=item["code"],
        invocationUrl=item.get("invocationUrl"),
        status=item["status"],
        lastModified=datetime.fromisoformat(item["lastModified"]),
        lastDeployed=(
            datetime.fromisoformat(item["lastDeployed"])
            if item.get("lastDeployed")
            else None
        ),
        invocations24h=item.get("invocations24h", 0),
        errors24h=item.get("errors24h", 0),
        avgDuration=item.get("avgDuration", 0.0),
    )


@router.patch(
    "/workspaces/{workspace_id}/functions/{function_id}", response_model=FunctionConfig
)
async def update_function(workspace_id: str, function_id: str, updates: FunctionUpdate):
    """함수 수정"""
    # 함수 존재 확인
    existing = db_client.get_function(workspace_id, function_id)
    if not existing:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "error": {
                    "code": "NOT_FOUND",
                    "message": f"Function {function_id} not found",
                }
            },
        )

    # 수정할 필드 준비
    update_data = {}
    if updates.name is not None:
        update_data["name"] = updates.name
    if updates.description is not None:
        update_data["description"] = updates.description
    if updates.runtime is not None:
        update_data["runtime"] = updates.runtime
    if updates.memory is not None:
        update_data["memory"] = updates.memory
    if updates.timeout is not None:
        update_data["timeout"] = updates.timeout
    if updates.httpMethods is not None:
        update_data["httpMethods"] = updates.httpMethods
    if updates.environmentVariables is not None:
        update_data["environmentVariables"] = updates.environmentVariables
    if updates.status is not None:
        update_data["status"] = updates.status
    if updates.invocationUrl is not None:
        normalized_url = normalize_invocation_url(updates.invocationUrl)
        update_data["invocationUrl"] = normalized_url or None
    if updates.code is not None:
        # Base64 검증
        try:
            base64.b64decode(updates.code)
            update_data["code"] = updates.code
            # S3에 코드 업데이트
            s3_client.save_code(workspace_id, function_id, updates.code)
        except Exception:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={
                    "error": {
                        "code": "VALIDATION_ERROR",
                        "message": "Invalid Base64 encoded code",
                        "details": {"field": "code"},
                    }
                },
            )

    # 수정
    item = db_client.update_function(workspace_id, function_id, update_data)

    return FunctionConfig(
        id=item["id"],
        workspaceId=item["workspaceId"],
        name=item["name"],
        description=item.get("description", ""),
        runtime=item["runtime"],
        memory=item["memory"],
        timeout=item["timeout"],
        httpMethods=item["httpMethods"],
        environmentVariables=item["environmentVariables"],
        code=item["code"],
        invocationUrl=item.get("invocationUrl"),
        status=item["status"],
        lastModified=datetime.fromisoformat(item["lastModified"]),
        lastDeployed=(
            datetime.fromisoformat(item["lastDeployed"])
            if item.get("lastDeployed")
            else None
        ),
        invocations24h=item.get("invocations24h", 0),
        errors24h=item.get("errors24h", 0),
        avgDuration=item.get("avgDuration", 0.0),
    )


@router.delete(
    "/workspaces/{workspace_id}/functions/{function_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_function(workspace_id: str, function_id: str):
    """함수 삭제"""
    # 함수 존재 확인
    existing = db_client.get_function(workspace_id, function_id)
    if not existing:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "error": {
                    "code": "NOT_FOUND",
                    "message": f"Function {function_id} not found",
                }
            },
        )

    # S3에서 코드 삭제
    try:
        s3_client.delete_code(workspace_id, function_id)
    except Exception:
        pass  # S3 파일이 없어도 계속 진행

    # DynamoDB에서 함수 삭제
    db_client.delete_function(workspace_id, function_id)

    return None


@router.post(
    "/workspaces/{workspace_id}/functions/{function_id}/invoke",
    status_code=status.HTTP_200_OK,
)
async def invoke_function(
    workspace_id: str, function_id: str, request: Request
):
    """함수 실행 (HTTP 호출)"""
    logger.info(f"Invoke request: workspace_id={workspace_id}, function_id={function_id}")

    # 함수 존재 확인
    function = db_client.get_function(workspace_id, function_id)
    if not function:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "error": {
                    "code": "NOT_FOUND",
                    "message": f"Function {function_id} not found {function}",
                }
            },
        )

    # invocationUrl 확인
    invocation_url = normalize_invocation_url(function.get("invocationUrl"))
    if not invocation_url:
        fallback_host = build_fallback_host(function)
        if fallback_host:
            invocation_url = f"http://{fallback_host}"
            logger.info(
                "Function %s missing invocationUrl. Using fallback host %s",
                function_id,
                invocation_url,
            )
    if not invocation_url:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "error": {
                    "code": "NOT_DEPLOYED",
                    "message": f"Function {function_id} is not deployed (missing invocationUrl). Please deploy the function first. {function}",
                }
            },
        )

    # 요청 body 읽기
    try:
        request_body = await request.json()
    except Exception:
        request_body = {}

    # 실행 시작 시간
    start_time = time.time()
    timeout_seconds = float(function.get("timeout", 30) or 30)

    try:
        # 실제 Function 엔드포인트 호출
        async with httpx.AsyncClient(timeout=httpx.Timeout(timeout_seconds)) as client:
            response = await client.post(
                invocation_url,
                json=request_body,
                headers={"Content-Type": "application/json"},
            )

            # 실행 시간 계산
            duration = int((time.time() - start_time) * 1000)  # ms

            # 응답 body
            try:
                response_body = response.json()
            except Exception:
                response_body = {"data": response.text}

            # 로그 생성 (DynamoDB에 저장)
            log_id = str(uuid.uuid4())
            log_entry = {
                "id": log_id,
                "functionId": function_id,
                "timestamp": datetime.utcnow().isoformat(),
                "status": "success" if response.is_success else "error",
                "duration": duration,
                "statusCode": response.status_code,
                "requestBody": request_body,
                "responseBody": response_body,
                "logs": [],  # 실제 로그는 Loki에서 수집
                "level": "info" if response.is_success else "error",
            }

            # DynamoDB에 로그 저장
            try:
                db_client.create_log(log_entry)
            except Exception as e:
                logger.error(f"Failed to save log: {e}")

            # Persist fallback invocation URL if we had to derive it and it worked
            if not function.get("invocationUrl") and invocation_url:
                try:
                    db_client.update_function(
                        workspace_id,
                        function_id,
                        {"invocationUrl": invocation_url},
                    )
                except Exception as e:
                    logger.warning(
                        "Failed to persist fallback invocationUrl for %s: %s",
                        function_id,
                        e,
                    )

            # 응답 반환
            return {
                "id": log_id,
                "functionId": function_id,
                "timestamp": log_entry["timestamp"],
                "status": log_entry["status"],
                "duration": duration,
                "statusCode": response.status_code,
                "requestBody": request_body,
                "responseBody": response_body,
                "logs": [],
                "level": log_entry["level"],
            }

    except httpx.TimeoutException:
        duration = int((time.time() - start_time) * 1000)
        raise HTTPException(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            detail={
                "error": {
                    "code": "TIMEOUT",
                    "message": f"Function execution timed out after {timeout_seconds}s",
                }
            },
        )
    except httpx.HTTPError as e:
        duration = int((time.time() - start_time) * 1000)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={
                "error": {
                    "code": "INVOCATION_ERROR",
                    "message": f"Failed to invoke function: {str(e)}",
                }
            },
        )
    except Exception as e:
        logger.error(f"Unexpected error invoking function {function_id}: {e}", exc_info=True)
        duration = int((time.time() - start_time) * 1000)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"error": {"code": "EXECUTION_ERROR", "message": str(e)}},
        )
