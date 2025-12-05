"""Metrics API 라우터"""
from fastapi import APIRouter, HTTPException, status
from app.models import PrometheusMetricsResponse
from app.config import settings
import httpx

router = APIRouter()


@router.get("/functions/{function_id}/metrics", response_model=PrometheusMetricsResponse)
async def get_function_metrics(function_id: str):
    """Prometheus에서 function_id로 Pod 메트릭 조회"""
    try:
        # Prometheus API 호출
        async with httpx.AsyncClient(timeout=30.0) as client:
            prometheus_url = f"{settings.prometheus_service_url}/api/v1/query"
            params = {
                "query": f'kube_pod_labels{{label_function_id="{function_id}"}}',
            }

            response = await client.get(prometheus_url, params=params)
            response.raise_for_status()
            data = response.json()

        return PrometheusMetricsResponse(
            status=data.get("status", "error"),
            data=data.get("data", {}),
            function_id=function_id,
        )

    except httpx.HTTPError as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={
                "error": {
                    "code": "PROMETHEUS_CONNECTION_ERROR",
                    "message": f"메트릭 시스템 연결 불가: {str(e)}",
                }
            },
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "error": {
                    "code": "PROMETHEUS_ERROR",
                    "message": f"메트릭 조회 실패: {str(e)}",
                }
            },
        )
