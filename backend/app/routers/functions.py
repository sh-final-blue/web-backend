"""Function API 라우터"""
from fastapi import APIRouter, HTTPException, status
from app.models import FunctionCreate, FunctionUpdate, FunctionConfig
from app.database import db_client, s3_client
from typing import List
from datetime import datetime
import base64

router = APIRouter()


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
