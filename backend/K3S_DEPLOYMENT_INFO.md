# K3s Deployment Information

## ECR Image

**Repository**: faas-backend
**Image URL**: `217350599014.dkr.ecr.ap-northeast-2.amazonaws.com/faas-backend:latest`
**Region**: ap-northeast-2 (Seoul)
**Latest Digest**: sha256:59f067f2db499d50838b6bab689bf2b5d92c8078fb17195cd6004aa4a4120ac9

---

## Container Configuration

### Port
- **Container Port**: 8000
- **Protocol**: HTTP

### Health Check
- **Endpoint**: `GET /health`
- **Expected Response**: `{"status":"healthy"}`
- **Readiness Probe**: `GET /health`
- **Liveness Probe**: `GET /health`

### API Documentation
- **Swagger UI**: `GET /docs`
- **ReDoc**: `GET /redoc`
- **OpenAPI JSON**: `GET /openapi.json`

---

## Environment Variables

### Required (K8s ConfigMap/Secret)

```yaml
# AWS Configuration
AWS_REGION: ap-northeast-2

# AWS Resources
DYNAMODB_TABLE_NAME: sfbank-blue-FaaSData
S3_BUCKET_NAME: sfbank-blue-functions-code-bucket

# Application Settings
ENVIRONMENT: production
LOG_LEVEL: INFO

# CORS (Optional - adjust for production frontend URL)
# CORS_ORIGINS: ["https://your-frontend-domain.com"]
```

### Authentication
- **Local Development**: Uses AWS Access Keys from `.env` file
- **K3s Production**: Uses IAM Role (`blue-final-k3s-worker`)
  - **No AWS_ACCESS_KEY_ID or AWS_SECRET_ACCESS_KEY needed in K3s**
  - Pod automatically assumes IAM Role via IRSA (IAM Roles for Service Accounts)

---

## IAM Role Permissions

### Required IAM Policies for `blue-final-k3s-worker` Role

#### DynamoDB Policy
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "dynamodb:GetItem",
        "dynamodb:PutItem",
        "dynamodb:UpdateItem",
        "dynamodb:DeleteItem",
        "dynamodb:Query",
        "dynamodb:Scan"
      ],
      "Resource": "arn:aws:dynamodb:ap-northeast-2:217350599014:table/sfbank-blue-FaaSData"
    }
  ]
}
```

#### S3 Policy
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:GetObject",
        "s3:PutObject",
        "s3:DeleteObject"
      ],
      "Resource": "arn:aws:s3:::sfbank-blue-functions-code-bucket/*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "s3:ListBucket"
      ],
      "Resource": "arn:aws:s3:::sfbank-blue-functions-code-bucket"
    }
  ]
}
```

---

## Sample K8s Deployment YAML

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: faas-backend
  namespace: default
spec:
  replicas: 2
  selector:
    matchLabels:
      app: faas-backend
  template:
    metadata:
      labels:
        app: faas-backend
    spec:
      serviceAccountName: blue-final-k3s-worker  # IAM Role 연동
      containers:
      - name: faas-backend
        image: 217350599014.dkr.ecr.ap-northeast-2.amazonaws.com/faas-backend:latest
        imagePullPolicy: Always
        ports:
        - containerPort: 8000
          protocol: TCP
        env:
        - name: AWS_REGION
          value: "ap-northeast-2"
        - name: DYNAMODB_TABLE_NAME
          value: "sfbank-blue-FaaSData"
        - name: S3_BUCKET_NAME
          value: "sfbank-blue-functions-code-bucket"
        - name: ENVIRONMENT
          value: "production"
        - name: LOG_LEVEL
          value: "INFO"
        livenessProbe:
          httpGet:
            path: /health
            port: 8000
          initialDelaySeconds: 10
          periodSeconds: 30
        readinessProbe:
          httpGet:
            path: /health
            port: 8000
          initialDelaySeconds: 5
          periodSeconds: 10
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"

---
apiVersion: v1
kind: Service
metadata:
  name: faas-backend
  namespace: default
spec:
  selector:
    app: faas-backend
  ports:
  - port: 80
    targetPort: 8000
    protocol: TCP
  type: LoadBalancer  # or ClusterIP for internal access
```

---

## API Endpoints

### Workspaces
- `POST /api/workspaces` - Create workspace
- `GET /api/workspaces` - List workspaces
- `GET /api/workspaces/{id}` - Get workspace details
- `PATCH /api/workspaces/{id}` - Update workspace
- `DELETE /api/workspaces/{id}` - Delete workspace

### Functions
- `POST /api/workspaces/{workspace_id}/functions` - Create function
- `GET /api/workspaces/{workspace_id}/functions` - List functions in workspace
- `GET /api/functions/{id}` - Get function details
- `PATCH /api/functions/{id}` - Update function
- `DELETE /api/functions/{id}` - Delete function

### Execution Logs
- `GET /api/functions/{id}/logs?limit=100` - Get function execution logs

---

## Database Schema

### DynamoDB Table: `sfbank-blue-FaaSData`

**Table Type**: Single Table Design
**Partition Key**: PK (String)
**Sort Key**: SK (String)

#### Access Patterns

**Workspace**:
- PK: `WS#{workspace_id}`
- SK: `METADATA`

**Function**:
- PK: `WS#{workspace_id}`
- SK: `FN#{function_id}`

**Execution Log**:
- PK: `FN#{function_id}`
- SK: `LOG#{timestamp}#{log_id}`

---

## S3 Bucket: `sfbank-blue-functions-code-bucket`

**Purpose**: Store Python function code (Base64 encoded)

**File Path Structure**:
```
s3://sfbank-blue-functions-code-bucket/
  ├── {workspace_id}/
  │   ├── {function_id}/
  │   │   └── code.py
```

**Example**:
```
s3://sfbank-blue-functions-code-bucket/
  ├── ws_abc123/
  │   ├── fn_xyz789/
  │   │   └── code.py  (decoded from Base64)
```

---

## Deployment Checklist

- [ ] ECR image accessible from K3s worker nodes
- [ ] IAM Role `blue-final-k3s-worker` has DynamoDB + S3 permissions
- [ ] K8s Service Account configured with IAM Role annotation
- [ ] Environment variables set in K8s ConfigMap
- [ ] DynamoDB table `sfbank-blue-FaaSData` created
- [ ] S3 bucket `sfbank-blue-functions-code-bucket` created
- [ ] Load Balancer or Ingress configured (optional)
- [ ] Health check passing: `curl http://<service-url>/health`

---

## Testing After Deployment

### 1. Health Check
```bash
curl http://<k3s-service-url>/health
# Expected: {"status":"healthy"}
```

### 2. API Documentation
```bash
open http://<k3s-service-url>/docs
```

### 3. Create Test Workspace
```bash
curl -X POST http://<k3s-service-url>/api/workspaces \
  -H "Content-Type: application/json" \
  -d '{"name":"test","description":"Test workspace"}'
```

### 4. Verify DynamoDB
- Check AWS Console → DynamoDB → `sfbank-blue-FaaSData` table
- Should see new item with PK=`WS#{id}`

---

## Troubleshooting

### Pod not starting
- Check logs: `kubectl logs -f deployment/faas-backend`
- Check IAM Role permissions
- Verify ECR image pull access

### 5xx errors on API calls
- Check CloudWatch logs (if configured)
- Verify DynamoDB/S3 connectivity
- Check IAM Role permissions

### Health check failing
- Verify port 8000 is accessible
- Check pod logs for startup errors
- Ensure environment variables are set correctly
