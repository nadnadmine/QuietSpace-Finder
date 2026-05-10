# API Specification - API Gateway

> File: paths/gateway.md
> Owner: QuietSpace Finder — API Gateway
> Last Updated: 2025-01-01
> Service: api-gateway (Node.js / Express.js)
> Base URL: / (entry point for all services)

---

## GET /health

### Title

> Gateway and upstream service health check

### Description

Returns the health status of the API Gateway itself and the connectivity status of all upstream services. Used by deployment pipelines, load balancers, and monitoring systems to verify service availability.

---

### Authentication / Authorization

| Field         | Value  |
| ------------- | ------ |
| Auth Required | No     |
| Role(s)       | -      |
| Notes         | Public endpoint; do not expose detailed internal error messages on production |

---

### Path Parameters

None.

---

### Query Parameters

None.

---

### Request Body (JSON)

None - no request body.

---

### Responses

#### Success - 200 OK (all services healthy)

```json
{
  "message": "All services healthy",
  "data": {
    "gateway": {
      "status": "healthy",
      "uptime_seconds": 86400,
      "timestamp": "2025-01-05T12:00:00.000Z"
    },
    "services": {
      "auth-service": {
        "status": "healthy",
        "response_time_ms": 12,
        "url": "http://auth-service:3001"
      },
      "place-service": {
        "status": "healthy",
        "response_time_ms": 18,
        "url": "http://place-service:3002"
      },
      "notification-service": {
        "status": "healthy",
        "response_time_ms": 22,
        "url": "http://notification-service:8080"
      },
      "rabbitmq": {
        "status": "healthy"
      }
    }
  },
  "error": null
}
```

#### Partial Degradation - 200 OK (some services down)

```json
{
  "message": "Some services degraded",
  "data": {
    "gateway": { "status": "healthy", "uptime_seconds": 86400, "timestamp": "2025-01-05T12:00:00.000Z" },
    "services": {
      "auth-service": { "status": "healthy", "response_time_ms": 12 },
      "place-service": { "status": "healthy", "response_time_ms": 18 },
      "notification-service": { "status": "unhealthy", "error": "Connection refused" },
      "rabbitmq": { "status": "healthy" }
    }
  },
  "error": null
}
```

---

#### Error Responses

**503 Service Unavailable** (critical services down)

```json
{
  "message": "Critical service unavailable",
  "data": null,
  "error": { "code": "SERVICE_UNAVAILABLE" }
}
```

---

### Notes (Business Rules)

- [ ] The gateway performs a lightweight ping (HTTP HEAD or `/health` probe) to each upstream service
- [ ] Returns 200 even if non-critical services (e.g. notification-service) are down, to avoid false positives
- [ ] Returns 503 only if `auth-service` or `place-service` are unreachable

---

## GET /api

### Title

> Gateway API information

### Description

Returns metadata about the API, including the current version, available service routes, and documentation links.

---

### Authentication / Authorization

| Field         | Value  |
| ------------- | ------ |
| Auth Required | No     |
| Role(s)       | -      |
| Notes         | Public |

---

### Path Parameters

None.

---

### Query Parameters

None.

---

### Request Body (JSON)

None - no request body.

---

### Responses

#### Success - 200 OK

```json
{
  "message": "QuietSpace Finder API",
  "data": {
    "version": "1.0.0",
    "description": "Backend API for QuietSpace Finder — find and report quiet places",
    "routes": {
      "/api/auth":          "Auth Service — authentication, OAuth, JWT",
      "/api/users":         "Auth Service — user profile management",
      "/api/places":        "Place Service — place CRUD, search, recommendations",
      "/api/bookmarks":     "Place Service — user bookmarks",
      "/api/tags":          "Place Service — place tags",
      "/api/notifications": "Notification Service — inbox, preferences"
    },
    "docs_url": "https://github.com/your-org/quietspace-finder#readme"
  },
  "error": null
}
```

---

#### Error Responses

**500 Internal Server Error**

```json
{
  "message": "Internal server error",
  "data": null,
  "error": { "code": "INTERNAL_ERROR" }
}
```

---

### Notes (Business Rules)

- [ ] Route map is static and reflects the gateway's proxy configuration

---

## Gateway Middleware Behaviors

The following behaviors are enforced by the gateway for **all proxied requests** and are documented here rather than duplicated on every endpoint.

---

### Rate Limiting

The gateway applies rate limiting per client IP address using a sliding window algorithm.

| Tier         | Limit                     | Window    | Applies To                     |
| ------------ | ------------------------- | --------- | ------------------------------ |
| Global       | 300 requests              | 1 minute  | All routes                     |
| Auth routes  | 10 requests               | 1 minute  | `/api/auth/login`, `/api/auth/register`, `/api/auth/forgot-password` |
| Write routes | 60 requests               | 1 minute  | POST, PUT, PATCH, DELETE       |

**Rate limit exceeded response (429)**

```json
{
  "message": "Too many requests. Please slow down.",
  "data": null,
  "error": {
    "code": "RATE_LIMITED",
    "retry_after_seconds": 60
  }
}
```

Rate limit headers are included on every response:

```
X-RateLimit-Limit: 300
X-RateLimit-Remaining: 247
X-RateLimit-Reset: 1704456000
```

---

### Request Logging

Every request passing through the gateway is logged with the following fields:

| Field           | Description                                         |
| --------------- | --------------------------------------------------- |
| request_id      | UUID v4 generated per request (also set as header `X-Request-ID`) |
| timestamp       | ISO 8601 UTC                                        |
| method          | HTTP method                                         |
| path            | Request path (without query string)                 |
| query           | Query string (sensitive fields redacted)            |
| status_code     | HTTP response status                                |
| response_time_ms| End-to-end latency in milliseconds                  |
| ip              | Client IP address                                   |
| user_id         | Extracted from JWT `sub` claim, or `null`           |
| upstream        | Name of the target upstream service                 |

---

### JWT Forwarding

When a Bearer token is present in the `Authorization` header, the gateway:

1. Passes the raw token to the upstream service unchanged (the upstream service validates it independently)
2. Does **not** block requests with invalid tokens at the gateway level, except for routes explicitly marked as gateway-protected (none currently)

This means JWT validation errors are returned by the individual services, not the gateway.

---

### Upstream Error Passthrough

If an upstream service returns a 4xx or 5xx response, the gateway forwards the response body and status code transparently without modification.

If an upstream service is **unreachable**, the gateway returns:

```json
{
  "message": "Service temporarily unavailable",
  "data": null,
  "error": {
    "code": "UPSTREAM_UNAVAILABLE",
    "service": "place-service"
  }
}
```

With HTTP status `503 Service Unavailable`.

---

### CORS Policy

```
Access-Control-Allow-Origin: *  (configurable per environment)
Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS
Access-Control-Allow-Headers: Authorization, Content-Type, X-Request-ID
Access-Control-Max-Age: 86400
```

---

### Proxy Route Map

| Gateway Path Pattern              | Upstream Service      | Upstream Path Pattern             |
| --------------------------------- | --------------------- | --------------------------------- |
| `/api/auth/**`                    | auth-service:3001     | `/api/auth/**`                    |
| `/api/users/**`                   | auth-service:3001     | `/api/users/**`                   |
| `/api/places/**`                  | place-service:3002    | `/api/places/**`                  |
| `/api/bookmarks/**`               | place-service:3002    | `/api/bookmarks/**`               |
| `/api/tags/**`                    | place-service:3002    | `/api/tags/**`                    |
| `/api/reports/**`                 | place-service:3002    | `/api/reports/**`                 |
| `/api/notifications/**`           | notification-service:8080 | `/api/notifications/**`       |
| `/health`                         | gateway (internal)    | -                                 |
| `/api`                            | gateway (internal)    | -                                 |