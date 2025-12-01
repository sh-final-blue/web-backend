# 남은 작업 정리

## ✅ 완료된 작업

### 1. 백엔드 개발 환경 구축
- [x] FastAPI 프로젝트 구조 생성
- [x] Docker + Docker Compose 설정
- [x] AWS DynamoDB 및 S3 클라이언트 구현
- [x] 모든 API 엔드포인트 구현 (Workspace, Function, Logs)
- [x] .env 파일 생성 및 AWS 자격증명 설정
- [x] 백엔드 컨테이너 빌드 및 실행 성공
- [x] Health check 엔드포인트 테스트 완료

### 2. 문서화
- [x] README.md (전체 프로젝트 가이드)
- [x] DOCKER_COMMANDS.md (Docker 명령어 모음)
- [x] DOCKER_COMPOSE_EXPLAINED.md (Docker Compose 설명)
- [x] AWS_CREDENTIALS_SIMPLE.md (AWS 자격증명 가이드)
- [x] DYNAMODB_SETUP_GUIDE.md (DynamoDB 테이블 생성 가이드)
- [x] S3_SETUP_GUIDE.md (S3 버킷 생성 가이드)
- [x] GEMINI_CLI_USAGE.md (Gemini CLI 사용 가이드)
- [x] ecr-upload.sh / ecr-upload.bat (ECR 업로드 스크립트)

---

## 🔧 현재 상태

### 백엔드 API 상태
```bash
# 컨테이너 실행 중
docker ps
# faas-backend 컨테이너가 port 8000에서 실행 중

# Health Check 성공
curl http://localhost:8000/health
# {"status":"healthy"}
```

### 구현된 API 엔드포인트
- `GET /health` - 상태 확인
- `POST /api/workspaces` - 워크스페이스 생성
- `GET /api/workspaces` - 워크스페이스 목록
- `GET /api/workspaces/{id}` - 워크스페이스 조회
- `PATCH /api/workspaces/{id}` - 워크스페이스 수정
- `DELETE /api/workspaces/{id}` - 워크스페이스 삭제
- `POST /api/workspaces/{workspace_id}/functions` - 함수 생성
- `GET /api/workspaces/{workspace_id}/functions` - 함수 목록
- `GET /api/functions/{id}` - 함수 조회
- `PATCH /api/functions/{id}` - 함수 수정
- `DELETE /api/functions/{id}` - 함수 삭제
- `GET /api/functions/{id}/logs` - 실행 로그 조회

---

## 🚧 남은 작업 (우선순위 순)

### 1. API 엔드포인트 테스트 ⭐⭐⭐ (가장 중요)

```bash
# 1. 워크스페이스 생성 테스트
curl -X POST http://localhost:8000/api/workspaces \
  -H "Content-Type: application/json" \
  -d '{"name":"test-workspace","description":"테스트"}'

# 2. 워크스페이스 목록 조회
curl http://localhost:8000/api/workspaces

# 3. 함수 생성 테스트
curl -X POST http://localhost:8000/api/workspaces/{workspace_id}/functions \
  -H "Content-Type: application/json" \
  -d '{
    "name":"hello",
    "runtime":"python3.12",
    "code":"ZGVmIGhhbmRsZXIoZXZlbnQsIGNvbnRleHQpOgogICAgcmV0dXJuICJIZWxsbyI=",
    "env_vars":{}
  }'
```
**현재 상태**: AWS 연결 테스트 완료 ✅ (DynamoDB ✅, S3 ✅)
**담당**: 당신
**필요 작업**: 실제 API 엔드포인트 테스트

### 2. ECR 이미지 업로드 ⭐

```bash
# ecr-upload.bat 실행 (Windows)
cd backend
ecr-upload.bat

# 또는 ecr-upload.sh 실행 (Linux/Mac)
./ecr-upload.sh
```
**현재 상태**: 미업로드
**담당**: 당신
**필요 이유**: 인프라 엔지니어가 K3s에 배포하기 위해 필요

### 3. Gemini CLI 재빌드 (선택사항) ⭐

**문제**: `NoSuchKey` 에러 (바이너리 URL 문제)
**해결**: Dockerfile 수정 완료 (공식 설치 스크립트 사용)
**필요 작업**: `docker-compose up --build -d` 재빌드

**우선순위**: 낮음 (선택사항, API 개발에 필수는 아님)

### 4. 프론트엔드 연동 테스트 ⭐

**현재 상태**: 미연동
**담당**: 당신 + 프론트엔드 개발자
**필요 작업**:
- 프론트엔드에서 `http://localhost:8000/api/` 호출 테스트
- CORS 설정 확인 (현재: localhost:3000, localhost:5173 허용)

---

## 📝 작업 순서 추천

```bash
# 1단계: API 테스트 (30분)
1. Workspace CRUD 테스트
2. Function CRUD 테스트
3. Logs 조회 테스트
4. 에러 케이스 테스트

# 2단계: ECR 업로드 (10분)
1. ecr-upload.bat 실행
2. 이미지 URL을 인프라 엔지니어에게 전달

# 3단계: K3s 배포 (인프라 엔지니어 담당)
1. ECR 이미지를 K3s에 배포
2. 환경 변수 설정 (IAM Role 사용)
3. 서비스 엔드포인트 확인

# 4단계: 프론트엔드 연동
1. 프론트엔드에서 API 호출 테스트
2. 통합 테스트
```

---

## 🎯 다음 단계 (지금 바로 할 것)

### 1. API 엔드포인트 테스트
```bash
# Postman 또는 curl로 테스트
# DYNAMODB_SETUP_GUIDE.md 참고
```

---

## ⚠️ 주의사항

### 1. AWS 자격증명 보안
- `.env` 파일은 절대 Git에 커밋하지 마세요
- `.gitignore`에 이미 추가되어 있음

### 2. 로컬 vs K3s 환경
- **로컬**: `.env` 파일의 AWS Access Key 사용
- **K3s**: IAM Role 사용 (인프라 엔지니어가 설정)

### 3. Hot Reload
- Python 코드 수정 시 자동 반영됨 (재시작 불필요)
- Dockerfile 수정 시 `docker-compose up --build -d` 필요

---

## 🔗 관련 문서

- [README.md](./README.md) - 전체 가이드
- [DOCKER_COMMANDS.md](./DOCKER_COMMANDS.md) - Docker 명령어
- [AWS_CREDENTIALS_SIMPLE.md](./AWS_CREDENTIALS_SIMPLE.md) - AWS 자격증명
- [DYNAMODB_SETUP_GUIDE.md](./DYNAMODB_SETUP_GUIDE.md) - DynamoDB 설정
- [S3_SETUP_GUIDE.md](./S3_SETUP_GUIDE.md) - S3 설정
