$ErrorActionPreference = "Stop"

Write-Host "[1/6] ECR 로그인 중..."
$password = & 'C:\Program Files\Amazon\AWSCLIV2\aws.exe' ecr get-login-password --region ap-northeast-2
$password | docker login --username AWS --password-stdin 217350599014.dkr.ecr.ap-northeast-2.amazonaws.com

if ($LASTEXITCODE -eq 0) {
    Write-Host "[OK] ECR 로그인 성공`n"
} else {
    Write-Host "[ERROR] ECR 로그인 실패"
    exit 1
}

Write-Host "[2/6] ECR 리포지토리 확인 중..."
$repoCheck = & 'C:\Program Files\Amazon\AWSCLIV2\aws.exe' ecr describe-repositories --repository-names faas-backend --region ap-northeast-2 2>&1

if ($LASTEXITCODE -ne 0) {
    Write-Host "리포지토리가 없습니다. 생성 중..."
    & 'C:\Program Files\Amazon\AWSCLIV2\aws.exe' ecr create-repository --repository-name faas-backend --region ap-northeast-2 --image-scanning-configuration scanOnPush=true
    Write-Host "[OK] 리포지토리 생성 완료`n"
} else {
    Write-Host "[OK] 리포지토리가 이미 존재합니다`n"
}

Write-Host "[3/6] Docker 이미지 빌드 대기 중..."
Write-Host "백그라운드 빌드가 완료될 때까지 대기하세요."
Write-Host "빌드 상태 확인: docker images | findstr faas-backend`n"
