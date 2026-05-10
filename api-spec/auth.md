# API Specification - Authentication & User Management

> File: paths/auth.md
> Owner: QuietSpace Finder — Auth Service
> Last Updated: 2025-01-01
> Service: auth-service (Node.js / Express.js)
> Base URL (via Gateway): /api/auth

---

## POST /api/auth/register

### Title

> Register a new user account

### Description

Creates a new user account using email and password. Upon successful registration, an email verification token is dispatched via RabbitMQ to the notification service. The user is assigned the default `user` role.

---

### Authentication / Authorization

| Field         | Value |
| ------------- | ----- |
| Auth Required | No    |
| Role(s)       | -     |
| Notes         | Endpoint is public. Rate limited to 5 requests per IP per minute. |

---

### Path Parameters

None.

---

### Query Parameters

None.

---

### Request Body (JSON)

```json
{
  "username": "string",
  "email": "string",
  "password": "string",
  "display_name": "string | null"
}
```

**Field Definitions**

| Field        | Type   | Required | Description                                            |
| ------------ | ------ | -------- | ------------------------------------------------------ |
| username     | string | Yes      | Unique handle, 3–50 chars, alphanumeric + underscore   |
| email        | string | Yes      | Valid email address, must be unique in the system      |
| password     | string | Yes      | Minimum 8 characters, at least one number and one letter |
| display_name | string | No       | Human-readable name shown in UI, max 100 chars         |

---

### Responses

#### Success - 201 Created

```json
{
  "message": "Registration successful. Please verify your email.",
  "data": {
    "user": {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "username": "john_doe",
      "email": "john@example.com",
      "display_name": "John Doe",
      "role": "user",
      "is_email_verified": false,
      "created_at": "2025-01-01T08:00:00.000Z"
    }
  },
  "error": null
}
```

---

#### Error Responses

**400 Bad Request**

```json
{
  "message": "Validation failed",
  "data": null,
  "error": {
    "code": "VALIDATION_ERROR",
    "details": {
      "password": "Password must be at least 8 characters"
    }
  }
}
```

**409 Conflict**

```json
{
  "message": "Email or username already in use",
  "data": null,
  "error": {
    "code": "DUPLICATE_ENTRY",
    "field": "email"
  }
}
```

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

- [ ] Username must be unique and contain only alphanumeric characters and underscores
- [ ] Password is stored as bcrypt hash (cost factor ≥ 12); plain text is never persisted
- [ ] After registration, a `user.registered` event is published to RabbitMQ with the user ID; the notification service sends a welcome + verification email
- [ ] New users start with `is_email_verified = false`; protected endpoints may require verification

---

## POST /api/auth/login

### Title

> Authenticate with email and password

### Description

Validates user credentials and issues a short-lived JWT access token and a long-lived refresh token. The refresh token is stored (hashed) in the database for rotation tracking.

---

### Authentication / Authorization

| Field         | Value |
| ------------- | ----- |
| Auth Required | No    |
| Role(s)       | -     |
| Notes         | Rate limited to 10 requests per IP per minute. Account is soft-locked after 5 consecutive failures. |

---

### Path Parameters

None.

---

### Query Parameters

None.

---

### Request Body (JSON)

```json
{
  "email": "string",
  "password": "string"
}
```

**Field Definitions**

| Field    | Type   | Required | Description           |
| -------- | ------ | -------- | --------------------- |
| email    | string | Yes      | Registered email address |
| password | string | Yes      | Account password      |

---

### Responses

#### Success - 200 OK

```json
{
  "message": "Login successful",
  "data": {
    "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refresh_token": "dGhpcyBpcyBhIHJlZnJlc2ggdG9rZW4...",
    "token_type": "Bearer",
    "expires_in": 900,
    "user": {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "username": "john_doe",
      "email": "john@example.com",
      "display_name": "John Doe",
      "role": "user",
      "avatar_url": null,
      "is_email_verified": true
    }
  },
  "error": null
}
```

---

#### Error Responses

**400 Bad Request**

```json
{
  "message": "Validation failed",
  "data": null,
  "error": { "code": "VALIDATION_ERROR", "details": { "email": "Invalid email format" } }
}
```

**401 Unauthorized**

```json
{
  "message": "Invalid email or password",
  "data": null,
  "error": { "code": "INVALID_CREDENTIALS" }
}
```

**403 Forbidden**

```json
{
  "message": "Account is deactivated",
  "data": null,
  "error": { "code": "ACCOUNT_INACTIVE" }
}
```

**429 Too Many Requests**

```json
{
  "message": "Too many login attempts. Try again in 15 minutes.",
  "data": null,
  "error": { "code": "RATE_LIMITED", "retry_after_seconds": 900 }
}
```

---

### Notes (Business Rules)

- [ ] Access token TTL: 15 minutes (configurable via `JWT_ACCESS_EXPIRES`)
- [ ] Refresh token TTL: 7 days (configurable via `JWT_REFRESH_EXPIRES`)
- [ ] JWT payload includes: `sub` (user ID), `role`, `iat`, `exp`
- [ ] Refresh token is stored as SHA-256 hash; the raw token is returned only once

---

## POST /api/auth/refresh

### Title

> Rotate access token using refresh token

### Description

Accepts a valid, non-expired refresh token and issues a new access token plus a new refresh token (rotation). The old refresh token is immediately revoked.

---

### Authentication / Authorization

| Field         | Value |
| ------------- | ----- |
| Auth Required | No (uses refresh token, not access token) |
| Role(s)       | -     |
| Notes         | Refresh token must be sent in the request body |

---

### Path Parameters

None.

---

### Query Parameters

None.

---

### Request Body (JSON)

```json
{
  "refresh_token": "string"
}
```

**Field Definitions**

| Field         | Type   | Required | Description                  |
| ------------- | ------ | -------- | ---------------------------- |
| refresh_token | string | Yes      | Valid refresh token from login |

---

### Responses

#### Success - 200 OK

```json
{
  "message": "Token refreshed",
  "data": {
    "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refresh_token": "bmV3UmVmcmVzaFRva2Vu...",
    "token_type": "Bearer",
    "expires_in": 900
  },
  "error": null
}
```

---

#### Error Responses

**400 Bad Request**

```json
{
  "message": "refresh_token is required",
  "data": null,
  "error": { "code": "VALIDATION_ERROR" }
}
```

**401 Unauthorized**

```json
{
  "message": "Invalid or expired refresh token",
  "data": null,
  "error": { "code": "INVALID_REFRESH_TOKEN" }
}
```

---

### Notes (Business Rules)

- [ ] Implements refresh token rotation — old token is revoked on every successful refresh
- [ ] If a revoked token is reused, all tokens for that user are immediately invalidated (token reuse detection)

---

## POST /api/auth/logout

### Title

> Revoke the current session

### Description

Revokes the supplied refresh token, effectively ending the session. The access token remains valid until its natural expiry (stateless JWT).

---

### Authentication / Authorization

| Field         | Value |
| ------------- | ----- |
| Auth Required | Yes   |
| Role(s)       | user, moderator, admin |
| Notes         | Bearer token required in `Authorization` header |

---

### Path Parameters

None.

---

### Query Parameters

None.

---

### Request Body (JSON)

```json
{
  "refresh_token": "string"
}
```

**Field Definitions**

| Field         | Type   | Required | Description            |
| ------------- | ------ | -------- | ---------------------- |
| refresh_token | string | Yes      | The refresh token to revoke |

---

### Responses

#### Success - 200 OK

```json
{
  "message": "Logged out successfully",
  "data": null,
  "error": null
}
```

---

#### Error Responses

**401 Unauthorized**

```json
{
  "message": "Unauthorized",
  "data": null,
  "error": { "code": "UNAUTHORIZED" }
}
```

---

### Notes (Business Rules)

- [ ] Only revokes the specific refresh token provided; other active sessions on other devices remain valid
- [ ] To log out all devices, use `POST /api/auth/logout-all`

---

## POST /api/auth/logout-all

### Title

> Revoke all active sessions for the authenticated user

### Description

Revokes every refresh token associated with the authenticated user's account across all devices.

---

### Authentication / Authorization

| Field         | Value |
| ------------- | ----- |
| Auth Required | Yes   |
| Role(s)       | user, moderator, admin |
| Notes         | Bearer token required |

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
  "message": "All sessions revoked successfully",
  "data": { "revoked_count": 3 },
  "error": null
}
```

---

#### Error Responses

**401 Unauthorized**

```json
{
  "message": "Unauthorized",
  "data": null,
  "error": { "code": "UNAUTHORIZED" }
}
```

---

### Notes (Business Rules)

- [ ] This action cannot be undone; the user must log in again on all devices

---

## GET /api/auth/oauth/google

### Title

> Initiate Google OAuth login flow

### Description

Redirects the client to Google's OAuth 2.0 authorization URL. Upon user consent, Google will redirect back to the callback endpoint.

---

### Authentication / Authorization

| Field         | Value |
| ------------- | ----- |
| Auth Required | No    |
| Role(s)       | -     |
| Notes         | Public endpoint; triggers a redirect |

---

### Path Parameters

None.

---

### Query Parameters

| Name     | Type   | Required | Default | Description                              |
| -------- | ------ | -------- | ------- | ---------------------------------------- |
| redirect | string | No       | -       | Optional frontend URL to redirect to after successful OAuth |

---

### Request Body (JSON)

None - no request body.

---

### Responses

#### Success - 302 Redirect

Redirects to `https://accounts.google.com/o/oauth2/auth?...`

---

#### Error Responses

**500 Internal Server Error**

```json
{
  "message": "OAuth configuration error",
  "data": null,
  "error": { "code": "OAUTH_CONFIG_ERROR" }
}
```

---

### Notes (Business Rules)

- [ ] A `state` parameter (random UUID) is generated and stored in a short-lived session to prevent CSRF

---

## GET /api/auth/oauth/google/callback

### Title

> Google OAuth callback handler

### Description

Receives the authorization code from Google, exchanges it for tokens, retrieves the user's profile, and either creates a new account or links to an existing one. Returns a JWT access token and refresh token.

---

### Authentication / Authorization

| Field         | Value |
| ------------- | ----- |
| Auth Required | No    |
| Role(s)       | -     |
| Notes         | Called by Google's servers; not called directly by the client |

---

### Path Parameters

None.

---

### Query Parameters

| Name  | Type   | Required | Default | Description                              |
| ----- | ------ | -------- | ------- | ---------------------------------------- |
| code  | string | Yes      | -       | Authorization code from Google           |
| state | string | Yes      | -       | CSRF state token to validate             |
| error | string | No       | -       | Present if user denied consent           |

---

### Request Body (JSON)

None - no request body.

---

### Responses

#### Success - 302 Redirect (to frontend with tokens in query or fragment)

On success, redirects to the frontend app with:

```
https://frontend.example.com/oauth/success?access_token=...&refresh_token=...
```

Or returns JSON if `Accept: application/json` header is present:

```json
{
  "message": "OAuth login successful",
  "data": {
    "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refresh_token": "bmV3UmVmcmVzaFRva2Vu...",
    "token_type": "Bearer",
    "expires_in": 900,
    "is_new_user": true,
    "user": {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "username": "john_doe",
      "email": "john@example.com",
      "display_name": "John Doe",
      "avatar_url": "https://lh3.googleusercontent.com/...",
      "role": "user"
    }
  },
  "error": null
}
```

---

#### Error Responses

**400 Bad Request**

```json
{
  "message": "Invalid or expired OAuth state",
  "data": null,
  "error": { "code": "INVALID_OAUTH_STATE" }
}
```

**401 Unauthorized**

```json
{
  "message": "Google OAuth authentication failed",
  "data": null,
  "error": { "code": "OAUTH_FAILED" }
}
```

---

### Notes (Business Rules)

- [ ] If a user with the same email already exists (registered via password), the Google identity is linked to the existing account
- [ ] If a new account is created via OAuth, a random secure username is auto-generated and the user may update it later
- [ ] `is_email_verified` is set to `true` for OAuth accounts (email trust delegated to provider)

---

## GET /api/auth/oauth/github

### Title

> Initiate GitHub OAuth login flow

### Description

Redirects the client to GitHub's OAuth authorization URL.

---

### Authentication / Authorization

| Field         | Value |
| ------------- | ----- |
| Auth Required | No    |
| Role(s)       | -     |
| Notes         | Public endpoint |

---

### Path Parameters

None.

---

### Query Parameters

| Name     | Type   | Required | Default | Description                                |
| -------- | ------ | -------- | ------- | ------------------------------------------ |
| redirect | string | No       | -       | Optional post-auth frontend redirect URL   |

---

### Request Body (JSON)

None - no request body.

---

### Responses

#### Success - 302 Redirect

Redirects to `https://github.com/login/oauth/authorize?...`

---

#### Error Responses

**500 Internal Server Error**

```json
{
  "message": "OAuth configuration error",
  "data": null,
  "error": { "code": "OAUTH_CONFIG_ERROR" }
}
```

---

### Notes (Business Rules)

- [ ] Requested scopes: `read:user`, `user:email`

---

## GET /api/auth/oauth/github/callback

### Title

> GitHub OAuth callback handler

### Description

Receives the authorization code from GitHub, exchanges it for tokens, retrieves user profile and primary email, and creates or links the account.

---

### Authentication / Authorization

| Field         | Value |
| ------------- | ----- |
| Auth Required | No    |
| Role(s)       | -     |
| Notes         | Called by GitHub servers |

---

### Path Parameters

None.

---

### Query Parameters

| Name  | Type   | Required | Default | Description               |
| ----- | ------ | -------- | ------- | ------------------------- |
| code  | string | Yes      | -       | Authorization code        |
| state | string | Yes      | -       | CSRF state token          |
| error | string | No       | -       | Present on user denial    |

---

### Request Body (JSON)

None - no request body.

---

### Responses

#### Success - 302 Redirect or 200 OK (same shape as Google callback)

```json
{
  "message": "OAuth login successful",
  "data": {
    "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refresh_token": "bmV3UmVmcmVzaFRva2Vu...",
    "token_type": "Bearer",
    "expires_in": 900,
    "is_new_user": false,
    "user": {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "username": "john_doe",
      "email": "john@github-email.com",
      "display_name": "John Doe",
      "avatar_url": "https://avatars.githubusercontent.com/u/...",
      "role": "user"
    }
  },
  "error": null
}
```

---

#### Error Responses

**400 Bad Request**

```json
{
  "message": "Invalid or expired OAuth state",
  "data": null,
  "error": { "code": "INVALID_OAUTH_STATE" }
}
```

---

### Notes (Business Rules)

- [ ] GitHub may not expose the user's primary email; if email is null, the user is prompted to provide one after callback

---

## POST /api/auth/verify-email

### Title

> Verify user email address

### Description

Consumes a one-time email verification token (delivered via email) and marks the user's email as verified.

---

### Authentication / Authorization

| Field         | Value |
| ------------- | ----- |
| Auth Required | No    |
| Role(s)       | -     |
| Notes         | Token-based; no JWT required |

---

### Path Parameters

None.

---

### Query Parameters

None.

---

### Request Body (JSON)

```json
{
  "token": "string"
}
```

**Field Definitions**

| Field | Type   | Required | Description                          |
| ----- | ------ | -------- | ------------------------------------ |
| token | string | Yes      | One-time verification token from email |

---

### Responses

#### Success - 200 OK

```json
{
  "message": "Email verified successfully",
  "data": null,
  "error": null
}
```

---

#### Error Responses

**400 Bad Request**

```json
{
  "message": "Invalid or expired verification token",
  "data": null,
  "error": { "code": "INVALID_TOKEN" }
}
```

---

### Notes (Business Rules)

- [ ] Token expires after 24 hours
- [ ] Token is single-use; consumed on first valid use

---

## POST /api/auth/forgot-password

### Title

> Request a password reset email

### Description

Sends a password reset link to the user's registered email address via RabbitMQ event to the notification service.

---

### Authentication / Authorization

| Field         | Value |
| ------------- | ----- |
| Auth Required | No    |
| Role(s)       | -     |
| Notes         | Always returns 200 to prevent email enumeration |

---

### Path Parameters

None.

---

### Query Parameters

None.

---

### Request Body (JSON)

```json
{
  "email": "string"
}
```

**Field Definitions**

| Field | Type   | Required | Description                 |
| ----- | ------ | -------- | --------------------------- |
| email | string | Yes      | Email address of the account |

---

### Responses

#### Success - 200 OK

```json
{
  "message": "If an account with that email exists, a reset link has been sent.",
  "data": null,
  "error": null
}
```

---

#### Error Responses

**400 Bad Request**

```json
{
  "message": "Validation failed",
  "data": null,
  "error": { "code": "VALIDATION_ERROR", "details": { "email": "Invalid email format" } }
}
```

---

### Notes (Business Rules)

- [ ] Reset token expires after 1 hour
- [ ] Only one active reset token per user; requesting again invalidates the previous one

---

## POST /api/auth/reset-password

### Title

> Reset password using token

### Description

Validates the password reset token and sets a new password for the associated user account.

---

### Authentication / Authorization

| Field         | Value |
| ------------- | ----- |
| Auth Required | No    |
| Role(s)       | -     |
| Notes         | Token-based |

---

### Path Parameters

None.

---

### Query Parameters

None.

---

### Request Body (JSON)

```json
{
  "token": "string",
  "new_password": "string",
  "confirm_password": "string"
}
```

**Field Definitions**

| Field            | Type   | Required | Description                      |
| ---------------- | ------ | -------- | -------------------------------- |
| token            | string | Yes      | Password reset token from email  |
| new_password     | string | Yes      | New password (min 8 chars)       |
| confirm_password | string | Yes      | Must exactly match new_password  |

---

### Responses

#### Success - 200 OK

```json
{
  "message": "Password reset successfully. Please log in with your new password.",
  "data": null,
  "error": null
}
```

---

#### Error Responses

**400 Bad Request**

```json
{
  "message": "Passwords do not match",
  "data": null,
  "error": { "code": "PASSWORD_MISMATCH" }
}
```

**400 Bad Request**

```json
{
  "message": "Invalid or expired reset token",
  "data": null,
  "error": { "code": "INVALID_TOKEN" }
}
```

---

### Notes (Business Rules)

- [ ] All refresh tokens for the user are revoked after a successful password reset
- [ ] A `user.password_reset` event is published to RabbitMQ for notification delivery