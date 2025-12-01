# API Test Plan

## Current Status
- ✅ FastAPI backend developed
- ✅ Docker image built and pushed to ECR
- ✅ K3s deployment documentation ready
- ⏳ **Next: API testing required**

---

## Prerequisites for Testing

### Option 1: Local Docker Testing (Recommended for quick tests)
```bash
# Run backend locally with Docker
docker run -d -p 8000:8000 --name faas-backend \
  -e AWS_REGION=ap-northeast-2 \
  -e DYNAMODB_TABLE_NAME=sfbank-blue-FaaSData \
  -e S3_BUCKET_NAME=sfbank-blue-functions-code-bucket \
  -e ENVIRONMENT=development \
  -e LOG_LEVEL=DEBUG \
  -e AWS_ACCESS_KEY_ID=<your-key> \
  -e AWS_SECRET_ACCESS_KEY=<your-secret> \
  217350599014.dkr.ecr.ap-northeast-2.amazonaws.com/faas-backend:latest

# Access Swagger UI
http://localhost:8000/docs
```

### Option 2: K3s Deployment Testing (After infrastructure is ready)
```bash
# Wait for infrastructure engineer to deploy to K3s
# Then test via Load Balancer URL
curl http://<k3s-lb-url>/health
```

---

## Test Cases

### 1. Health Check
```bash
curl http://localhost:8000/health
# Expected: {"status":"healthy"}
```

### 2. Create Workspace
```bash
curl -X POST http://localhost:8000/api/workspaces \
  -H "Content-Type: application/json" \
  -d '{
    "name": "test-workspace",
    "description": "Test workspace for API validation"
  }'

# Expected Response:
# {
#   "id": "ws_...",
#   "name": "test-workspace",
#   "description": "Test workspace for API validation",
#   "created_at": "2025-12-01T...",
#   "updated_at": "2025-12-01T..."
# }
```

### 3. List Workspaces
```bash
curl http://localhost:8000/api/workspaces

# Expected: Array of workspaces
# [
#   {
#     "id": "ws_...",
#     "name": "test-workspace",
#     "description": "...",
#     "created_at": "...",
#     "updated_at": "..."
#   }
# ]
```

### 4. Get Workspace by ID
```bash
# Replace {workspace_id} with actual ID from step 2
curl http://localhost:8000/api/workspaces/{workspace_id}

# Expected: Single workspace object
```

### 5. Create Function
```bash
# Replace {workspace_id} with actual ID
curl -X POST http://localhost:8000/api/workspaces/{workspace_id}/functions \
  -H "Content-Type: application/json" \
  -d '{
    "name": "hello-world",
    "description": "Simple hello world function",
    "language": "python",
    "code_base64": "ZGVmIGhhbmRsZXIoZXZlbnQsIGNvbnRleHQpOgogICAgcmV0dXJuIHsKICAgICAgICAic3RhdHVzQ29kZSI6IDIwMCwKICAgICAgICAiYm9keSI6ICJIZWxsbyBXb3JsZCEiCiAgICB9"
  }'

# Note: code_base64 is Base64 encoded Python function:
# def handler(event, context):
#     return {
#         "statusCode": 200,
#         "body": "Hello World!"
#     }

# Expected Response:
# {
#   "id": "fn_...",
#   "workspace_id": "ws_...",
#   "name": "hello-world",
#   "description": "Simple hello world function",
#   "language": "python",
#   "s3_path": "s3://sfbank-blue-functions-code-bucket/ws_.../fn_.../code.py",
#   "created_at": "...",
#   "updated_at": "...",
#   "last_run_at": null
# }
```

### 6. List Functions in Workspace
```bash
# Replace {workspace_id} with actual ID
curl http://localhost:8000/api/workspaces/{workspace_id}/functions

# Expected: Array of functions
```

### 7. Get Function by ID
```bash
# Replace {function_id} with actual ID from step 5
curl http://localhost:8000/api/functions/{function_id}

# Expected: Single function object with code retrieved from S3
```

### 8. Update Function
```bash
# Replace {function_id} with actual ID
curl -X PATCH http://localhost:8000/api/functions/{function_id} \
  -H "Content-Type: application/json" \
  -d '{
    "description": "Updated description",
    "code_base64": "ZGVmIGhhbmRsZXIoZXZlbnQsIGNvbnRleHQpOgogICAgcmV0dXJuIHsKICAgICAgICAic3RhdHVzQ29kZSI6IDIwMCwKICAgICAgICAiYm9keSI6ICJVcGRhdGVkIEhlbGxvIFdvcmxkISIKICAgIH0="
  }'

# Expected: Updated function object
```

### 9. Get Function Execution Logs
```bash
# Replace {function_id} with actual ID
curl "http://localhost:8000/api/functions/{function_id}/logs?limit=100"

# Expected: Array of execution logs (may be empty if no executions yet)
# [
#   {
#     "id": "log_...",
#     "function_id": "fn_...",
#     "timestamp": "...",
#     "status": "success",
#     "output": "...",
#     "error": null,
#     "duration_ms": 123
#   }
# ]
```

### 10. Update Workspace
```bash
# Replace {workspace_id} with actual ID
curl -X PATCH http://localhost:8000/api/workspaces/{workspace_id} \
  -H "Content-Type: application/json" \
  -d '{
    "description": "Updated workspace description"
  }'

# Expected: Updated workspace object
```

### 11. Delete Function
```bash
# Replace {function_id} with actual ID
curl -X DELETE http://localhost:8000/api/functions/{function_id}

# Expected: {"message": "Function deleted successfully"}
```

### 12. Delete Workspace
```bash
# Replace {workspace_id} with actual ID
curl -X DELETE http://localhost:8000/api/workspaces/{workspace_id}

# Expected: {"message": "Workspace deleted successfully"}
```

---

## Verification Checklist

After each test:
- [ ] Check HTTP status code (200, 201, 204, etc.)
- [ ] Verify response JSON structure matches API spec
- [ ] Check DynamoDB table in AWS Console
  - Workspace items: PK=`WS#{id}`, SK=`METADATA`
  - Function items: PK=`WS#{ws_id}`, SK=`FN#{fn_id}`
- [ ] Check S3 bucket for function code files
  - Path: `s3://sfbank-blue-functions-code-bucket/{ws_id}/{fn_id}/code.py`
- [ ] Check backend logs for errors
  ```bash
  docker logs -f faas-backend
  ```

---

## Error Scenarios to Test

### 1. Invalid Input
```bash
# Missing required field
curl -X POST http://localhost:8000/api/workspaces \
  -H "Content-Type: application/json" \
  -d '{}'

# Expected: 422 Unprocessable Entity
```

### 2. Non-existent Resource
```bash
curl http://localhost:8000/api/workspaces/ws_nonexistent

# Expected: 404 Not Found
```

### 3. Invalid Base64 Code
```bash
curl -X POST http://localhost:8000/api/workspaces/{workspace_id}/functions \
  -H "Content-Type: application/json" \
  -d '{
    "name": "test",
    "description": "test",
    "language": "python",
    "code_base64": "invalid-base64!!!"
  }'

# Expected: 400 Bad Request or 422 Unprocessable Entity
```

---

## Performance Tests (Optional)

### Load Testing with Apache Bench
```bash
# Test health endpoint
ab -n 1000 -c 10 http://localhost:8000/health

# Test workspace listing
ab -n 100 -c 5 http://localhost:8000/api/workspaces
```

---

## Next Steps After Testing

1. **If all tests pass**:
   - ✅ Mark backend as ready for K3s deployment
   - ✅ Share test results with team
   - ✅ Proceed with frontend integration

2. **If tests fail**:
   - 🐛 Debug and fix issues
   - 🔄 Rebuild Docker image
   - 📤 Push updated image to ECR
   - 🔁 Re-test

3. **K3s Deployment**:
   - Infrastructure engineer deploys using [K3S_DEPLOYMENT_INFO.md](K3S_DEPLOYMENT_INFO.md)
   - Re-run all tests against K3s Load Balancer URL
   - Verify IAM Role permissions work correctly

---

## Tools Recommendations

### GUI Testing
- **Postman**: Import OpenAPI spec from `http://localhost:8000/openapi.json`
- **Swagger UI**: `http://localhost:8000/docs` (built-in)
- **Insomnia**: Alternative to Postman

### CLI Testing
- **curl**: For quick tests
- **httpie**: More user-friendly than curl
  ```bash
  # Install
  pip install httpie

  # Usage
  http POST localhost:8000/api/workspaces name="test" description="test"
  ```

### Automated Testing
- **pytest** with FastAPI TestClient (already in requirements.txt)
- Write test cases in `tests/` directory

---

## Contact

For questions or issues during testing:
- Check API documentation: `http://localhost:8000/docs`
- Review backend logs: `docker logs -f faas-backend`
- Check AWS CloudWatch (if configured)
