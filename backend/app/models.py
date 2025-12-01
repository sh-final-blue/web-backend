"""Pydantic 데이터 모델"""
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime


# ===== Workspace 모델 =====
class WorkspaceCreate(BaseModel):
    """워크스페이스 생성 요청"""

    name: str = Field(..., min_length=1, description="워크스페이스 이름")
    description: Optional[str] = Field(None, description="워크스페이스 설명")


class WorkspaceUpdate(BaseModel):
    """워크스페이스 수정 요청"""

    name: Optional[str] = Field(None, min_length=1, description="워크스페이스 이름")
    description: Optional[str] = Field(None, description="워크스페이스 설명")


class Workspace(BaseModel):
    """워크스페이스 응답"""

    id: str
    name: str
    description: Optional[str] = None
    createdAt: datetime
    functionCount: int = 0
    invocations24h: int = 0
    errorRate: float = 0.0


# ===== Function 모델 =====
class FunctionCreate(BaseModel):
    """함수 생성 요청"""

    name: str = Field(..., min_length=1, description="함수 이름")
    description: Optional[str] = Field(None, description="함수 설명")
    runtime: str = Field(default="Python 3.12", description="런타임")
    memory: int = Field(default=256, ge=128, le=1024, description="메모리 (MB)")
    timeout: int = Field(default=30, ge=1, le=900, description="타임아웃 (초)")
    httpMethods: List[str] = Field(
        default=["GET"], description="허용 HTTP 메서드"
    )
    environmentVariables: Dict[str, str] = Field(
        default_factory=dict, description="환경 변수"
    )
    code: str = Field(..., description="Base64 인코딩된 Python 코드")


class FunctionUpdate(BaseModel):
    """함수 수정 요청"""

    name: Optional[str] = Field(None, min_length=1)
    description: Optional[str] = None
    runtime: Optional[str] = None
    memory: Optional[int] = Field(None, ge=128, le=1024)
    timeout: Optional[int] = Field(None, ge=1, le=900)
    httpMethods: Optional[List[str]] = None
    environmentVariables: Optional[Dict[str, str]] = None
    code: Optional[str] = None
    status: Optional[str] = Field(None, pattern="^(active|disabled)$")


class FunctionConfig(BaseModel):
    """함수 설정 응답"""

    id: str
    workspaceId: str
    name: str
    description: Optional[str] = None
    runtime: str
    memory: int
    timeout: int
    httpMethods: List[str]
    environmentVariables: Dict[str, str]
    code: str
    invocationUrl: Optional[str] = None
    status: str = "active"
    lastModified: datetime
    lastDeployed: Optional[datetime] = None
    invocations24h: int = 0
    errors24h: int = 0
    avgDuration: float = 0.0


# ===== ExecutionLog 모델 =====
class ExecutionLog(BaseModel):
    """실행 로그"""

    id: str
    functionId: str
    timestamp: datetime
    status: str  # "success" | "error"
    duration: float  # ms
    statusCode: int
    requestBody: Optional[Any] = None
    responseBody: Optional[Any] = None
    logs: List[str] = Field(default_factory=list)
    level: str = "info"  # "info" | "warn" | "error"


class LogsResponse(BaseModel):
    """로그 조회 응답"""

    logs: List[ExecutionLog]
    total: int


# ===== 에러 응답 모델 =====
class ErrorDetail(BaseModel):
    """에러 상세"""

    field: Optional[str] = None


class ErrorResponse(BaseModel):
    """에러 응답"""

    error: Dict[str, Any]
