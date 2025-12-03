# Remaining Tasks

## ✅ Completed Work

### 1. Backend Basic API Implementation (Completed)
- [x] FastAPI project structure setup
- [x] Docker + Docker Compose configuration
- [x] AWS DynamoDB and S3 client implementation
- [x] Workspace, Function, Logs API implementation
- [x] .env file setup with AWS credentials
- [x] Backend container build and run success
- [x] Health check endpoint testing completed

### 2. Build App API Implementation (2025-12-03 Completed) ✨
- [x] Build Task data model design and implementation (models.py)
  - BuildResponse, TaskStatusResponse, BuildTaskResult
  - PushRequest, ScaffoldRequest/Response
  - DeployRequest/Response, BuildAndPushRequest
- [x] DynamoDB BuildTask CRUD logic implementation (database.py)
  - create_build_task, get_build_task, get_build_task_by_id
  - update_build_task_status, list_build_tasks
- [x] S3 build source upload logic implementation (database.py)
  - save_build_source, get_build_source, delete_build_source
- [x] Build API router implementation (builds.py)
  - POST /api/v1/build (file upload and build)
  - GET /api/v1/tasks/{task_id} (task status query)
  - POST /api/v1/push (ECR push)
  - POST /api/v1/scaffold (SpinApp manifest generation)
  - POST /api/v1/deploy (K8s deployment)
  - POST /api/v1/build-and-push (build + push integration)
- [x] Build router registration in main.py
- [x] Shared DynamoDB schema with Hyunmin Cho and requested infrastructure info
- [x] Frontend API integration functions (frontend/src/lib/api.ts)
  - buildFromFile, getTaskStatus, pushToECR
  - scaffoldSpinApp, deployToK8s, buildAndPush
  - TypeScript type definitions matching backend models

### 3. Documentation
- [x] README.md (overall project guide)
- [x] DOCKER_COMMANDS.md (Docker commands reference)
- [x] DOCKER_COMPOSE_EXPLAINED.md (Docker Compose explanation)
- [x] AWS_CREDENTIALS_SIMPLE.md (AWS credentials guide)
- [x] DYNAMODB_SETUP_GUIDE.md (DynamoDB table setup guide)
- [x] S3_SETUP_GUIDE.md (S3 bucket setup guide)

---

## 🔧 Current Status

### Backend API Status
```bash
# Container running
docker ps
# faas-backend container running on port 8000

# Health Check success
curl http://localhost:8000/health
# {"status":"healthy"}
```

### Implemented API Endpoints

#### Basic API
- `GET /health` - health check
- `GET /docs` - Swagger UI
- `GET /redoc` - ReDoc UI

#### Workspace API
- `POST /api/workspaces` - create workspace
- `GET /api/workspaces` - list workspaces
- `GET /api/workspaces/{id}` - get workspace
- `PATCH /api/workspaces/{id}` - update workspace
- `DELETE /api/workspaces/{id}` - delete workspace

#### Function API
- `POST /api/workspaces/{workspace_id}/functions` - create function
- `GET /api/workspaces/{workspace_id}/functions` - list functions
- `GET /api/functions/{id}` - get function
- `PATCH /api/functions/{id}` - update function
- `DELETE /api/functions/{id}` - delete function

#### Logs API
- `GET /api/functions/{id}/logs` - get execution logs

#### Build API (New) ✨
- `POST /api/v1/build` - file upload and build start
- `GET /api/v1/tasks/{task_id}` - task status query
- `POST /api/v1/push` - push image to ECR
- `POST /api/v1/scaffold` - generate SpinApp manifest
- `POST /api/v1/deploy` - deploy SpinApp to K8s
- `POST /api/v1/build-and-push` - build and push integration

---

## 🚧 Remaining Tasks (Waiting for Hyunmin Cho's Response)

### ⏳ Infrastructure Integration Pending

#### 1. Core Services Integration Method Clarification ⭐⭐⭐
**Current Status**: Mock implementation completed, waiting for integration method clarification
**Required Info**: (Requested from Hyunmin Cho - 2025-12-04)

Based on the architecture diagram (빌드앱구조API.pdf), FastAPI Server needs to interact with Core Services:
- Validation Service (MyPy)
- Build Service (spin build)
- Push Service (spin registry)
- Scaffold Service (spin kube scaffold)
- Deploy Service (kubectl apply)

**Questions to Hyunmin Cho**:
1. **Integration Method**:
   - Option A: HTTP API calls to separate services (e.g., `http://build-service:8080/build`)
   - Option B: Direct CLI command execution (e.g., subprocess running `spin build`)

2. **Polling Implementation**:
   - If HTTP API: Which endpoint to poll for task status?
   - If CLI: Should we check filesystem/S3 for completion?

**Work to do** (after clarification):
```python
# backend/app/routers/builds.py
# TODO comments marked sections:
# - _mock_build_process() -> replace with actual integration method
# - _mock_push_process() -> replace with actual integration method
# - scaffold_spinapp() -> replace with actual integration method
# - deploy_to_k8s() -> replace with actual integration method
```

**Owner**: Seongwoo Choi (after Hyunmin Cho's response)

#### 2. Configuration Update (If Needed) ⭐
**Current Status**: Pending Core Services integration method clarification

**Important Note**:
- ECR credentials (registry_url, username, password) are passed as **API request parameters** (see PDF page 3: POST /api/v1/push)
- NOT environment variables

**Potential Environment Variables** (depends on integration method):
```python
# Add to backend/app/config.py (if using HTTP API approach)
class Settings(BaseSettings):
    # Existing settings...

    # Build Infrastructure (only if using HTTP services)
    build_service_url: str = ""  # Optional: if Core Services are HTTP endpoints
    push_service_url: str = ""
    scaffold_service_url: str = ""
    deploy_service_url: str = ""
```

**Owner**: Seongwoo Choi (after integration method confirmed)

#### 3. Async Task Status Update Implementation ⭐⭐
**Decision Made**: ✅ **Polling Method**
**Recommended by**: Hyunmin Cho (Infrastructure Team)

**Status**: Implementation depends on Core Services integration method

**Work to do**:
- Implement periodic polling mechanism
- Check task status at regular intervals (e.g., every 5 seconds)
- Update DynamoDB task status based on infrastructure response
- Handle timeout and error cases

**Implementation Details** (will vary based on integration method):
```python
# Option A: HTTP API polling
async def poll_task_status_http(task_id: str, max_attempts: int = 120):
    for attempt in range(max_attempts):
        # Call Core Service HTTP API
        response = await http_client.get(f"{service_url}/tasks/{task_id}")
        status = response.json()["status"]

        # Update DynamoDB
        db_client.update_build_task_status(...)

        if status in ['completed', 'failed']:
            break

        await asyncio.sleep(5)

# Option B: Filesystem/S3 polling
async def poll_task_status_fs(task_id: str, max_attempts: int = 120):
    for attempt in range(max_attempts):
        # Check S3 for build artifacts
        wasm_exists = await s3_client.check_file_exists(
            f"build-artifacts/{task_id}/app.wasm"
        )

        if wasm_exists:
            # Update DynamoDB to completed
            db_client.update_build_task_status(...)
            break

        await asyncio.sleep(5)
```

**Owner**: Seongwoo Choi (after Core Services integration method confirmed)

---

## 🎯 Immediately Available Tasks (Infrastructure Independent)

### 1. Build API Testing ⭐⭐⭐
**Current Status**: Testable with Mock
**Owner**: Seongwoo Choi

```bash
# 1. Start server
cd backend
docker-compose up -d

# 2. Access Swagger UI
http://localhost:8000/docs

# 3. Test POST /api/v1/build
# - Upload file (.py or .zip)
# - Changes to completed status after 3 seconds

# 4. Test GET /api/v1/tasks/{task_id}
# - Query status with task_id
# - Check wasm_path in result
```

### 2. Frontend Integration ⭐⭐⭐
**Current Status**: API functions implemented, UI integration pending
**Owner**: Seongwoo Choi

**Completed**:
- ✅ API client functions in `frontend/src/lib/api.ts`
- ✅ TypeScript type definitions matching backend models
- ✅ CORS configuration (localhost:3000, localhost:5173 allowed)

**Required Work**:
- Build upload UI component integration
- Task status polling UI implementation
- Error handling and user feedback

### 3. ECR Image Upload ⭐
**Current Status**: Not uploaded
**Owner**: Seongwoo Choi

```bash
# Run ecr-upload.bat (Windows)
cd backend
ecr-upload.bat

# Or run ecr-upload.sh (Linux/Mac)
./ecr-upload.sh
```

---

## 📊 DynamoDB Schema (Shared with Hyunmin Cho)

### BuildTask Item Structure
```
Table Name: sfbank-blue-FaaSData

Item Structure:
- PK (Partition Key): "WS#{workspace_id}"
- SK (Sort Key): "BUILD#{task_id}"
- Type: "BuildTask"
- task_id: UUID (unique task ID)
- workspace_id: workspace ID
- app_name: application name
- status: "pending" | "running" | "completed" | "failed"
- source_code_path: S3 path (uploaded source)
- wasm_path: WASM file path (on build completion)
- image_url: ECR image URL (on push completion)
- error_message: error message (on failure)
- created_at: creation time (ISO 8601)
- updated_at: update time (ISO 8601)
```

### S3 Path Rules
```
Bucket: sfbank-blue-functions-code-bucket

Source Code:
  build-sources/{workspace_id}/{task_id}/{filename}

Build Artifacts (expected):
  build-artifacts/{task_id}/{app_name}.wasm
```

---

## 🔗 Communication Log with Hyunmin Cho

### 2025-12-03

#### Initial Request (Morning)
1. ✅ Shared DynamoDB schema proposal
2. ✅ Requested infrastructure integration info:
   - Infrastructure service endpoints
   - ECR registry information
   - File storage path rules
   - Async task status update method

#### Response from Hyunmin Cho (Afternoon 1:36 PM)
**Status**: Partially resolved ✅

1. **Infrastructure Service Endpoints** ⏰
   - Will be confirmed and shared in the evening
   - Likely documented in API documentation

2. **S3 Path & ECR Information**
   - ✅ **S3 Path**: No specific requirement - use proposed path structure
     - Source: `build-sources/{workspace_id}/{task_id}/{filename}`
     - Artifacts: `build-artifacts/{task_id}/{app_name}.wasm`
   - ⏰ **ECR Information**: Will be shared in the evening

3. **Async Task Status Update Method** ✅
   - **Decision**: Use **Polling Method** (Option 1)
   - Backend will periodically check infrastructure service for task status
   - Recommended by infrastructure team

#### Hyunmin Cho shared "빌드앱구조API.pdf" (Evening 10:35 PM)
**Status**: Architecture and API specification received ✅

1. **Architecture Diagram** ✅
   - Client (Web UI/CLI)
   - FastAPI Server (REST API Layer, Background Task Manager, Task Store)
   - Core Services (Validation, Build, Push, Scaffold, Deploy)
   - External Systems (WASM Template, AWS ECR, Kubernetes Cluster)

2. **REST API Specification** ✅
   - Confirms our implemented endpoints match the spec
   - All request/response models validated

3. **Still Unclear** ⏰
   - How FastAPI Server should call Core Services (HTTP vs CLI)
   - DynamoDB usage by Core Services
   - Polling implementation details

### 2025-12-04

#### Follow-up Questions to Hyunmin Cho (Morning)
**Status**: Waiting for response ⏰

Asked for clarification on:
1. **Core Services Integration Method**
   - Option A: HTTP API endpoints?
   - Option B: Direct CLI command execution?

2. **Polling Implementation Details**
   - If HTTP: Which endpoint to poll for status?
   - If CLI: Should we monitor filesystem/S3?

**Next Steps**:
- Wait for Hyunmin Cho's clarification on integration method
- Implement actual Core Services integration once method is confirmed

---

## 📝 Task Priority

### Priority 1: Immediately Available (Infrastructure Independent)
1. ✅ Build API Mock testing
2. Frontend integration work
3. ECR backend image upload

### Priority 2: After Core Services Integration Method Confirmed
1. Implement actual Core Services integration (HTTP or CLI)
2. Async task status polling implementation
3. Configuration updates (if needed)
4. Integration testing with actual Core Services

### Priority 3: Deployment and Monitoring
1. K3s deployment (Infrastructure Engineer)
2. Production environment testing
3. Error handling enhancement
4. Logging and monitoring implementation

---

## ⚠️ Important Notes

### 1. AWS Credentials Security
- NEVER commit `.env` file to Git
- Already added to `.gitignore`

### 2. Local vs K3s Environment
- **Local**: Uses AWS Access Key from `.env` file
- **K3s**: Uses IAM Role (configured by Infrastructure Engineer)

### 3. Hot Reload
- Python code changes are auto-reflected (no restart needed)
- Dockerfile changes require `docker-compose up --build -d`

### 4. Mock vs Actual Implementation
- Currently build/push/deploy work with **Mock**
- For testing purposes until actual infrastructure integration
- Parts needing replacement are marked with `TODO:` comments

---

## 🔗 Related Documentation

- [README.md](./README.md) - Overall guide
- [DOCKER_COMMANDS.md](./DOCKER_COMMANDS.md) - Docker commands
- [AWS_CREDENTIALS_SIMPLE.md](./AWS_CREDENTIALS_SIMPLE.md) - AWS credentials
- [DYNAMODB_SETUP_GUIDE.md](./DYNAMODB_SETUP_GUIDE.md) - DynamoDB setup
- [S3_SETUP_GUIDE.md](./S3_SETUP_GUIDE.md) - S3 setup

---

## 📞 Contacts

- **Backend Development**: Seongwoo Choi
- **Infrastructure Development**: Hyunmin Cho
- **Frontend Development**: (Developer name)

---

**Last Update**: 2025-12-04
**Author**: Seongwoo Choi
**Status**: Waiting for Core Services integration method clarification from Hyunmin Cho
