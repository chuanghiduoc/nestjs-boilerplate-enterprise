# API Guide

Complete guide for REST, GraphQL, and WebSocket APIs.

## Table of Contents

1. [REST API](#rest-api)
2. [GraphQL API](#graphql-api)
3. [WebSocket API](#websocket-api)
4. [Authentication](#authentication)
5. [Error Handling](#error-handling)
6. [Rate Limiting](#rate-limiting)

---

## REST API

### Base URL

```
http://localhost:3000/api/v1
```

### Response Format

All responses follow a consistent envelope format:

#### Success Response

```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "user@example.com",
    "firstName": "John",
    "lastName": "Doe"
  }
}
```

#### Error Response

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed",
    "details": [{ "field": "email", "message": "must be a valid email", "code": "isEmail" }],
    "timestamp": "2026-01-15T10:30:00.000Z",
    "path": "/api/v1/users",
    "requestId": "req_abc123"
  }
}
```

#### Paginated Response

```json
{
  "success": true,
  "data": [...],
  "meta": {
    "pagination": {
      "page": 1,
      "limit": 20,
      "totalItems": 150,
      "totalPages": 8,
      "hasNextPage": true,
      "hasPrevPage": false
    }
  }
}
```

### Pagination

Use query parameters for pagination:

```bash
GET /api/v1/users?page=1&limit=20
GET /api/v1/users?page=2&limit=50
```

### Sorting

```bash
GET /api/v1/users?sortBy=createdAt&sortOrder=desc
GET /api/v1/users?sortBy=email&sortOrder=asc
```

### Filtering

```bash
GET /api/v1/users?status=active
GET /api/v1/users?email=john@example.com
GET /api/v1/users?tenantId=tenant-uuid
```

---

## API Endpoints

### Authentication

| Method | Endpoint                | Description       | Auth |
| ------ | ----------------------- | ----------------- | ---- |
| POST   | `/auth/register`        | Register new user | No   |
| POST   | `/auth/login`           | Login             | No   |
| POST   | `/auth/refresh`         | Refresh token     | No   |
| POST   | `/auth/logout`          | Logout            | Yes  |
| POST   | `/auth/forgot-password` | Request reset     | No   |
| POST   | `/auth/reset-password`  | Reset password    | No   |
| GET    | `/auth/verify-email`    | Verify email      | No   |
| GET    | `/auth/google`          | Google OAuth      | No   |
| GET    | `/auth/facebook`        | Facebook OAuth    | No   |

#### Register

```bash
curl -X POST http://localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "Password123!",
    "firstName": "John",
    "lastName": "Doe"
  }'
```

#### Login

```bash
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "Password123!"
  }'
```

Response:

```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIs...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIs...",
    "expiresIn": 900
  }
}
```

#### Refresh Token

```bash
curl -X POST http://localhost:3000/api/v1/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{
    "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
  }'
```

### Users

| Method | Endpoint     | Description      | Auth        |
| ------ | ------------ | ---------------- | ----------- |
| GET    | `/users`     | List users       | Yes         |
| GET    | `/users/:id` | Get user by ID   | Yes         |
| GET    | `/users/me`  | Get current user | Yes         |
| POST   | `/users`     | Create user      | Yes (Admin) |
| PATCH  | `/users/:id` | Update user      | Yes         |
| DELETE | `/users/:id` | Delete user      | Yes (Admin) |

#### List Users

```bash
curl http://localhost:3000/api/v1/users \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIs..."
```

#### Get User

```bash
curl http://localhost:3000/api/v1/users/550e8400-e29b-41d4-a716-446655440000 \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIs..."
```

#### Create User

```bash
curl -X POST http://localhost:3000/api/v1/users \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIs..." \
  -H "Content-Type: application/json" \
  -d '{
    "email": "newuser@example.com",
    "password": "Password123!",
    "firstName": "Jane",
    "lastName": "Doe"
  }'
```

#### Update User

```bash
curl -X PATCH http://localhost:3000/api/v1/users/550e8400-e29b-41d4-a716-446655440000 \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIs..." \
  -H "Content-Type: application/json" \
  -d '{
    "firstName": "Johnny"
  }'
```

### Roles

| Method | Endpoint     | Description    | Auth        |
| ------ | ------------ | -------------- | ----------- |
| GET    | `/roles`     | List roles     | Yes         |
| GET    | `/roles/:id` | Get role by ID | Yes         |
| POST   | `/roles`     | Create role    | Yes (Admin) |
| PATCH  | `/roles/:id` | Update role    | Yes (Admin) |
| DELETE | `/roles/:id` | Delete role    | Yes (Admin) |

### Tenants

| Method | Endpoint       | Description      | Auth             |
| ------ | -------------- | ---------------- | ---------------- |
| GET    | `/tenants`     | List tenants     | Yes (SuperAdmin) |
| GET    | `/tenants/:id` | Get tenant by ID | Yes              |
| POST   | `/tenants`     | Create tenant    | Yes (SuperAdmin) |
| PATCH  | `/tenants/:id` | Update tenant    | Yes (Admin)      |
| DELETE | `/tenants/:id` | Delete tenant    | Yes (SuperAdmin) |

### Health

| Method | Endpoint          | Description     | Auth |
| ------ | ----------------- | --------------- | ---- |
| GET    | `/health/live`    | Liveness probe  | No   |
| GET    | `/health/ready`   | Readiness probe | No   |
| GET    | `/health/startup` | Startup probe   | No   |
| GET    | `/health/deep`    | Deep dependency check | No |

---

## GraphQL API

### Endpoint

```
http://localhost:3000/graphql
```

### Playground

GraphQL Playground is available at the same URL in development mode.

### Queries

#### Get User

```graphql
query GetUser($id: ID!) {
  user(id: $id) {
    id
    email
    firstName
    lastName
    status
    createdAt
  }
}
```

#### List Users

```graphql
query ListUsers($page: Int, $limit: Int) {
  users(page: $page, limit: $limit) {
    data {
      id
      email
      firstName
      lastName
    }
    pagination {
      page
      limit
      total
      totalPages
    }
  }
}
```

### Mutations

#### Create User

```graphql
mutation CreateUser($input: CreateUserInput!) {
  createUser(input: $input) {
    id
    email
    firstName
    lastName
  }
}
```

Variables:

```json
{
  "input": {
    "email": "user@example.com",
    "password": "Password123!",
    "firstName": "John",
    "lastName": "Doe"
  }
}
```

#### Update User

```graphql
mutation UpdateUser($id: ID!, $input: UpdateUserInput!) {
  updateUser(id: $id, input: $input) {
    id
    firstName
    lastName
    updatedAt
  }
}
```

### Authentication

Include JWT token in headers:

```json
{
  "Authorization": "Bearer eyJhbGciOiJIUzI1NiIs..."
}
```

---

## WebSocket API

### Connection

```javascript
import { io } from 'socket.io-client';

const socket = io('http://localhost:3000', {
  auth: {
    token: 'eyJhbGciOiJIUzI1NiIs...',
  },
});

socket.on('connect', () => {
  console.log('Connected');
});

socket.on('disconnect', () => {
  console.log('Disconnected');
});
```

### Events

#### Subscribe to Notifications

```javascript
// Join room
socket.emit('join', { room: 'notifications' });

// Listen for notifications
socket.on('notification', (data) => {
  console.log('New notification:', data);
});
```

#### Presence

```javascript
// Notify online status
socket.emit('presence:online');

// Listen for user status changes
socket.on('presence:status', (data) => {
  console.log(`User ${data.userId} is ${data.status}`);
});
```

### Namespaces

| Namespace        | Purpose                 |
| ---------------- | ----------------------- |
| `/`              | Default namespace       |
| `/notifications` | Real-time notifications |
| `/chat`          | Chat functionality      |

---

## Authentication

### JWT Tokens

The API uses JWT (JSON Web Tokens) for authentication:

- **Access Token**: Short-lived (15 minutes), used for API requests
- **Refresh Token**: Long-lived (7 days), used to get new access tokens

### Using Access Token

Include in Authorization header:

```bash
curl http://localhost:3000/api/v1/users \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIs..."
```

### Token Refresh

When access token expires, use refresh token to get new tokens:

```bash
curl -X POST http://localhost:3000/api/v1/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{"refreshToken": "eyJhbGciOiJIUzI1NiIs..."}'
```

### OAuth2 Flow

#### Google OAuth

1. Redirect user to: `GET /api/v1/auth/google`
2. User authenticates with Google
3. Callback to: `/api/v1/auth/google/callback`
4. Response contains access and refresh tokens

---

## Error Handling

### Error Codes

| Code               | HTTP Status | Description                   |
| ------------------ | ----------- | ----------------------------- |
| `VALIDATION_ERROR` | 400         | Request validation failed     |
| `BAD_REQUEST`      | 400         | Invalid request               |
| `UNAUTHORIZED`     | 401         | Authentication required       |
| `FORBIDDEN`        | 403         | Permission denied             |
| `NOT_FOUND`        | 404         | Resource not found            |
| `CONFLICT`         | 409         | Resource conflict (duplicate) |
| `RATE_LIMITED`     | 429         | Too many requests             |
| `INTERNAL_ERROR`   | 500         | Server error                  |

### Error Response Examples

#### Validation Error

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed",
    "details": [
      { "field": "email", "message": "must be a valid email" },
      { "field": "password", "message": "must be at least 8 characters" }
    ],
    "requestId": "req_abc123"
  }
}
```

#### Not Found

```json
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "User not found",
    "requestId": "req_def456"
  }
}
```

#### Unauthorized

```json
{
  "success": false,
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Invalid or expired token",
    "requestId": "req_ghi789"
  }
}
```

---

## Rate Limiting

### Default Limits

| Endpoint                | Limit        | Window   |
| ----------------------- | ------------ | -------- |
| `/auth/login`           | 5 requests   | 1 minute |
| `/auth/register`        | 3 requests   | 1 minute |
| `/auth/forgot-password` | 3 requests   | 1 hour   |
| All other endpoints     | 100 requests | 1 minute |

### Rate Limit Headers

Responses include rate limit information:

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1640000000
```

### Rate Limited Response

```json
{
  "success": false,
  "error": {
    "code": "RATE_LIMITED",
    "message": "Too many requests, please try again later",
    "retryAfter": 60
  }
}
```

---

## Swagger Documentation

Interactive API documentation is available at (non-production environments only):

```
http://localhost:3000/docs
```

Features:

- Browse all endpoints
- View request/response schemas
- Try out API calls directly
- Download OpenAPI spec
