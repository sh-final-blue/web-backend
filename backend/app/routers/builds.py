"""빌드/배포 API 라우터"""
from fastapi import APIRouter, HTTPException, UploadFile, File, Form, BackgroundTasks
from typing import Optional
from app.models import (
    BuildResponse,
    TaskStatusResponse,
    BuildTaskResult,
    PushRequest,
    ScaffoldRequest,
    ScaffoldResponse,
    DeployRequest,
    DeployResponse,
    BuildAndPushRequest,
)
from app.database import db_client, s3_client
import logging

logger = logging.getLogger(__name__)

router = APIRouter()


# ===== Helper Functions =====
def _get_workspace_id_from_task(task_id: str) -> Optional[str]:
    """task_id로부터 workspace_id 조회"""
    task = db_client.get_build_task_by_id(task_id)
    if task:
        return task.get("workspace_id")
    return None


async def _mock_build_process(
    workspace_id: str, task_id: str, source_path: str, app_name: str
):
    """Mock 빌드 프로세스 (실제로는 인프라 서비스 호출)"""
    import asyncio

    try:
        # 상태를 running으로 변경
        db_client.update_build_task_status(workspace_id, task_id, "running")

        # Mock: 빌드 시뮬레이션 (3초 대기)
        await asyncio.sleep(3)

        # Mock: 성공 결과
        wasm_path = f"s3://sfbank-blue-functions-code-bucket/build-artifacts/{task_id}/{app_name}.wasm"
        image_url = None  # 빌드만 하는 경우 이미지 URL은 없음

        # 상태를 completed로 변경
        db_client.update_build_task_status(
            workspace_id, task_id, "completed", wasm_path=wasm_path, image_url=image_url
        )

        logger.info(f"Build task {task_id} completed successfully")

    except Exception as e:
        logger.error(f"Build task {task_id} failed: {str(e)}")
        db_client.update_build_task_status(
            workspace_id, task_id, "failed", error_message=str(e)
        )


async def _mock_push_process(
    workspace_id: str, task_id: str, registry_url: str, tag: str, app_dir: str
):
    """Mock ECR 푸시 프로세스"""
    import asyncio

    try:
        db_client.update_build_task_status(workspace_id, task_id, "running")

        # Mock: 푸시 시뮬레이션
        await asyncio.sleep(2)

        # Mock: 이미지 URL 생성
        image_url = f"{registry_url}/spin-apps:{tag}-{task_id[:8]}"

        db_client.update_build_task_status(
            workspace_id, task_id, "completed", image_url=image_url
        )

        logger.info(f"Push task {task_id} completed: {image_url}")

    except Exception as e:
        logger.error(f"Push task {task_id} failed: {str(e)}")
        db_client.update_build_task_status(
            workspace_id, task_id, "failed", error_message=str(e)
        )


# ===== POST /api/v1/build =====
@router.post("/v1/build", response_model=BuildResponse, status_code=202)
async def build(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(..., description=".py 파일 또는 .zip 아카이브"),
    app_name: Optional[str] = Form(None, description="애플리케이션 이름"),
    workspace_id: str = Form(default="ws-default", description="워크스페이스 ID"),
):
    """
    파일 업로드 및 빌드 시작

    - **file**: .py 파일 또는 .zip 아카이브 (필수)
    - **app_name**: 애플리케이션 이름 (선택, 미지정시 자동 생성)
    - **workspace_id**: 워크스페이스 ID (기본값: ws-default)
    """
    try:
        # 파일 확장자 검증
        if not file.filename:
            raise HTTPException(status_code=400, detail="파일명이 없습니다")

        if not (file.filename.endswith(".py") or file.filename.endswith(".zip")):
            raise HTTPException(
                status_code=400, detail="지원하지 않는 파일 형식입니다 (.py 또는 .zip만 가능)"
            )

        # 파일 읽기
        file_content = await file.read()

        # BuildTask 생성
        task = db_client.create_build_task(
            workspace_id=workspace_id, app_name=app_name, source_path=None
        )
        task_id = task["task_id"]
        final_app_name = task["app_name"]

        # S3에 소스 파일 저장
        s3_path = s3_client.save_build_source(
            workspace_id, task_id, file_content, file.filename
        )

        # Task에 source_path 업데이트
        db_client.update_build_task_status(workspace_id, task_id, "pending")

        # 백그라운드에서 빌드 프로세스 실행
        background_tasks.add_task(
            _mock_build_process, workspace_id, task_id, s3_path, final_app_name
        )

        return BuildResponse(
            task_id=task_id, status="pending", message="Build task created"
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Build endpoint error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


# ===== GET /api/v1/tasks/{task_id} =====
@router.get("/v1/tasks/{task_id}", response_model=TaskStatusResponse)
async def get_task_status(task_id: str):
    """
    작업 상태 조회

    - **task_id**: 작업 ID
    """
    try:
        # task_id로 작업 조회
        task = db_client.get_build_task_by_id(task_id)

        if not task:
            raise HTTPException(status_code=404, detail="Task not found: uuid=string")

        # 응답 구성
        result = None
        if task["status"] == "completed":
            result = BuildTaskResult(
                wasm_path=task.get("wasm_path"),
                image_url=task.get("image_url"),
                file_path=task.get("source_code_path"),
            )

        return TaskStatusResponse(
            task_id=task["task_id"],
            status=task["status"],
            result=result,
            error=task.get("error_message"),
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Get task status error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


# ===== POST /api/v1/push =====
@router.post("/v1/push", response_model=BuildResponse, status_code=202)
async def push_to_ecr(background_tasks: BackgroundTasks, request: PushRequest):
    """
    ECR에 이미지 푸시

    - **registry_url**: ECR 레지스트리 URL
    - **username**: 레지스트리 사용자명
    - **password**: 레지스트리 비밀번호
    - **tag**: 이미지 태그
    - **app_dir**: 애플리케이션 디렉토리 경로
    """
    try:
        # TODO: 실제 인프라 서비스 엔드포인트 호출로 교체
        # workspace_id는 app_dir에서 추출하거나 별도 파라미터로 받아야 함
        workspace_id = "ws-default"  # Mock

        # Task 생성
        task = db_client.create_build_task(workspace_id=workspace_id, app_name=None)
        task_id = task["task_id"]

        # 백그라운드에서 푸시 프로세스 실행
        background_tasks.add_task(
            _mock_push_process,
            workspace_id,
            task_id,
            request.registry_url,
            request.tag,
            request.app_dir,
        )

        return BuildResponse(
            task_id=task_id, status="pending", message="Push task created"
        )

    except Exception as e:
        logger.error(f"Push endpoint error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


# ===== POST /api/v1/scaffold =====
@router.post("/v1/scaffold", response_model=ScaffoldResponse)
async def scaffold_spinapp(request: ScaffoldRequest):
    """
    SpinApp 매니페스트 생성

    - **image_ref**: 이미지 참조 (ECR URL:tag)
    - **component**: 컴포넌트 이름 (선택)
    - **replicas**: 레플리카 수 (기본값: 1)
    - **output_path**: 출력 파일 경로 (선택)
    """
    try:
        # TODO: 실제 인프라 서비스 호출로 교체
        # Mock YAML 생성
        yaml_content = f"""apiVersion: core.spinoperator.dev/v1alpha1
kind: SpinApp
metadata:
  name: {request.component or 'my-spin-app'}
spec:
  image: {request.image_ref}
  replicas: {request.replicas}
"""

        # Mock 파일 경로
        file_path = request.output_path or "/tmp/spinapp.yaml"

        return ScaffoldResponse(
            success=True, yaml_content=yaml_content, file_path=file_path
        )

    except Exception as e:
        logger.error(f"Scaffold endpoint error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


# ===== POST /api/v1/deploy =====
@router.post("/v1/deploy", response_model=DeployResponse)
async def deploy_to_k8s(request: DeployRequest):
    """
    K8s에 SpinApp 배포

    - **namespace**: Kubernetes 네임스페이스 (필수)
    - **image_ref**: 이미지 참조 (필수)
    - **app_name**: 애플리케이션 이름 (선택, 기본값: Faker 자동 생성)
    - **replicas**: 레플리카 수 (기본값: 1)
    - **enable_autoscaling**: HPA/KEDA 활성화 (기본값: true)
    - **use_spot**: Spot 인스턴스 사용 (기본값: true)
    """
    try:
        # TODO: 실제 인프라 서비스 호출로 교체
        # Mock 응답
        app_name = request.app_name or "my-spin-app"
        service_name = f"{app_name}-service"
        endpoint = f"{app_name}.{request.namespace}.svc.cluster.local"

        return DeployResponse(
            app_name=app_name,
            namespace=request.namespace,
            service_name=service_name,
            service_status="found",
            endpoint=endpoint,
            enable_autoscaling=request.enable_autoscaling,
            use_spot=request.use_spot,
        )

    except Exception as e:
        logger.error(f"Deploy endpoint error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


# ===== POST /api/v1/build-and-push =====
@router.post("/v1/build-and-push", response_model=BuildResponse, status_code=202)
async def build_and_push(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    registry_url: str = Form(...),
    username: str = Form(...),
    password: str = Form(...),
    tag: str = Form(default="sha256"),
    app_name: Optional[str] = Form(None),
    workspace_id: str = Form(default="ws-default"),
):
    """
    빌드 및 푸시 통합

    - **file**: .py 파일 또는 .zip 아카이브 (필수)
    - **registry_url**: ECR 레지스트리 URL (필수)
    - **username**: 레지스트리 사용자명 (필수)
    - **password**: 레지스트리 비밀번호 (필수)
    - **tag**: 이미지 태그 (기본값: sha256)
    - **app_name**: 애플리케이션 이름 (선택)
    """
    try:
        # 파일 검증
        if not file.filename or not (
            file.filename.endswith(".py") or file.filename.endswith(".zip")
        ):
            raise HTTPException(
                status_code=400, detail="지원하지 않는 파일 형식입니다 (.py 또는 .zip만 가능)"
            )

        # 파일 읽기
        file_content = await file.read()

        # Task 생성
        task = db_client.create_build_task(workspace_id=workspace_id, app_name=app_name)
        task_id = task["task_id"]
        final_app_name = task["app_name"]

        # S3에 저장
        s3_path = s3_client.save_build_source(
            workspace_id, task_id, file_content, file.filename
        )

        # TODO: 실제로는 빌드 -> 푸시 순차 실행
        # Mock: 빌드만 실행 (푸시는 별도 호출 필요)
        background_tasks.add_task(
            _mock_build_process, workspace_id, task_id, s3_path, final_app_name
        )

        return BuildResponse(
            task_id=task_id, status="pending", message="Build and push task created"
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Build-and-push endpoint error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")
