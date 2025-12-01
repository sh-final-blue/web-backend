# 작업 태스크 MVP
담당자: 조현민

## 1. MVP Cloud Infrastructure
작업 기간: ~11/30 (일)
- [x] K3s용 EC2 Terraform 세팅 및 생성 (참고: 07명final_blue)
- [x] SG(Security Group) 그룹 생성
- [x] 제어 노드 IAM 권한 설정 (Control-plane)
- [x] 워커 노드 IAM 권한 설정
    - Hop Limit 설정 (http-put-response-hop-limit : 2)
- [x] EC2 인스턴 5개 생성
- [x] 로드밸런서 타겟 그룹 생성
- [x] K3s IAM 권한 관련 설정 (특히 AWS LB 연동 및 태그)

## 2. K3s Setup & Network
참고: @required k3s.1
- [ ] K3s 초기 설정
- ⚠️ 주의사항: CNI는 Calico 대신 amazon-vpc-cni를 사용해야 함. (이유: Amazon VPC CNI k8s 호환)
- [ ] K3s Server 설정 (Master Node 1개)
- [ ] K3s Worker Node 설정 (4개)
    - worker-wasm
    - worker-observability
    - worker-infra
    - worker-build
- [ ] CNI 설정 (amazon-vpc-cni-k8s)
- [ ] 노드 설정 (kubectl 명령 사용)
- [ ] Taints 및 Tolerance 설정 (Control-plane에 스케줄링 방지)
- [ ] 노드 Label 설정 (용도별 분류)

## 3. Container Runtime & Wasm Support
참고: @required k3s.1
- [ ] Containerd 설정 수정 (Wasm shim 추가)
- [ ] Spin Wasm 플러그인 설치
- [ ] 런타임 클래스(RuntimeClass) 정의 (spin)

## 4. AWS Load Balancer Controller
참고: @required k3s.1, Helm Chart, Installation Guide
- [ ] AWS LB Helm Chart 설치
- [ ] LoadBalancer 서비스 생성 테스트
- [ ] Ingress 설정 (ALB/NLB) -> 외부 접속 확인

## 5. Observability
참고: @required k3s.1
- [ ] 기본 k8s Observability 구축
- [ ] Kubernetes Dashboard Helm Chart 설치
- [ ] Grafana Helm Chart 설치

## 6. Function as a Service (FaaS) Logic
- [ ] K8s Spin 배포 설정
- [ ] cert-manager 설치
- [ ] spin-operator 설치

## 7. Application & CI/CD

Application Design [DB 포함]:
참고: frontend/API_Document.md

### Frontend
- [ ] Frontend MVP Mock-up 인수인계 및 코드 리뷰

### Backend
1. FastAPI Server 개발 및 환경 구성
- [ ] FastAPI 초기 세팅: 프로젝트 생성 및 Uvicorn 실행 환경 구성
- [ ] API 문서화: Swagger UI 설정 및 공유
- [ ] AWS 연결 구현: boto3 라이브러리 설치 및 DynamoDB/S3 Client 연결 코드 작성
- [ ] 핵심 로직 구현: Workspace/Function CRUD 및 Base64 코드 처리 로직 개발 (참고: frontend/API_Document.md)
- [ ] Dockerfile 및 K3s 배포 스펙(Port, Env) 협의

2. AWS 리소스 연동 준비
- [ ] DynamoDB: 단일 테이블(Single Table) 생성 (PK/SK 구조)
- [ ] S3: 함수 코드 저장용 버킷 생성 (경로: s3://bucket/{ws_id}/{fn_id}.py)
- [ ] 권한(Credential) 처리:
    - 개발용: EC2 내부 .env 파일에 AWS 키 설정
    - 배포용: K8s 파드(Pod)에 적용될 IAM Role 권한 확인

CI/CD Pipeline: 코드 -> Dockerfile 빌드 -> ECR 배포 -> GitHub Actions -> 배포

- [ ] FrontEnd CI/CD
    - [ ] Dockerfile 작성
    - [ ] OCI 및 ECR 배포 설정
    - [ ] Github Action 작성

- [ ] BackEnd CI/CD
    - [ ] Dockerfile 작성
    - [ ] OCI 및 ECR 배포 설정
    - [ ] Github Action 작성

- [ ] FaaS Logic App CI/CD
    - [ ] Dockerfile 작성
    - [ ] OCI 및 ECR 배포 설정
    - [ ] Github Action 작성
