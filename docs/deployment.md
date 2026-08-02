# Deployment Guide

Guide for deploying NestJS Enterprise Boilerplate to production.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Docker Deployment](#docker-deployment)
3. [Kubernetes Deployment](#kubernetes-deployment)
4. [Cloud Platforms](#cloud-platforms)
5. [CI/CD Pipeline](#cicd-pipeline)
6. [Environment Configuration](#environment-configuration)
7. [Database Migration](#database-migration)
8. [Monitoring](#monitoring)
9. [Security Checklist](#security-checklist)

---

## Prerequisites

### Production Requirements

| Component | Minimum | Recommended |
| --------- | ------- | ----------- |
| CPU       | 1 core  | 2+ cores    |
| RAM       | 512 MB  | 1+ GB       |
| Storage   | 1 GB    | 10+ GB      |
| Node.js   | 24.x    | Latest 24.x |

### Required Services

- PostgreSQL 16+, MongoDB 6+, or another configured database
- Redis 7+ (required for Bull queues and realtime event fan-out)
- SMTP server (for emails)
- S3-compatible storage (optional)

---

## Docker Deployment

### Build Image

```bash
# Build production image
docker build -t nestjs-app:latest .

# Build with specific tag
docker build -t nestjs-app:v1.0.0 .
```

### Dockerfile

The committed [`Dockerfile`](../Dockerfile) is the source of truth. Its stages are:

| Stage     | Purpose                                                         |
| --------- | --------------------------------------------------------------- |
| `deps`    | Install pinned pnpm dependencies and generate the Prisma client |
| `builder` | Compile all entrypoints and copy email/i18n runtime assets      |
| `runner`  | Run as non-root `nestjs` with production dependencies only      |

The image defaults to the API command. Worker and scheduler services override only `command`,
so the exact same immutable image runs every role.

> The package manager is pinned (`"packageManager": "pnpm@11.18.0"`) so Corepack
> always uses pnpm — keep the committed `pnpm-lock.yaml` in that format.

### Docker Compose (Production)

The committed [`docker-compose.prod.yml`](../docker-compose.prod.yml) is the source of truth.
It defines application runtimes and expects production database and Redis endpoints through
environment variables.

| Service     | Entrypoint                    | External dependencies | Scale                    |
| ----------- | ----------------------------- | --------------------- | ------------------------ |
| `app`       | `node dist/main.js`           | Database, Redis       | `APP_REPLICAS` or more   |
| `worker`    | `node dist/main.worker.js`    | Database, Redis, SMTP | `WORKER_REPLICAS`        |
| `scheduler` | `node dist/main.scheduler.js` | Redis                 | Exactly one              |
| `nginx`     | Nginx reverse proxy           | API                   | Optional `proxy` profile |

Use managed or separately operated PostgreSQL/Redis in production. Unlike the development
Compose file, the production Compose file intentionally does not provision them.

All three Nest runtimes reference the same `APP_IMAGE:APP_IMAGE_TAG`. They are separate
containers—not three processes in one container—and can be scheduled on different hosts.
Compose enforces independent limits through `API_CPUS`/`API_MEMORY_LIMIT`,
`WORKER_CPUS`/`WORKER_MEMORY_LIMIT`, and `SCHEDULER_CPUS`/`SCHEDULER_MEMORY_LIMIT`.

### Run with Docker Compose

```bash
# Start services
docker compose -f docker-compose.prod.yml up -d

# View all three application runtimes
docker compose -f docker-compose.prod.yml logs -f app worker scheduler

# Scale API and workers independently. Do not scale scheduler above one.
docker compose -f docker-compose.prod.yml up -d --scale app=3
docker compose -f docker-compose.prod.yml up -d --scale worker=5

# Stop services
docker compose -f docker-compose.prod.yml down
```

The production image contains three entrypoints:

| Runtime   | Command                       | Scaling rule        |
| --------- | ----------------------------- | ------------------- |
| API       | `node dist/main.js`           | Multiple replicas   |
| Worker    | `node dist/main.worker.js`    | Multiple replicas   |
| Scheduler | `node dist/main.scheduler.js` | Exactly one replica |

API instances only enqueue jobs. Workers consume them, while the scheduler owns
all cron registration. In-app notification results are published through the
Redis channel configured by `QUEUE_REALTIME_CHANNEL`; every API replica subscribes
and delivers the event to its locally connected WebSocket clients.

---

## Kubernetes Deployment

The repository documents the required manifests but does not currently ship a `k8s/`
directory. Build manifests for three separate workloads from the topology below. All three
use the same image but have different commands and scaling rules.

### Deployment Manifest

```yaml
# Example: k8s/api-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: nestjs-api
  labels:
    app: nestjs-api
spec:
  replicas: 3
  selector:
    matchLabels:
      app: nestjs-api
  template:
    metadata:
      labels:
        app: nestjs-api
    spec:
      containers:
        - name: nestjs-api
          image: your-registry/nestjs-app:latest
          ports:
            - containerPort: 3000
          envFrom:
            - configMapRef:
                name: nestjs-app-config
            - secretRef:
                name: nestjs-app-secrets
          resources:
            requests:
              cpu: '250m'
              memory: '256Mi'
            limits:
              cpu: '1000m'
              memory: '1Gi'
          livenessProbe:
            httpGet:
              path: /api/v1/health/live
              port: 3000
            initialDelaySeconds: 30
            periodSeconds: 10
          readinessProbe:
            httpGet:
              path: /api/v1/health/ready
              port: 3000
            initialDelaySeconds: 5
            periodSeconds: 5
          startupProbe:
            httpGet:
              path: /api/v1/health/startup
              port: 3000
            failureThreshold: 30
            periodSeconds: 10
```

### Worker and Scheduler Deployments

Use the same image and shared configuration, but override the command. Workers may scale
horizontally; the cron scheduler must remain a singleton.

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: nestjs-worker
spec:
  replicas: 2
  selector:
    matchLabels:
      app: nestjs-worker
  template:
    metadata:
      labels:
        app: nestjs-worker
    spec:
      containers:
        - name: worker
          image: your-registry/nestjs-app:latest
          command: ['node', 'dist/main.worker.js']
          envFrom:
            - configMapRef:
                name: nestjs-app-config
            - secretRef:
                name: nestjs-app-secrets
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: nestjs-scheduler
spec:
  replicas: 1
  selector:
    matchLabels:
      app: nestjs-scheduler
  template:
    metadata:
      labels:
        app: nestjs-scheduler
    spec:
      containers:
        - name: scheduler
          image: your-registry/nestjs-app:latest
          command: ['node', 'dist/main.scheduler.js']
          envFrom:
            - configMapRef:
                name: nestjs-app-config
            - secretRef:
                name: nestjs-app-secrets
```

### Service

```yaml
# k8s/service.yaml
apiVersion: v1
kind: Service
metadata:
  name: nestjs-app
spec:
  selector:
    app: nestjs-api
  ports:
    - port: 80
      targetPort: 3000
  type: ClusterIP
```

### Ingress

```yaml
# k8s/ingress.yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: nestjs-app
  annotations:
    kubernetes.io/ingress.class: nginx
    cert-manager.io/cluster-issuer: letsencrypt-prod
spec:
  tls:
    - hosts:
        - api.example.com
      secretName: nestjs-app-tls
  rules:
    - host: api.example.com
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: nestjs-app
                port:
                  number: 80
```

### ConfigMap

```yaml
# k8s/configmap.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: nestjs-app-config
data:
  NODE_ENV: 'production'
  APP_PORT: '3000'
  API_PREFIX: 'api'
  # Numeric only — URI versioning prepends "v" (1 -> /api/v1)
  API_VERSION: '1'
  DB_HOST: 'postgres-service'
  DB_PORT: '5432'
  REDIS_HOST: 'redis-service'
  REDIS_PORT: '6379'
  QUEUE_REALTIME_CHANNEL: 'app:realtime'
```

### Secrets

```yaml
# k8s/secrets.yaml
apiVersion: v1
kind: Secret
metadata:
  name: nestjs-app-secrets
type: Opaque
stringData:
  DB_DATABASE: 'app_db'
  DB_USERNAME: 'postgres'
  DB_PASSWORD: 'your-secure-password'
  JWT_SECRET: 'your-jwt-secret'
```

### Deploy to Kubernetes

```bash
# Apply configurations
kubectl apply -f <your-manifest-directory>/

# Check deployment status
kubectl get deployments
kubectl get pods
kubectl get services

# View logs
kubectl logs -f deployment/nestjs-api
kubectl logs -f deployment/nestjs-worker

# Scale deployment
kubectl scale deployment nestjs-api --replicas=5
kubectl scale deployment nestjs-worker --replicas=5
```

---

## Cloud Platforms

### AWS (ECS/Fargate)

1. Push image to ECR:

```bash
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin <account>.dkr.ecr.us-east-1.amazonaws.com
docker tag nestjs-app:latest <account>.dkr.ecr.us-east-1.amazonaws.com/nestjs-app:latest
docker push <account>.dkr.ecr.us-east-1.amazonaws.com/nestjs-app:latest
```

2. Create ECS task definition and service
3. Configure ALB for load balancing
4. Set up RDS for PostgreSQL
5. Set up ElastiCache for Redis

### Google Cloud (Cloud Run)

```bash
# Build and push to GCR
gcloud builds submit --tag gcr.io/PROJECT_ID/nestjs-app

# Deploy to Cloud Run
gcloud run deploy nestjs-app \
  --image gcr.io/PROJECT_ID/nestjs-app \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars "NODE_ENV=production"
```

### Azure (Container Apps)

```bash
# Login to Azure Container Registry
az acr login --name myregistry

# Build and push
docker build -t myregistry.azurecr.io/nestjs-app:latest .
docker push myregistry.azurecr.io/nestjs-app:latest

# Deploy to Container Apps
az containerapp create \
  --name nestjs-app \
  --resource-group mygroup \
  --environment myenv \
  --image myregistry.azurecr.io/nestjs-app:latest \
  --target-port 3000 \
  --ingress external
```

### DigitalOcean (App Platform)

1. Connect GitHub repository
2. Configure build settings
3. Set environment variables
4. Deploy

---

## CI/CD Pipeline

### GitHub Actions

```yaml
# .github/workflows/cd.yml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - name: Setup pnpm
        uses: pnpm/action-setup@v4
        with:
          version: 11.18.0

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '24'
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Run tests
        run: pnpm test

      - name: Build
        run: pnpm build

      - name: Build Docker image
        run: docker build -t ${{ secrets.REGISTRY }}/nestjs-app:${{ github.sha }} .

      - name: Push to registry
        run: |
          echo ${{ secrets.REGISTRY_PASSWORD }} | docker login -u ${{ secrets.REGISTRY_USERNAME }} --password-stdin ${{ secrets.REGISTRY }}
          docker push ${{ secrets.REGISTRY }}/nestjs-app:${{ github.sha }}

      - name: Deploy to Kubernetes
        uses: azure/k8s-deploy@v4
        with:
          manifests: <your-manifest-directory>/
          images: ${{ secrets.REGISTRY }}/nestjs-app:${{ github.sha }}
```

---

## Environment Configuration

### Production Environment Variables

```env
# Application
NODE_ENV=production
APP_PORT=3000
APP_NAME=nestjs-app
API_PREFIX=api
# Numeric only — URI versioning prepends "v" (1 -> /api/v1)
API_VERSION=1

# Security
JWT_SECRET=generate-strong-random-string-minimum-32-chars
JWT_ACCESS_TOKEN_EXPIRES_IN=15m
JWT_REFRESH_TOKEN_EXPIRES_IN=7d
CORS_ORIGINS=https://app.example.com,https://admin.example.com

# Database
DB_TYPE=postgres
DB_HOST=postgres.example.com
DB_PORT=5432
DB_DATABASE=app_production
DB_USERNAME=app_user
DB_PASSWORD=secure-password
DB_SSL=true

# Redis
REDIS_HOST=redis.example.com
REDIS_PORT=6379
REDIS_PASSWORD=redis-password
QUEUE_REALTIME_CHANNEL=app:realtime

# Logging
LOG_LEVEL=info
LOG_FORMAT=json

# Rate Limiting
THROTTLE_GLOBAL_TTL=60000
THROTTLE_GLOBAL_LIMIT=100
THROTTLE_STORAGE=redis
```

### Secrets Management

Use environment-specific secret management:

- **AWS**: Secrets Manager / Parameter Store
- **GCP**: Secret Manager
- **Azure**: Key Vault
- **Kubernetes**: External Secrets Operator

---

## Database Migration

### Pre-deployment

```bash
# Run migrations before deploying new version
pnpm migration:run

# Or in Docker
docker run --rm \
  -e DB_HOST=... \
  -e DB_USERNAME=... \
  -e DB_PASSWORD=... \
  -e DB_DATABASE=... \
  nestjs-app:latest \
  pnpm migration:run
```

### Kubernetes Job

```yaml
# k8s/migration-job.yaml
apiVersion: batch/v1
kind: Job
metadata:
  name: db-migration
spec:
  template:
    spec:
      containers:
        - name: migration
          image: your-registry/nestjs-app:latest
          command: ['pnpm', 'migration:run']
          envFrom:
            - secretRef:
                name: nestjs-app-secrets
      restartPolicy: Never
  backoffLimit: 3
```

---

## Monitoring

### Health Endpoints

| Endpoint                 | Purpose                                     |
| ------------------------ | ------------------------------------------- |
| `/api/v1/health/live`    | Liveness probe - is app running?            |
| `/api/v1/health/ready`   | Readiness probe - is app ready for traffic? |
| `/api/v1/health/startup` | Startup probe - has app finished starting?  |
| `/api/v1/health/deep`    | Deep check - detailed dependency status     |

### Metrics

Prometheus metrics available at `/api/v1/metrics`:

- `http_requests_total` - Total HTTP requests
- `http_request_duration_seconds` - Request duration
- `nodejs_heap_size_bytes` - Memory usage
- `database_query_duration_seconds` - DB query time

### Logging

Structured JSON logs for log aggregation:

```json
{
  "level": "info",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "context": "UserController",
  "message": "User created",
  "requestId": "req_abc123",
  "userId": "user-uuid",
  "duration": 45
}
```

### Recommended Tools

- **Metrics**: Prometheus + Grafana
- **Logging**: ELK Stack / Loki
- **Tracing**: Jaeger / Zipkin
- **APM**: New Relic / Datadog

---

## Security Checklist

### Before Deployment

- [ ] Change all default secrets
- [ ] Enable HTTPS only
- [ ] Configure CORS properly
- [ ] Enable rate limiting
- [ ] Review security headers (Helmet)
- [ ] Disable debug mode
- [ ] Remove development dependencies
- [ ] Scan for vulnerabilities (`pnpm audit`)

### Environment

- [ ] Use secrets manager for credentials
- [ ] Enable database SSL
- [ ] Use private networks
- [ ] Configure firewall rules
- [ ] Enable WAF if available

### Application

- [ ] JWT secrets are strong (32+ chars)
- [ ] Passwords are hashed (bcrypt)
- [ ] Input validation enabled
- [ ] SQL injection protected (ORM)
- [ ] XSS protection enabled

### Monitoring

- [ ] Health checks configured
- [ ] Logging enabled
- [ ] Error tracking enabled
- [ ] Alerts configured
- [ ] Backup strategy in place

---

## Rollback Strategy

### Docker

```bash
# Keep previous image tags
docker tag nestjs-app:latest nestjs-app:previous

# Rollback
docker compose -f docker-compose.prod.yml down
docker tag nestjs-app:previous nestjs-app:latest
docker compose -f docker-compose.prod.yml up -d
```

### Kubernetes

```bash
# View rollout history
kubectl rollout history deployment/nestjs-api

# Rollback to previous version
kubectl rollout undo deployment/nestjs-api

# Rollback to specific revision
kubectl rollout undo deployment/nestjs-api --to-revision=2
```

### Database

```bash
# Revert last migration
pnpm migration:revert
```
