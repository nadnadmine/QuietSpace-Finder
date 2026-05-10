# API Specification - User Profile Management

> File: paths/users.md
> Owner: QuietSpace Finder — Auth Service
> Last Updated: 2025-01-01
> Service: auth-service (Node.js / Express.js)
> Base URL (via Gateway): /api/users

---

## GET /api/users/me

### Title

> Get authenticated user's own profile

### Description

Returns the full profile of the currently authenticated user, including role, linked OAuth providers, and account metadata.

---

### Authentication / Authorization

| Field         | Value                          |
| ------------- | ------------------------------ |
| Auth Required | Yes                            |
| Role(s)       | user, moderator, admin         |
| Notes         | Bearer token required          |

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
  "message": "Success",
  "data": {
    "user": {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "username": "john_doe",
      "email": "john@example.com",
      "display_name": "John Doe",
      "avatar_url": "https://storage.example.com/avatars/john.jpg",
      "bio": "Coffee addict. Remote worker.",
      "role": "user",
      "is_email_verified": true,
      "linked_providers": ["google"],
      "last_login_at": "2025-01-01T08:00:00.000Z",
      "created_at": "2024-06-01T00:00:00.000Z"
    }
  },
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

- [ ] `linked_providers` lists the names of OAuth providers currently linked to this account
- [ ] Soft-deleted accounts (`deleted_at IS NOT NULL`) are treated as unauthorized

---

## PATCH /api/users/me

### Title

> Update authenticated user's profile

### Description

Allows the authenticated user to update their own display name, bio, and avatar. Username and email changes are handled by separate dedicated endpoints.

---

### Authentication / Authorization

| Field         | Value                  |
| ------------- | ---------------------- |
| Auth Required | Yes                    |
| Role(s)       | user, moderator, admin |
| Notes         | Bearer token required  |

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
  "display_name": "string | null",
  "bio": "string | null",
  "avatar_url": "string | null"
}
```

**Field Definitions**

| Field        | Type   | Required | Description                                     |
| ------------ | ------ | -------- | ----------------------------------------------- |
| display_name | string | No       | Public display name, max 100 characters         |
| bio          | string | No       | Short personal bio, max 500 characters          |
| avatar_url   | string | No       | Valid URL pointing to a profile image           |

---

### Responses

#### Success - 200 OK

```json
{
  "message": "Profile updated successfully",
  "data": {
    "user": {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "username": "john_doe",
      "display_name": "John Updated",
      "bio": "Now with a better bio.",
      "avatar_url": "https://storage.example.com/avatars/new.jpg",
      "updated_at": "2025-01-02T09:00:00.000Z"
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
    "details": { "bio": "Bio must not exceed 500 characters" }
  }
}
```

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

- [ ] At least one field must be provided; sending an empty object returns a 400
- [ ] Fields not included in the request body are left unchanged (partial update)

---

## PATCH /api/users/me/password

### Title

> Change authenticated user's password

### Description

Allows a user who registered via email/password to change their current password. Requires the current password for verification. All other active sessions are revoked after a successful change.

---

### Authentication / Authorization

| Field         | Value                  |
| ------------- | ---------------------- |
| Auth Required | Yes                    |
| Role(s)       | user, moderator, admin |
| Notes         | Bearer token required  |

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
  "current_password": "string",
  "new_password": "string",
  "confirm_password": "string"
}
```

**Field Definitions**

| Field            | Type   | Required | Description                          |
| ---------------- | ------ | -------- | ------------------------------------ |
| current_password | string | Yes      | The user's existing password         |
| new_password     | string | Yes      | New password, minimum 8 characters   |
| confirm_password | string | Yes      | Must exactly match `new_password`    |

---

### Responses

#### Success - 200 OK

```json
{
  "message": "Password changed successfully. Other sessions have been revoked.",
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

**401 Unauthorized**

```json
{
  "message": "Current password is incorrect",
  "data": null,
  "error": { "code": "WRONG_CURRENT_PASSWORD" }
}
```

**422 Unprocessable Entity**

```json
{
  "message": "This endpoint is not available for OAuth-only accounts",
  "data": null,
  "error": { "code": "NO_PASSWORD_ACCOUNT" }
}
```

---

### Notes (Business Rules)

- [ ] OAuth-only accounts (no `password_hash`) cannot use this endpoint
- [ ] All refresh tokens except the one used in the current request are revoked after success

---

## DELETE /api/users/me

### Title

> Deactivate (soft-delete) authenticated user's account

### Description

Performs a soft delete of the authenticated user's account. The account data is retained for 30 days before permanent deletion, allowing for recovery.

---

### Authentication / Authorization

| Field         | Value                  |
| ------------- | ---------------------- |
| Auth Required | Yes                    |
| Role(s)       | user, moderator, admin |
| Notes         | Bearer token required  |

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
  "password": "string | null",
  "confirm_text": "string"
}
```

**Field Definitions**

| Field        | Type   | Required | Description                                                    |
| ------------ | ------ | -------- | -------------------------------------------------------------- |
| password     | string | No       | Required only if the account has a password set                |
| confirm_text | string | Yes      | Must be exactly `"DELETE MY ACCOUNT"` to confirm the action    |

---

### Responses

#### Success - 200 OK

```json
{
  "message": "Account deactivated. Your data will be permanently deleted in 30 days.",
  "data": null,
  "error": null
}
```

---

#### Error Responses

**400 Bad Request**

```json
{
  "message": "Confirmation text does not match",
  "data": null,
  "error": { "code": "CONFIRMATION_MISMATCH" }
}
```

**401 Unauthorized**

```json
{
  "message": "Password is incorrect",
  "data": null,
  "error": { "code": "WRONG_PASSWORD" }
}
```

---

### Notes (Business Rules)

- [ ] Sets `deleted_at` to current timestamp; does not hard-delete the row
- [ ] All refresh tokens are immediately revoked
- [ ] User cannot log in after deactivation

---

## GET /api/users/:userId

### Title

> Get a public user profile by ID

### Description

Returns the publicly visible profile of any user by their UUID. Sensitive fields (email, OAuth providers, token data) are excluded.

---

### Authentication / Authorization

| Field         | Value |
| ------------- | ----- |
| Auth Required | No    |
| Role(s)       | -     |
| Notes         | Public endpoint |

---

### Path Parameters

| Name   | Type   | Required | Description        |
| ------ | ------ | -------- | ------------------ |
| userId | string | Yes      | UUID of the user   |

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
  "message": "Success",
  "data": {
    "user": {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "username": "john_doe",
      "display_name": "John Doe",
      "avatar_url": "https://storage.example.com/avatars/john.jpg",
      "bio": "Coffee addict. Remote worker.",
      "created_at": "2024-06-01T00:00:00.000Z"
    }
  },
  "error": null
}
```

---

#### Error Responses

**404 Not Found**

```json
{
  "message": "User not found",
  "data": null,
  "error": { "code": "NOT_FOUND" }
}
```

---

### Notes (Business Rules)

- [ ] Deactivated (`deleted_at IS NOT NULL`) or inactive (`is_active = 0`) users return 404

---

## GET /api/users

### Title

> List all users (admin only)

### Description

Returns a paginated list of all registered users. Only accessible to administrators. Includes account status, role, and registration metadata.

---

### Authentication / Authorization

| Field         | Value                                    |
| ------------- | ---------------------------------------- |
| Auth Required | Yes                                      |
| Role(s)       | admin                                    |
| Notes         | Bearer token required with `admin` role  |

---

### Path Parameters

None.

---

### Query Parameters

| Name     | Type    | Required | Default    | Description                              |
| -------- | ------- | -------- | ---------- | ---------------------------------------- |
| page     | integer | No       | 1          | Page number                              |
| limit    | integer | No       | 20         | Items per page (max 100)                 |
| search   | string  | No       | -          | Search by username or email              |
| role     | string  | No       | -          | Filter by role: `user`, `moderator`, `admin` |
| is_active| boolean | No       | -          | Filter by active status                  |
| sortBy   | string  | No       | created_at | Sort field                               |
| order    | string  | No       | desc       | `asc` or `desc`                          |

---

### Request Body (JSON)

None - no request body.

---

### Responses

#### Success - 200 OK

```json
{
  "message": "Success",
  "data": {
    "users": [
      {
        "id": "550e8400-e29b-41d4-a716-446655440000",
        "username": "john_doe",
        "email": "john@example.com",
        "display_name": "John Doe",
        "role": "user",
        "is_active": true,
        "is_email_verified": true,
        "last_login_at": "2025-01-01T08:00:00.000Z",
        "created_at": "2024-06-01T00:00:00.000Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 150,
      "total_pages": 8
    }
  },
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

**403 Forbidden**

```json
{
  "message": "Forbidden. Admin access required.",
  "data": null,
  "error": { "code": "FORBIDDEN" }
}
```

---

### Notes (Business Rules)

- [ ] Soft-deleted users are excluded unless `include_deleted=true` query param is provided by admin

---

## PATCH /api/users/:userId/role

### Title

> Update a user's role (admin only)

### Description

Allows an administrator to promote or demote a user's role. Useful for assigning moderators or revoking admin privileges.

---

### Authentication / Authorization

| Field         | Value                                    |
| ------------- | ---------------------------------------- |
| Auth Required | Yes                                      |
| Role(s)       | admin                                    |
| Notes         | Bearer token required with `admin` role  |

---

### Path Parameters

| Name   | Type   | Required | Description      |
| ------ | ------ | -------- | ---------------- |
| userId | string | Yes      | UUID of the user |

---

### Query Parameters

None.

---

### Request Body (JSON)

```json
{
  "role": "string"
}
```

**Field Definitions**

| Field | Type   | Required | Description                                      |
| ----- | ------ | -------- | ------------------------------------------------ |
| role  | string | Yes      | New role: `user`, `moderator`, or `admin`        |

---

### Responses

#### Success - 200 OK

```json
{
  "message": "User role updated successfully",
  "data": {
    "user_id": "550e8400-e29b-41d4-a716-446655440000",
    "old_role": "user",
    "new_role": "moderator"
  },
  "error": null
}
```

---

#### Error Responses

**400 Bad Request**

```json
{
  "message": "Invalid role value",
  "data": null,
  "error": { "code": "INVALID_ROLE" }
}
```

**403 Forbidden**

```json
{
  "message": "Forbidden. Admin access required.",
  "data": null,
  "error": { "code": "FORBIDDEN" }
}
```

**404 Not Found**

```json
{
  "message": "User not found",
  "data": null,
  "error": { "code": "NOT_FOUND" }
}
```

---

### Notes (Business Rules)

- [ ] An admin cannot demote their own account to prevent loss of all admin access
- [ ] Role change publishes a `user.role_changed` event to RabbitMQ for audit trail

---

## PATCH /api/users/:userId/status

### Title

> Activate or deactivate a user account (admin only)

### Description

Allows an administrator to toggle a user's `is_active` status, effectively locking or unlocking their ability to log in.

---

### Authentication / Authorization

| Field         | Value |
| ------------- | ----- |
| Auth Required | Yes   |
| Role(s)       | admin |
| Notes         | Bearer token required with `admin` role |

---

### Path Parameters

| Name   | Type   | Required | Description      |
| ------ | ------ | -------- | ---------------- |
| userId | string | Yes      | UUID of the user |

---

### Query Parameters

None.

---

### Request Body (JSON)

```json
{
  "is_active": true
}
```

**Field Definitions**

| Field     | Type    | Required | Description                        |
| --------- | ------- | -------- | ---------------------------------- |
| is_active | boolean | Yes      | `true` to activate, `false` to deactivate |

---

### Responses

#### Success - 200 OK

```json
{
  "message": "User status updated successfully",
  "data": {
    "user_id": "550e8400-e29b-41d4-a716-446655440000",
    "is_active": false
  },
  "error": null
}
```

---

#### Error Responses

**403 Forbidden**

```json
{
  "message": "Forbidden. Admin access required.",
  "data": null,
  "error": { "code": "FORBIDDEN" }
}
```

**404 Not Found**

```json
{
  "message": "User not found",
  "data": null,
  "error": { "code": "NOT_FOUND" }
}
```

---

### Notes (Business Rules)

- [ ] Deactivating a user immediately revokes all their active refresh tokens
- [ ] An admin cannot deactivate their own account