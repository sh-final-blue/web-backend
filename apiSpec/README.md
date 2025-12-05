# API Specification

## Live API Documentation

- **Production**: [https://api.eunha.icu/docs](https://api.eunha.icu/docs)
- **Local Development**: [http://localhost:8000/docs](http://localhost:8000/docs)

## Offline Viewer

Open `../swagger-viewer.html` in your browser to view the offline API specification.

```bash
# Serve the project root
cd ..
python -m http.server 8000

# Then open http://localhost:8000/swagger-viewer.html
```

## API Specification Files

### faas-backend/faas-api.yaml
- **Version**: 2.0.0
- **Last Updated**: 2025-12-06
- **Status**: ✅ Production Ready

**Note**: This YAML file is a snapshot. For the most up-to-date API spec, always refer to the live documentation at `https://api.eunha.icu/docs`.

## Latest Changes (2025-12-06)

### ✨ IRSA Support
- `username` parameter defaults to "AWS" (optional)
- `password` parameter is now optional
- Builder Service can use IRSA for ECR authentication
- Backward compatible with token-based auth

### ✨ Status Compatibility
- Supports both "completed" and "done" status from Builder Service
- Handles status transitions: `pending` → `running` → `completed`/`done` → `failed`

### ✨ function_id Support
- Deploy API now accepts `function_id` parameter
- Used for Pod labeling and log filtering
- Enables per-function log queries via Loki

## Key Endpoints

### Build & Deploy
- `POST /api/v1/build-and-push` - Build Python code to WASM and push to ECR
- `GET /api/v1/tasks/{task_id}` - Poll build task status
- `POST /api/v1/deploy` - Deploy SpinApp to Kubernetes

### Workspace & Function Management
- `POST /api/workspaces` - Create workspace
- `GET /api/workspaces` - List workspaces
- `POST /api/workspaces/{workspace_id}/functions` - Create function
- `GET /api/workspaces/{workspace_id}/functions` - List functions

### Logs
- `GET /api/workspaces/{workspace_id}/functions/{function_id}/logs` - Get execution logs

## Python Code Format (Spin Applications)

When uploading Python code for build, use the Spin Python SDK format:

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

## Integration

### Builder Service
- **URL**: https://builder.eunha.icu
- **Docs**: https://builder.eunha.icu/docs
- **Integration Method**: HTTP REST API with polling
- **Polling Interval**: 5 seconds
- **Timeout**: 10 minutes (120 attempts)

### Kubernetes
- **SpinApp Deployment**: Via Builder Service `/api/v1/deploy`
- **Function Labels**: `function_id` for log filtering
- **Autoscaling**: HPA/KEDA support
- **Spot Instances**: Optional spot instance scheduling

### AWS Services
- **DynamoDB**: Task status tracking
- **S3**: Build source and artifact storage
- **ECR**: Container image registry
- **IRSA**: ECR authentication (no credentials needed)

## Troubleshooting

### Build Fails with "IncomingHandler" Error
**Solution**: Use the correct Spin Python format (see Python Code Format section above)

### ECR Push Timeout
**Solution**: Verify IRSA is configured on Builder Service. If using token-based auth, ensure valid ECR password is provided.

### Deploy Fails with Namespace Not Found
**Solution**: Create the namespace first:
```bash
kubectl create namespace <namespace>
```

---

**Last Updated**: 2025-12-06
**Maintainer**: Sungwoo Choi
