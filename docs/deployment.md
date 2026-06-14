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

| Component | Minimum  | Recommended |
| --------- | -------- | ----------- |
| CPU       | 1 core   | 2+ cores    |
| RAM       | 512 MB   | 1+ GB       |
| Storage   | 1 GB     | 10+ GB      |
| Node.js   | 20.x LTS | Latest LTS  |

### Required Services

- PostgreSQL 14+ or MongoDB 6+
- Redis 6+ (for caching/sessions)
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

The repository ships a production-ready multi-stage `Dockerfile`. Key points:

```dockerfile
# Stage 1: dependencies (Prisma client is generated via postinstall)
FROM node:20-alpine AS deps
WORKDIR /app
RUN apk add --no-cache openssl            # required by Prisma's engine
COPY package.json yarn.lock ./
COPY prisma ./prisma                       # schema must be present for "prisma generate"
RUN yarn install --frozen-lockfile --production=false

# Stage 2: builder (nest-cli bundles i18n/email assets into dist)
FROM node:20-alpine AS builder
WORKDIR /app
RUN apk add --no-cache openssl
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN yarn build
RUN yarn install --frozen-lockfile --production=true && yarn cache clean

# Stage 3: runner (non-root, runtime assets already inside dist)
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
RUN apk add --no-cache openssl
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nestjs
COPY --from=builder --chown=nestjs:nodejs /app/dist ./dist
COPY --from=builder --chown=nestjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nestjs:nodejs /app/package.json ./package.json
RUN mkdir -p /app/uploads && chown nestjs:nodejs /app/uploads   # local storage driver

EXPOSE 3000

# Health check — use 127.0.0.1 (localhost may resolve to IPv6 ::1, but the
# server binds to IPv4 0.0.0.0). The probe targets the versioned liveness route.
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:3000/api/v1/health/live || exit 1

USER nestjs
CMD ["node", "dist/main.js"]
```

> The package manager is pinned (`"packageManager": "yarn@1.22.22"`) so Corepack
> always uses Yarn Classic — keep the committed `yarn.lock` in that format.

### Docker Compose (Production)

```yaml
# docker-compose.prod.yml
version: '3.8'

services:
  app:
    build:
      context: .
      dockerfile: Dockerfile
    ports:
      - '3000:3000'
    environment:
      - NODE_ENV=production
      - DB_HOST=postgres
      - DB_PORT=5432
      - DB_DATABASE=${DB_DATABASE}
      - DB_USERNAME=${DB_USERNAME}
      - DB_PASSWORD=${DB_PASSWORD}
      - REDIS_HOST=redis
      - REDIS_PORT=6379
      - JWT_SECRET=${JWT_SECRET}
      - JWT_REFRESH_SECRET=${JWT_REFRESH_SECRET}
    depends_on:
      - postgres
      - redis
    restart: unless-stopped
    deploy:
      replicas: 2
      resources:
        limits:
          cpus: '1'
          memory: 1G

  postgres:
    image: postgres:16-alpine
    environment:
      - POSTGRES_DB=${DB_DATABASE}
      - POSTGRES_USER=${DB_USERNAME}
      - POSTGRES_PASSWORD=${DB_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    command: redis-server --appendonly yes
    volumes:
      - redis_data:/data
    restart: unless-stopped

  nginx:
    image: nginx:alpine
    ports:
      - '80:80'
      - '443:443'
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
      - ./ssl:/etc/nginx/ssl:ro
    depends_on:
      - app
    restart: unless-stopped

volumes:
  postgres_data:
  redis_data:
```

### Run with Docker Compose

```bash
# Start services
docker-compose -f docker-compose.prod.yml up -d

# View logs
docker-compose -f docker-compose.prod.yml logs -f app

# Scale application
docker-compose -f docker-compose.prod.yml up -d --scale app=3

# Stop services
docker-compose -f docker-compose.prod.yml down
```

---

## Kubernetes Deployment

### Deployment Manifest

```yaml
# k8s/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: nestjs-app
  labels:
    app: nestjs-app
spec:
  replicas: 3
  selector:
    matchLabels:
      app: nestjs-app
  template:
    metadata:
      labels:
        app: nestjs-app
    spec:
      containers:
        - name: nestjs-app
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

### Service

```yaml
# k8s/service.yaml
apiVersion: v1
kind: Service
metadata:
  name: nestjs-app
spec:
  selector:
    app: nestjs-app
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
  PORT: '3000'
  API_PREFIX: 'api'
  # Numeric only — URI versioning prepends "v" (1 -> /api/v1)
  API_VERSION: '1'
  DB_HOST: 'postgres-service'
  DB_PORT: '5432'
  REDIS_HOST: 'redis-service'
  REDIS_PORT: '6379'
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
  JWT_REFRESH_SECRET: 'your-refresh-secret'
```

### Deploy to Kubernetes

```bash
# Apply configurations
kubectl apply -f k8s/

# Check deployment status
kubectl get deployments
kubectl get pods
kubectl get services

# View logs
kubectl logs -f deployment/nestjs-app

# Scale deployment
kubectl scale deployment nestjs-app --replicas=5
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

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'yarn'

      - name: Install dependencies
        run: yarn install --frozen-lockfile

      - name: Run tests
        run: yarn test

      - name: Build
        run: yarn build

      - name: Build Docker image
        run: docker build -t ${{ secrets.REGISTRY }}/nestjs-app:${{ github.sha }} .

      - name: Push to registry
        run: |
          echo ${{ secrets.REGISTRY_PASSWORD }} | docker login -u ${{ secrets.REGISTRY_USERNAME }} --password-stdin ${{ secrets.REGISTRY }}
          docker push ${{ secrets.REGISTRY }}/nestjs-app:${{ github.sha }}

      - name: Deploy to Kubernetes
        uses: azure/k8s-deploy@v4
        with:
          manifests: k8s/
          images: ${{ secrets.REGISTRY }}/nestjs-app:${{ github.sha }}
```

---

## Environment Configuration

### Production Environment Variables

```env
# Application
NODE_ENV=production
PORT=3000
APP_NAME=nestjs-app
API_PREFIX=api
# Numeric only — URI versioning prepends "v" (1 -> /api/v1)
API_VERSION=1

# Security
JWT_SECRET=generate-strong-random-string-minimum-32-chars
JWT_EXPIRES_IN=15m
JWT_REFRESH_SECRET=another-strong-random-string
JWT_REFRESH_EXPIRES_IN=7d
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
REDIS_TLS=true

# Logging
LOG_LEVEL=info
LOG_FORMAT=json

# Rate Limiting
THROTTLE_TTL=60
THROTTLE_LIMIT=100
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
yarn migration:run

# Or in Docker
docker run --rm \
  -e DB_HOST=... \
  -e DB_USERNAME=... \
  -e DB_PASSWORD=... \
  -e DB_DATABASE=... \
  nestjs-app:latest \
  yarn migration:run
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
          command: ['yarn', 'migration:run']
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
- [ ] Scan for vulnerabilities (`yarn audit`)

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
docker-compose -f docker-compose.prod.yml down
docker tag nestjs-app:previous nestjs-app:latest
docker-compose -f docker-compose.prod.yml up -d
```

### Kubernetes

```bash
# View rollout history
kubectl rollout history deployment/nestjs-app

# Rollback to previous version
kubectl rollout undo deployment/nestjs-app

# Rollback to specific revision
kubectl rollout undo deployment/nestjs-app --to-revision=2
```

### Database

```bash
# Revert last migration
yarn migration:revert
```
