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

#### 1. Infrastructure Service Endpoint Integration ⭐⭐⭐
**Current Status**: Mock implementation completed, waiting for actual services
**Required Info**: (Requested from Hyunmin Cho)
- Build Service endpoint
- Push Service endpoint
- Scaffold Service endpoint
- Deploy Service endpoint

**Work to do**:
```python
# backend/app/routers/builds.py
# TODO comments marked sections:
# - _mock_build_process() -> replace with actual build service call
# - _mock_push_process() -> replace with actual push service call
# - scaffold_spinapp() -> replace with actual scaffold service call
# - deploy_to_k8s() -> replace with actual deploy service call
```

**Owner**: Seongwoo Choi (after Hyunmin Cho's response)

#### 2. Environment Variables Addition ⭐⭐
**Required Info**: (Requested from Hyunmin Cho)
- ECR Registry URL
- ECR Repository name
- Build service endpoints

**Work to do**:
```python
# Add to backend/app/config.py
class Settings(BaseSettings):
    # Existing settings...

    # Build Infrastructure (need to add)
    build_service_url: str = ""
    push_service_url: str = ""
    scaffold_service_url: str = ""
    deploy_service_url: str = ""
    ecr_registry_url: str = ""
    ecr_repository: str = ""
```

**Owner**: Seongwoo Choi (after Hyunmin Cho's response)

#### 3. Async Task Status Update Implementation ⭐⭐
**Decision Made**: ✅ **Polling Method**
**Recommended by**: Hyunmin Cho (Infrastructure Team)

**Work to do**:
- Implement periodic polling to infrastructure services
- Check task status at regular intervals (e.g., every 5 seconds)
- Update DynamoDB task status based on infrastructure response
- Handle timeout and error cases

**Implementation Details**:
```python
# Pseudo-code for polling implementation
async def poll_task_status(task_id: str, max_attempts: int = 120):
    for attempt in range(max_attempts):
        # Call infrastructure service to get status
        status = await infrastructure_service.get_task_status(task_id)

        # Update DynamoDB
        db_client.update_build_task_status(...)

        if status in ['completed', 'failed']:
            break

        await asyncio.sleep(5)  # Poll every 5 seconds
```

**Owner**: Seongwoo Choi (after receiving infrastructure endpoints)

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
**Current Status**: Not integrated
**Owner**: Seongwoo Choi

**Required Work**:
- Call `http://localhost:8000/api/v1/build` from frontend
- File upload UI integration
- Task status polling implementation
- CORS verification (currently: localhost:3000, localhost:5173 allowed)

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

#### Response from Hyunmin Cho (Evening)
**Status**: Partially resolved ✅

1. **Infrastructure Service Endpoints** ⏰
   - Will be confirmed and shared
   - Expected to be available in the evening
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

**Next Steps**:
- Wait for evening update with:
  - Infrastructure service endpoints (Build, Push, Scaffold, Deploy)
  - ECR registry URL and repository name

---

## 📝 Task Priority

### Priority 1: Immediately Available (Infrastructure Independent)
1. ✅ Build API Mock testing
2. Frontend integration work
3. ECR backend image upload

### Priority 2: After Infrastructure Info Received
1. Environment variables addition (config.py)
2. Replace Mock functions with actual service calls
3. Async task status update implementation
4. Integration testing

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

**Last Update**: 2025-12-03
**Author**: Seongwoo Choi
**Status**: Waiting for Hyunmin Cho's response
