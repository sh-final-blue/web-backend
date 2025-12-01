# AWS Credentials 설정 가이드

## 로컬 개발 vs K3s 배포

| 환경 | AWS 인증 방식 | 설정 파일 |
|------|-------------|----------|
| **로컬 개발** (지금) | Access Key | `.env` 파일 |
| **K3s 배포** (나중) | IAM Role | 불필요 (자동) |

---

## 로컬 개발: Access Key 설정

### `.env` 파일 확인

이미 생성된 `.env` 파일에 AWS 키가 입력되어 있습니다:

```env
AWS_REGION=ap-northeast-2
AWS_ACCESS_KEY_ID=AKIATFGY26FTF5NSH3GP
AWS_SECRET_ACCESS_KEY=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

DYNAMODB_TABLE_NAME=sfbank-blue-FaaSData
S3_BUCKET_NAME=sfbank-blue-functions-code-bucket
```

### 필요한 IAM 권한

백엔드가 필요한 AWS 권한:

**DynamoDB**:
- `dynamodb:GetItem`
- `dynamodb:PutItem`
- `dynamodb:UpdateItem`
- `dynamodb:DeleteItem`
- `dynamodb:Query`
- `dynamodb:Scan`

**S3**:
- `s3:GetObject`
- `s3:PutObject`
- `s3:DeleteObject`
- `s3:ListBucket`

---

## 새 Access Key 발급 (필요시)

### 1. AWS Console 로그인
https://console.aws.amazon.com/

### 2. IAM으로 이동
검색창에 "IAM" 입력 → IAM 클릭

### 3. 액세스 키 생성
1. 왼쪽 메뉴: "사용자" 클릭
2. 본인 사용자 이름 클릭
3. "보안 자격 증명" 탭
4. "액세스 키 만들기" 버튼
5. 용도: "로컬 코드" 선택
6. **액세스 키 & 시크릿 키 복사** (이 화면에서만 보임!)

### 4. `.env` 파일에 입력
```bash
# backend/.env 파일 편집
AWS_ACCESS_KEY_ID=AKIA여기에키입력
AWS_SECRET_ACCESS_KEY=wJalrXUtn여기에시크릿입력
```

### 5. Docker 재시작
```bash
docker-compose restart
```

---

## K3s 배포: IAM Role 사용

### EC2/K3s 환경에서는 `.env` 불필요

인프라 엔지니어가 다음 IAM Role을 설정합니다:
- Role 이름: `blue-final-k3s-worker`
- 권한: DynamoDB + S3 접근

백엔드 컨테이너는 자동으로 이 Role을 사용하여 AWS에 접근합니다.

---

## 보안 주의사항

### ⚠️ 절대 Git에 커밋하지 마세요!

`.gitignore`에 이미 포함되어 있음:
```
.env
.env.local
```

### ⚠️ 키 유출 시 즉시 삭제
1. AWS Console → IAM → 사용자 → 보안 자격 증명
2. 해당 액세스 키 "비활성화" 또는 "삭제"
3. 새 키 생성

---

## 요약

- **로컬**: `.env` 파일에 AWS Access Key 입력
- **K3s**: IAM Role 자동 사용 (설정 불필요)
- **보안**: `.env` 파일은 Git에 커밋 금지
