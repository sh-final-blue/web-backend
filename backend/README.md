# FaaS Backend API

Function as a Service (FaaS) 플랫폼의 백엔드 API 서버입니다.

## 기술 스택

- **FastAPI**: Python 웹 프레임워크
- **DynamoDB**: NoSQL 데이터베이스 (단일 테이블 설계)
- **S3**: 함수 코드 저장소
- **Docker**: 컨테이너화
- **Uvicorn**: ASGI 서버

## 프로젝트 구조

```
backend/
├── app/
│   ├── __init__.py
│   ├── main.py              # FastAPI 앱 진입점
│   ├── config.py            # 환경 변수 설정
│   ├── models.py            # Pydantic 모델
│   ├── database.py          # DynamoDB/S3 클라이언트
│   └── routers/
│       ├── __init__.py
│       ├── workspaces.py    # Workspace API
│       ├── functions.py     # Function API
│       └── logs.py          # Logs API
├── Dockerfile
├── requirements.txt
├── .env.example
└── README.md
```

## 로컬 개발 환경 설정

### 1. Docker Compose로 실행 (추천)

**루트 디렉토리**에서 실행:

```bash
# 프로젝트 루트로 이동
cd C:\Users\bluew\Desktop\codehome\2025softbank-hackathon-final

# Docker Compose 실행
docker-compose up --build
```

서버가 실행되면 다음 URL에서 접속 가능합니다:
- **API 서버**: http://localhost:8000
- **API 문서 (Swagger)**: http://localhost:8000/docs
- **API 문서 (ReDoc)**: http://localhost:8000/redoc

### 2. AWS 자격 증명 (로컬 개발 시)

로컬에서 개발할 때는 **AWS credentials**가 필요합니다.

**간단한 방법**:
```bash
# backend/.env 파일 생성
cd backend
cp .env.example .env

# .env 파일 수정 (실제 키 입력)
AWS_ACCESS_KEY_ID=실제_액세스_키
AWS_SECRET_ACCESS_KEY=실제_시크릿_키
```

자세한 가이드: [AWS_CREDENTIALS_GUIDE.md](AWS_CREDENTIALS_GUIDE.md)

## API 엔드포인트

### Workspace 관리

- `POST /api/workspaces` - 워크스페이스 생성
- `GET /api/workspaces` - 워크스페이스 목록 조회
- `GET /api/workspaces/{id}` - 워크스페이스 상세 조회
- `PATCH /api/workspaces/{id}` - 워크스페이스 수정
- `DELETE /api/workspaces/{id}` - 워크스페이스 삭제

### Function 관리

- `POST /api/workspaces/{ws_id}/functions` - 함수 생성
- `GET /api/workspaces/{ws_id}/functions` - 함수 목록 조회
- `GET /api/workspaces/{ws_id}/functions/{fn_id}` - 함수 상세 조회
- `PATCH /api/workspaces/{ws_id}/functions/{fn_id}` - 함수 수정
- `DELETE /api/workspaces/{ws_id}/functions/{fn_id}` - 함수 삭제

### Logs 조회

- `GET /api/workspaces/{ws_id}/functions/{fn_id}/logs` - 함수 실행 로그 조회

자세한 API 스펙은 [frontend/API_Document.md](../frontend/API_Document.md)를 참조하세요.

## AWS 리소스 설정

### DynamoDB 테이블

- **테이블 이름**: `sfbank-blue-FaaSData`
- **PK**: String
- **SK**: String

가이드: [DYNAMODB_SETUP_GUIDE.md](DYNAMODB_SETUP_GUIDE.md)

### S3 버킷

- **버킷 이름**: `sfbank-blue-functions-code-bucket`
- **리전**: `ap-northeast-2`

가이드: [S3_SETUP_GUIDE.md](S3_SETUP_GUIDE.md)

## ECR에 배포하기

### 1. 이미지 빌드

```bash
# backend 디렉토리에서
docker build -t faas-backend:latest .
```

### 2. ECR 로그인

```bash
aws ecr get-login-password --region ap-northeast-2 | \
  docker login --username AWS --password-stdin {AWS_ACCOUNT_ID}.dkr.ecr.ap-northeast-2.amazonaws.com
```

### 3. ECR 리포지토리 생성 (최초 1회)

```bash
aws ecr create-repository \
  --repository-name faas-backend \
  --region ap-northeast-2
```

### 4. 이미지 태그 및 푸시

```bash
# 태그
docker tag faas-backend:latest \
  {AWS_ACCOUNT_ID}.dkr.ecr.ap-northeast-2.amazonaws.com/faas-backend:latest

# 푸시
docker push {AWS_ACCOUNT_ID}.dkr.ecr.ap-northeast-2.amazonaws.com/faas-backend:latest
```

### 5. K3s에서 사용

인프라 엔지니어가 K3s에서 이 이미지를 pull하여 배포합니다.

## 개발 팁

### Hot Reload

Docker Compose로 실행 시 백엔드 코드 변경이 자동으로 반영됩니다.

### API 테스트

Swagger UI를 사용하여 API를 테스트할 수 있습니다:
http://localhost:8000/docs

### 로그 확인

```bash
# Docker Compose 로그
docker-compose logs -f backend

# 특정 컨테이너 로그
docker logs -f faas-backend
```

## 문제 해결

### AWS Credentials 오류

```
botocore.exceptions.NoCredentialsError: Unable to locate credentials
```

해결: `.env` 파일에 AWS 자격 증명을 올바르게 설정했는지 확인하세요.

### DynamoDB 테이블 없음

```
botocore.errorfactory.ResourceNotFoundException: Requested resource not found
```

해결: AWS 콘솔에서 `sfbank-blue-FaaSData` 테이블을 생성하세요.

### S3 버킷 없음

```
botocore.errorfactory.NoSuchBucket: The specified bucket does not exist
```

해결: AWS 콘솔에서 S3 버킷을 생성하세요.

## 참고 문서

- [FastAPI 공식 문서](https://fastapi.tiangolo.com/)
- [Boto3 문서](https://boto3.amazonaws.com/v1/documentation/api/latest/index.html)
- [API 설계 문서](../frontend/API_Document.md)
- [Docker 명령어 가이드](../DOCKER_QUICK_GUIDE.md)
- [AWS Credentials 가이드](AWS_CREDENTIALS_GUIDE.md)

## 라이선스

Softbank Hackathon 2025 - Final Project
