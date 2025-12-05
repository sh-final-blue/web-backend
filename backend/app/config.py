"""애플리케이션 설정"""
from pydantic_settings import BaseSettings
from typing import List


class Settings(BaseSettings):
    """환경 변수 설정"""

    # AWS 설정
    aws_region: str = "ap-northeast-2"
    aws_access_key_id: str = ""
    aws_secret_access_key: str = ""

    # DynamoDB
    dynamodb_table_name: str = "sfbank-blue-FaaSData"

    # S3
    s3_bucket_name: str = "sfbank-blue-functions-code-bucket"

    # FastAPI
    environment: str = "development"
    log_level: str = "INFO"

    # CORS
    cors_origins: List[str] = [
        "http://localhost:3000",
        "http://localhost:5173",
        "https://eunha.icu",
        "http://eunha.icu",
    ]

    # Builder Service (Core Services)
    builder_service_url: str = "https://builder.eunha.icu"

    class Config:
        env_file = ".env"
        case_sensitive = False


# 전역 설정 인스턴스
settings = Settings()
