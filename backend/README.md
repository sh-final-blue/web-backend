# FaaS Backend API

Function as a Service (FaaS) 플랫폼의 백엔드 API 서버입니다.

**Production**: https://api.eunha.icu (ArgoCD auto-deploy)
**Builder Service**: https://builder.eunha.icu
**Status**: ✅ Core Services Integration Completed (2025-12-06)

---

## 🚀 Quick Start

### Production API (Live)
```bash
# Swagger UI
open https://api.eunha.icu/docs

# Health Check
curl https://api.eunha.icu/health
```

### Local Development
```bash
# 1. 프로젝트 루트에서 Docker Compose 실행
cd ..
docker-compose up -d

# 2. API 문서 확인
open http://localhost:8000/docs

# 3. Health Check
curl http://localhost:8000/health
```

---

## 📋 Features

### ✅ Workspace & Function Management
- Workspace CRUD API
- Function CRUD API
- Execution logs via Loki & Prometheus

### ✅ Build & Deploy (Spin Applications)
- Python → WASM 빌드 (via Builder Service)
- ECR Integration with **IRSA Support** (optional credentials)
- Kubernetes SpinApp Deployment
- function_id labeling for log filtering

### ✅ Core Services Integration
- **Builder Service**: https://builder.eunha.icu
- HTTP REST API with polling (5s interval, 10min timeout)
- Supports both "completed" and "done" status

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     FaaS Backend API                        │
│                  (https://api.eunha.icu)                    │
└─────────────────────────────────────────────────────────────┘
                            │
                            ├─── DynamoDB (sfbank-blue-FaaSData)
                            ├─── S3 (sfbank-blue-functions-code-bucket)
                            └─── Builder Service (https://builder.eunha.icu)
                                      │
                                      ├─── Build (Python → WASM)
                                      ├─── Push (ECR with IRSA)
                                      └─── Deploy (K8s SpinApp)
```

---

## 🛠️ Tech Stack

| Category | Technology |
|----------|-----------|
| **Framework** | FastAPI 0.115.6 |
| **Runtime** | Python 3.12 |
| **Database** | AWS DynamoDB (Single Table Design) |
| **Storage** | AWS S3 |
| **Container** | Docker + ArgoCD |
| **Orchestration** | Kubernetes (EKS) |
| **Ingress** | AWS ALB |
| **Monitoring** | Loki + Prometheus |

---

## 📁 Project Structure

```
backend/
├── app/
│   ├── main.py              # FastAPI entry point
│   ├── config.py            # Environment variables
│   ├── models.py            # Pydantic models
│   ├── database.py          # DynamoDB/S3 clients
│   └── routers/
│       ├── workspaces.py    # Workspace CRUD
│       ├── functions.py     # Function CRUD
│       ├── logs.py          # Logs API
│       └── builds.py        # Build & Deploy API ✨
├── Dockerfile               # Multi-stage build
├── requirements.txt         # Python dependencies
└── README.md
```

---

## 🌐 API Endpoints

### Health & Docs
- `GET /health` - Health check
- `GET /docs` - Swagger UI
- `GET /redoc` - ReDoc UI

### Workspace Management
- `POST /api/workspaces` - Create workspace
- `GET /api/workspaces` - List workspaces
- `GET /api/workspaces/{id}` - Get workspace
- `PATCH /api/workspaces/{id}` - Update workspace
- `DELETE /api/workspaces/{id}` - Delete workspace

### Function Management
- `POST /api/workspaces/{ws_id}/functions` - Create function
- `GET /api/workspaces/{ws_id}/functions` - List functions
- `GET /api/workspaces/{ws_id}/functions/{fn_id}` - Get function
- `PATCH /api/workspaces/{ws_id}/functions/{fn_id}` - Update function
- `DELETE /api/workspaces/{ws_id}/functions/{fn_id}` - Delete function

### Logs
- `GET /api/workspaces/{ws_id}/functions/{fn_id}/logs` - Get execution logs

### Build & Deploy ✨ (New)
- `POST /api/v1/build-and-push` - Build Python code to WASM and push to ECR
- `GET /api/v1/tasks/{task_id}` - Poll build task status
- `POST /api/v1/deploy` - Deploy SpinApp to Kubernetes

📖 **Full API Documentation**: https://api.eunha.icu/docs

---

## 🔧 Local Development

### Prerequisites
- Docker Desktop
- AWS Account (for DynamoDB/S3)

### Environment Variables
Create `backend/.env` file (local development only):
```env
AWS_REGION=ap-northeast-2
DYNAMODB_TABLE_NAME=sfbank-blue-FaaSData
S3_BUCKET_NAME=sfbank-blue-functions-code-bucket
ENVIRONMENT=development
LOG_LEVEL=INFO
```

**Note**: Production uses **IRSA** (no AWS credentials needed in `.env`)

### Run Locally
```bash
# From project root
docker-compose up -d

# View logs
docker-compose logs -f backend

# Stop
docker-compose down
```

### Hot Reload
Python code changes are **automatically reflected** (no restart needed).

---

## ☁️ Production Deployment

### Infrastructure
- **Deployment**: ArgoCD (auto-deploy from `main` branch)
- **Helm Chart**: `../web-backend-platform/`
- **Ingress**: AWS ALB (`api.eunha.icu`)
- **Auth**: IRSA (IAM Roles for Service Accounts)

### Deployment Flow
```
1. Git push to main branch
   ↓
2. GitHub Actions builds Docker image
   ↓
3. Image pushed to ECR
   ↓
4. ArgoCD detects changes
   ↓
5. Helm chart deployed to EKS
   ↓
6. ALB routes traffic to api.eunha.icu
```

### Environment Variables (Production)
Set in `../web-backend-platform/values.yaml`:
```yaml
env:
  AWS_REGION: "ap-northeast-2"
  DYNAMODB_TABLE_NAME: "sfbank-blue-FaaSData"
  S3_BUCKET_NAME: "sfbank-blue-functions-code-bucket"
  ENVIRONMENT: "production"
  LOG_LEVEL: "INFO"
  CORS_ORIGINS: '["https://eunha.icu", "http://eunha.icu"]'
```

---

## 📊 AWS Resources

### DynamoDB Table
- **Table Name**: `sfbank-blue-FaaSData`
- **Partition Key**: `PK` (String)
- **Sort Key**: `SK` (String)
- **Design**: Single Table Design

**Access Patterns**:
- Workspace: `PK=WS#{ws_id}`, `SK=METADATA`
- Function: `PK=WS#{ws_id}`, `SK=FN#{fn_id}`
- Build Task: `PK=WS#{ws_id}`, `SK=BUILD#{task_id}`
- Log: `PK=FN#{fn_id}`, `SK=LOG#{timestamp}`

### S3 Bucket
- **Bucket Name**: `sfbank-blue-functions-code-bucket`
- **Region**: `ap-northeast-2`

**Path Structure**:
```
build-sources/{workspace_id}/{task_id}/{filename}
build-artifacts/{task_id}/{app_name}.wasm
```

---

## 🔗 Integration

### Builder Service
- **URL**: https://builder.eunha.icu
- **Docs**: https://builder.eunha.icu/docs
- **Integration**: HTTP REST API with polling
- **Features**:
  - Build Python → WASM
  - Push to ECR (IRSA support)
  - Deploy to K8s (SpinApp)

### Loki & Prometheus
- **Logs**: Aggregated via Loki
- **Metrics**: Collected via Prometheus
- **Filter**: By `function_id` label

---

## 🧪 Testing

### Manual Testing
```bash
# Swagger UI (Interactive)
open https://api.eunha.icu/docs

# cURL Example
curl -X POST https://api.eunha.icu/api/workspaces \
  -H "Content-Type: application/json" \
  -d '{"name":"test","description":"Test workspace"}'
```

### Build & Deploy Test
```python
# 1. Upload Python file and build
POST /api/v1/build-and-push
- file: app.py (Spin Python format)
- registry_url: 217350599014.dkr.ecr.ap-northeast-2.amazonaws.com/blue-final-faas-app

# 2. Poll task status
GET /api/v1/tasks/{task_id}?workspace_id=ws-default

# 3. Deploy to K8s
POST /api/v1/deploy
- namespace: default
- image_ref: (from step 2)
- function_id: fn-test-001
```

**Python Code Format (Required)**:
```python
from spin_sdk import http
from spin_sdk.http import Request, Response

class IncomingHandler(http.IncomingHandler):
    def handle_request(self, request: Request) -> Response:
        return Response(
            200,
            {"content-type": "text/plain"},
            bytes("Hello from Blue FaaS!", "utf-8")
        )
```

**Reference**: https://developer.fermyon.com/spin/v3/python-components

---

## 🐛 Troubleshooting

### Build Fails with "IncomingHandler" Error
**Cause**: Incorrect Python code format
**Solution**: Use Spin Python SDK format (see Testing section)

### ECR Push Timeout
**Cause**: IRSA not configured or invalid credentials
**Solution**: Verify Builder Service IRSA configuration

### Deploy Fails with "Namespace Not Found"
**Cause**: Kubernetes namespace doesn't exist
**Solution**:
```bash
kubectl create namespace <namespace>
```

### API Returns 500 Error
**Cause**: DynamoDB/S3 access denied
**Solution**: Check IAM permissions (IRSA in production)

---

## 📚 Documentation

### Project Docs
- [REMAINING_TASKS.md](REMAINING_TASKS.md) - Development log & handoff
- [DOCKER_COMMANDS.md](DOCKER_COMMANDS.md) - Docker cheat sheet
- [DYNAMODB_SETUP_GUIDE.md](DYNAMODB_SETUP_GUIDE.md) - DynamoDB setup

### External References
- [Builder Service Deployment Flow](https://github.com/sh-final-blue/web-faas-builder/blob/main/docs/DEPLOYMENT_FLOW.md)
- [Spin Python SDK](https://developer.fermyon.com/spin/v3/python-components)
- [FastAPI Documentation](https://fastapi.tiangolo.com/)

---

## 📝 Latest Changes (2025-12-06)

### ✨ IRSA Support
- `username` and `password` are now optional in `/api/v1/build-and-push`
- Builder Service uses IRSA for ECR authentication
- Backward compatible with token-based auth

### ✨ Status Compatibility
- Supports both "completed" and "done" status from Builder Service
- Prevents polling failures due to status mismatch

### ✨ function_id Support
- Deploy API accepts `function_id` parameter
- Pod labels include `function_id` for log filtering
- Enables per-function log queries

---

## 👥 Team

- **Backend Development**: Sungwoo Choi
- **Infrastructure**: Hyunmin Cho
- **Log System**: Jaejun Lee

---

**Last Updated**: 2025-12-06
**Version**: 2.0.0
**License**: Softbank Hackathon 2025 - Final Project
