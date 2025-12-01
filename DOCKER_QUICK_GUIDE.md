# Docker 빠른 가이드

## 🐳 Docker 기본 명령어

### 컨테이너 관리
```bash
# 실행 중인 컨테이너 확인
docker ps

# 모든 컨테이너 확인 (중지된 것 포함)
docker ps -a

# 컨테이너 시작 (백그라운드)
docker-compose up -d

# 컨테이너 중지 및 삭제
docker-compose down

# 컨테이너 재시작
docker-compose restart

# 특정 서비스만 재시작
docker-compose restart backend
```

### 로그 확인
```bash
# 실시간 로그 확인
docker-compose logs -f backend

# 마지막 100줄 확인
docker-compose logs --tail=100 backend

# 모든 로그
docker-compose logs backend
```

### 이미지 관리
```bash
# 이미지 목록
docker images

# 이미지 재빌드
docker-compose build

# 빌드 + 시작
docker-compose up --build

# 캐시 없이 빌드
docker-compose build --no-cache
```

---

## 🖥️ 컨테이너 내부 터미널 접속

### 방법 1: bash 접속 (추천)
```bash
docker exec -it faas-backend bash
```

**실행 후**:
```bash
# 프롬프트가 변경됨:
root@e263e7de1d54:/app#

# 이제 컨테이너 안에 있습니다!
```

### 방법 2: sh 접속 (bash가 없는 경우)
```bash
docker exec -it faas-backend sh
```

### 컨테이너 안에서 할 수 있는 것

```bash
# 1. 백엔드 코드 확인
ls /app
cat /app/app/main.py

# 2. 참고 폴더 확인 (읽기 전용)
ls /reference/frontend
ls /reference/terraform
ls /reference/docs

# 3. Python 실행
python --version
python -c "import fastapi; print(fastapi.__version__)"

# 4. 환경 변수 확인
env | grep AWS
env | grep DYNAMODB
env | grep S3

# 5. 패키지 목록
pip list

# 6. 프로세스 확인
ps aux

# 7. 네트워크 테스트
curl http://localhost:8000/health
```

### 나가기
```bash
exit
# 또는
Ctrl+D
```

---

## 📂 Docker 디렉토리 매핑

컨테이너 안에서 다음과 같이 매핑되어 있습니다:

| Windows 경로 | 컨테이너 경로 | 권한 |
|-------------|--------------|------|
| `./backend/` | `/app` | 읽기/쓰기 |
| `./frontend/` | `/reference/frontend` | 읽기 전용 |
| `./terraform/` | `/reference/terraform` | 읽기 전용 |
| `./reference/` | `/reference/docs` | 읽기 전용 |

### 테스트:

```bash
# 1. 컨테이너 접속
docker exec -it faas-backend bash

# 2. 폴더 확인
ls -la /app                    # 백엔드 코드
ls -la /reference/frontend     # 프론트엔드 (읽기 전용)
ls -la /reference/terraform    # Terraform (읽기 전용)

# 3. 파일 읽기
cat /reference/frontend/API_Document.md

# 4. 나가기
exit
```

---

## 🔧 유용한 명령어

### API 테스트 (컨테이너 밖에서)
```bash
# 헬스 체크
curl http://localhost:8000/health

# API 문서
curl http://localhost:8000/docs
# 또는 브라우저: http://localhost:8000/docs

# 워크스페이스 목록
curl http://localhost:8000/api/workspaces
```

### 컨테이너 정보
```bash
# 컨테이너 상세 정보
docker inspect faas-backend

# 컨테이너 리소스 사용량
docker stats faas-backend

# 컨테이너 IP 확인
docker inspect faas-backend | grep IPAddress
```

### 파일 복사
```bash
# 컨테이너 → 호스트
docker cp faas-backend:/app/app/main.py ./main.py

# 호스트 → 컨테이너
docker cp ./test.py faas-backend:/app/test.py
```

---

## 🐛 문제 해결

### 컨테이너가 시작되지 않음
```bash
# 로그 확인
docker-compose logs backend

# 강제 재시작
docker-compose down
docker-compose up --build
```

### 포트 충돌 (8000 포트 사용 중)
```bash
# Windows에서 포트 사용 확인
netstat -ano | findstr :8000

# 프로세스 종료 (PID 확인 후)
taskkill /PID <PID> /F

# 또는 docker-compose.yml에서 포트 변경
ports:
  - "8080:8000"  # 8080으로 변경
```

### 코드 변경이 반영되지 않음
```bash
# Hot reload가 작동하는지 확인
docker-compose logs backend | grep "Reloading"

# 수동 재시작
docker-compose restart backend
```

### 컨테이너 완전 초기화
```bash
# 모든 컨테이너/이미지/볼륨 삭제 (주의!)
docker-compose down -v
docker system prune -a

# 재빌드
docker-compose up --build
```

---

## 📊 컨테이너 상태 확인

### 정상 상태:
```bash
$ docker ps
CONTAINER ID   IMAGE            COMMAND                  STATUS
e263e7de1d54   backend-image    "uvicorn app.main:..."   Up 5 minutes
```

### 이상 상태:
```bash
# Exited - 컨테이너가 종료됨
STATUS: Exited (1) 2 minutes ago

# Restarting - 계속 재시작 중
STATUS: Restarting (1) 10 seconds ago

→ docker-compose logs backend로 에러 확인
```

---

## 🚀 개발 워크플로우

### 1. 서버 시작
```bash
docker-compose up -d
```

### 2. 로그 확인
```bash
docker-compose logs -f backend
```

### 3. 코드 수정
- VSCode 등에서 `backend/` 폴더 수정
- 저장하면 자동 reload (Hot reload)

### 4. API 테스트
```bash
curl http://localhost:8000/docs
```

### 5. 컨테이너 내부 디버깅 (필요 시)
```bash
docker exec -it faas-backend bash
python -c "from app.database import db_client; print(db_client)"
```

### 6. 서버 중지
```bash
docker-compose down
```

---

## 💡 팁

1. **alias 설정** (bash/zsh):
   ```bash
   alias dps='docker ps'
   alias dlogs='docker-compose logs -f backend'
   alias dsh='docker exec -it faas-backend bash'
   ```

2. **VSCode 확장**:
   - Docker 확장: 컨테이너 관리
   - Remote - Containers: 컨테이너 안에서 VSCode 실행

3. **Hot Reload 확인**:
   - 코드 저장 후 로그에 "Reloading" 메시지 확인
   - 안 보이면 `docker-compose restart`

---

## 📚 추가 자료

- [Docker 공식 문서](https://docs.docker.com/)
- [Docker Compose 문서](https://docs.docker.com/compose/)
- [FastAPI + Docker 가이드](https://fastapi.tiangolo.com/deployment/docker/)
