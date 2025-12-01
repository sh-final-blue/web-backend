"""Logs API 라우터"""
from fastapi import APIRouter, HTTPException, status, Query
from app.models import LogsResponse, ExecutionLog
from app.database import db_client
from datetime import datetime

router = APIRouter()


@router.get(
    "/workspaces/{workspace_id}/functions/{function_id}/logs", response_model=LogsResponse
)
async def get_function_logs(
    workspace_id: str, function_id: str, limit: int = Query(default=100, le=1000, ge=1)
):
    """함수 실행 로그 조회"""
    # 함수 존재 확인
    function = db_client.get_function(workspace_id, function_id)
    if not function:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "error": {
                    "code": "NOT_FOUND",
                    "message": f"Function {function_id} not found",
                }
            },
        )

    try:
        items = db_client.list_logs(function_id, limit=limit)

        logs = [
            ExecutionLog(
                id=item["id"],
                functionId=item["functionId"],
                timestamp=datetime.fromisoformat(item["timestamp"]),
                status=item["status"],
                duration=item["duration"],
                statusCode=item["statusCode"],
                requestBody=item.get("requestBody"),
                responseBody=item.get("responseBody"),
                logs=item.get("logs", []),
                level=item.get("level", "info"),
            )
            for item in items
        ]

        return LogsResponse(logs=logs, total=len(logs))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"error": {"code": "LIST_ERROR", "message": str(e)}},
        )
