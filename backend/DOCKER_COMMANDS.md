# Docker Compose 자주 쓰는 명령어

## 1️⃣ 기본 명령어 (당신이 알고 있는 것)

### 컨테이너 시작
```bash
docker-compose up -d
```
- `-d`: 백그라운드에서 실행 (detached mode)
- 컨테이너가 이미 있으면 시작만 함

### 컨테이너 내부 터미널 접속
```bash
docker exec -it faas-backend bash
```
- 컨테이너 안에서 명령어 실행 가능
- `exit` 입력하면 나옴

---

## 2️⃣ 추가로 알면 좋은 명령어

### 컨테이너 중지
```bash
docker-compose stop
```
- 컨테이너를 중지 (삭제는 안 함)

### 컨테이너 중지 + 삭제
```bash
docker-compose down
```
- 컨테이너를 완전히 삭제
- 다시 `up`하면 새로 만들어짐

### 컨테이너 재시작
```bash
docker-compose restart
```
- 컨테이너를 빠르게 재시작

### 로그 확인
```bash
docker-compose logs -f backend
```
- `-f`: 실시간으로 로그 스트리밍
- `Ctrl+C`로 중단

### 컨테이너 상태 확인
```bash
docker-compose ps
```
- 실행 중인 컨테이너 목록

---

## 3️⃣ 빌드 관련 명령어

### 재빌드 (캐시 사용)
```bash
docker-compose build
```
- Dockerfile 수정 후 사용

### 재빌드 (캐시 무시)
```bash
docker-compose build --no-cache
```
- 완전히 새로 빌드

### 빌드 + 시작
```bash
docker-compose up --build -d
```
- 재빌드하고 바로 시작

---

## 4️⃣ 실전 시나리오

### 시나리오 1: 처음 시작
```bash
cd "C:\Users\bluew\Desktop\codehome\2025softbank-hackathon-final"
docker-compose up -d
docker exec -it faas-backend bash
```

### 시나리오 2: 코드 수정 후 재시작
```bash
# 방법 1: 컨테이너 재시작 (빠름)
docker-compose restart

# 방법 2: 재빌드 (Dockerfile 수정 시)
docker-compose down
docker-compose up --build -d
```

### 시나리오 3: 컨테이너 안에서 명령어 실행
```bash
# 터미널 접속
docker exec -it faas-backend bash

# 컨테이너 안에서:
python --version
pip list
gemini --version
curl http://localhost:8000/health
```

### 시나리오 4: 로그 확인
```bash
# 전체 로그
docker-compose logs backend

# 실시간 로그
docker-compose logs -f backend

# 마지막 100줄
docker-compose logs --tail=100 backend
```

### 시나리오 5: 문제 해결
```bash
# 1. 컨테이너 상태 확인
docker-compose ps

# 2. 로그 확인
docker-compose logs backend

# 3. 완전 재시작
docker-compose down
docker system prune -f
docker-compose up --build -d
```

---

## 5️⃣ 한눈에 보는 명령어 요약

| 명령어 | 설명 |
|--------|------|
| `docker-compose up -d` | 시작 (백그라운드) |
| `docker-compose stop` | 중지 |
| `docker-compose down` | 중지 + 삭제 |
| `docker-compose restart` | 재시작 |
| `docker-compose logs -f backend` | 로그 보기 |
| `docker-compose ps` | 상태 확인 |
| `docker-compose build` | 재빌드 |
| `docker exec -it faas-backend bash` | 터미널 접속 |

---

## 6️⃣ 자주 하는 실수

### ❌ 실수 1: up 없이 exec
```bash
docker exec -it faas-backend bash  # 에러!
```
✅ **해결**: 먼저 `docker-compose up -d` 실행

### ❌ 실수 2: 코드 수정 후 재빌드 안 함
```bash
# Python 코드만 수정 → 재시작 불필요 (hot-reload)
# Dockerfile 또는 requirements.txt 수정 → 재빌드 필요!
docker-compose up --build -d
```

### ❌ 실수 3: 로그 안 보고 디버깅
```bash
# 뭔가 안 되면 항상 로그부터 확인!
docker-compose logs -f backend
```

---

## 7️⃣ 당신의 워크플로우

```bash
# 1. 매일 아침 시작
cd "C:\Users\bluew\Desktop\codehome\2025softbank-hackathon-final"
docker-compose up -d

# 2. 개발 중
# - Python 코드 수정 → 자동 반영 (hot-reload)
# - 문제 발생 → docker-compose logs -f backend

# 3. Dockerfile 수정 시
docker-compose down
docker-compose up --build -d

# 4. 컨테이너 안에서 작업
docker exec -it faas-backend bash
# → gemini, python, vim 등 사용 가능

# 5. 퇴근 전
docker-compose stop  # 또는 그냥 켜놔도 됨
```
