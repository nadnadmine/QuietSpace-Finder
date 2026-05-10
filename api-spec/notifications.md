# API Specification - Notifications

> File: paths/notifications.md
> Owner: QuietSpace Finder — Notification Service
> Last Updated: 2025-01-01
> Service: notification-service (PHP CodeIgniter 4)
> Base URL (via Gateway): /api/notifications

---

## GET /api/notifications

### Title

> List notifications for the authenticated user

### Description

Returns a paginated list of all notifications for the authenticated user, ordered by most recent first. Supports filtering by read/unread status and notification type.

---

### Authentication / Authorization

| Field         | Value                  |
| ------------- | ---------------------- |
| Auth Required | Yes                    |
| Role(s)       | user, moderator, admin |
| Notes         | Bearer token required; the JWT is validated internally against the auth-service public key |

---

### Path Parameters

None.

---

### Query Parameters

| Name   | Type    | Required | Default    | Description                                       |
| ------ | ------- | -------- | ---------- | ------------------------------------------------- |
| page   | integer | No       | 1          | Page number                                       |
| limit  | integer | No       | 20         | Items per page (max 100)                          |
| is_read| boolean | No       | -          | Filter by read status (`true` or `false`)         |
| type   | string  | No       | -          | Filter by notification type code (e.g. `place.approved`) |

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
    "notifications": [
      {
        "id": "f1e2d3c4-b5a6-7890-abcd-ef1234567890",
        "type": {
          "code": "place.approved",
          "label": "Your place submission was approved",
          "channel": "email"
        },
        "title": "Your place 'Kopi Kenangan Tenang' has been approved!",
        "body": "Great news! Your submitted place is now publicly visible on QuietSpace Finder.",
        "action_url": "/places/kopi-kenangan-tenang-bandung",
        "is_read": false,
        "sent_at": "2025-01-05T09:00:00.000Z",
        "created_at": "2025-01-05T09:00:00.000Z"
      }
    ],
    "unread_count": 3,
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 12,
      "total_pages": 1
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

- [ ] `unread_count` in the response reflects the total unread count across ALL notifications, not just the current page
- [ ] The JWT is decoded and validated using the shared public key; the notification service does not call the auth service per-request

---

## GET /api/notifications/:notificationId

### Title

> Get a single notification by ID

### Description

Returns the full details of a single notification. If the notification is unread, it is automatically marked as read upon access.

---

### Authentication / Authorization

| Field         | Value                  |
| ------------- | ---------------------- |
| Auth Required | Yes                    |
| Role(s)       | user, moderator, admin |
| Notes         | Bearer token required; user may only access their own notifications |

---

### Path Parameters

| Name           | Type   | Required | Description             |
| -------------- | ------ | -------- | ----------------------- |
| notificationId | string | Yes      | UUID of the notification |

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
    "notification": {
      "id": "f1e2d3c4-b5a6-7890-abcd-ef1234567890",
      "type": {
        "code": "place.approved",
        "label": "Your place submission was approved",
        "channel": "email"
      },
      "title": "Your place 'Kopi Kenangan Tenang' has been approved!",
      "body": "Great news! Your submitted place is now publicly visible on QuietSpace Finder.",
      "action_url": "/places/kopi-kenangan-tenang-bandung",
      "metadata": {
        "place_id": "7c9e6679-7425-40de-944b-e07fc1f90ae7",
        "place_name": "Kopi Kenangan Tenang"
      },
      "is_read": true,
      "read_at": "2025-01-06T08:00:00.000Z",
      "sent_at": "2025-01-05T09:00:00.000Z",
      "created_at": "2025-01-05T09:00:00.000Z"
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
  "message": "Forbidden",
  "data": null,
  "error": { "code": "FORBIDDEN" }
}
```

**404 Not Found**

```json
{
  "message": "Notification not found",
  "data": null,
  "error": { "code": "NOT_FOUND" }
}
```

---

### Notes (Business Rules)

- [ ] Accessing this endpoint marks the notification as read and records `read_at`

---

## PATCH /api/notifications/:notificationId/read

### Title

> Mark a single notification as read

### Description

Explicitly marks the specified notification as read without fetching its full content. Useful for bulk mark-as-read workflows from a notification list.

---

### Authentication / Authorization

| Field         | Value                  |
| ------------- | ---------------------- |
| Auth Required | Yes                    |
| Role(s)       | user, moderator, admin |
| Notes         | Bearer token required  |

---

### Path Parameters

| Name           | Type   | Required | Description              |
| -------------- | ------ | -------- | ------------------------ |
| notificationId | string | Yes      | UUID of the notification |

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
  "message": "Notification marked as read",
  "data": {
    "notification_id": "f1e2d3c4-b5a6-7890-abcd-ef1234567890",
    "read_at": "2025-01-06T08:00:00.000Z"
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

**404 Not Found**

```json
{
  "message": "Notification not found",
  "data": null,
  "error": { "code": "NOT_FOUND" }
}
```

---

### Notes (Business Rules)

- [ ] If the notification is already read, the endpoint returns 200 with the existing `read_at` timestamp (idempotent)

---

## PATCH /api/notifications/read-all

### Title

> Mark all notifications as read

### Description

Marks every unread notification for the authenticated user as read in a single bulk operation.

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

None - no request body.

---

### Responses

#### Success - 200 OK

```json
{
  "message": "All notifications marked as read",
  "data": {
    "updated_count": 3
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

- [ ] Returns `updated_count: 0` if there are no unread notifications (not an error)

---

## DELETE /api/notifications/:notificationId

### Title

> Delete a notification

### Description

Permanently deletes a single notification from the authenticated user's inbox.

---

### Authentication / Authorization

| Field         | Value                  |
| ------------- | ---------------------- |
| Auth Required | Yes                    |
| Role(s)       | user, moderator, admin |
| Notes         | Bearer token required  |

---

### Path Parameters

| Name           | Type   | Required | Description              |
| -------------- | ------ | -------- | ------------------------ |
| notificationId | string | Yes      | UUID of the notification |

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
  "message": "Notification deleted",
  "data": null,
  "error": null
}
```

---

#### Error Responses

**403 Forbidden**

```json
{
  "message": "Forbidden",
  "data": null,
  "error": { "code": "FORBIDDEN" }
}
```

**404 Not Found**

```json
{
  "message": "Notification not found",
  "data": null,
  "error": { "code": "NOT_FOUND" }
}
```

---

### Notes (Business Rules)

- [ ] This is a hard delete; the notification record is removed from the `notifications` table
- [ ] Deleted notifications are not reflected in `event_logs` (audit log is immutable)

---

## GET /api/notifications/preferences

### Title

> Get user notification preferences

### Description

Returns the authenticated user's notification preferences for all available notification types, showing which channels and types are enabled.

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

None - no request body.

---

### Responses

#### Success - 200 OK

```json
{
  "message": "Success",
  "data": {
    "preferences": [
      {
        "notification_type": {
          "id": 2,
          "code": "place.approved",
          "label": "Your place submission was approved",
          "channel": "email"
        },
        "is_enabled": true,
        "preferred_channel": "email"
      },
      {
        "notification_type": {
          "id": 4,
          "code": "report.submitted",
          "label": "New condition report submitted",
          "channel": "in_app"
        },
        "is_enabled": false,
        "preferred_channel": "in_app"
      }
    ]
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

- [ ] If a user has no preference record for a type, the default is `is_enabled: true` with the type's default channel

---

## PATCH /api/notifications/preferences

### Title

> Update user notification preferences

### Description

Updates one or more notification preferences for the authenticated user. Only the preferences included in the request body are updated (partial update).

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
  "preferences": [
    {
      "notification_type_id": 2,
      "is_enabled": true,
      "preferred_channel": "email"
    },
    {
      "notification_type_id": 4,
      "is_enabled": false,
      "preferred_channel": "in_app"
    }
  ]
}
```

**Field Definitions**

| Field                | Type    | Required | Description                                     |
| -------------------- | ------- | -------- | ----------------------------------------------- |
| preferences          | array   | Yes      | Array of preference objects to update           |
| notification_type_id | integer | Yes      | ID of the notification type                     |
| is_enabled           | boolean | Yes      | Whether to receive this notification type       |
| preferred_channel    | string  | Yes      | Delivery channel: `in_app`, `email`, or `push`  |

---

### Responses

#### Success - 200 OK

```json
{
  "message": "Preferences updated successfully",
  "data": {
    "updated_count": 2
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
    "details": { "preferred_channel": "Must be one of: in_app, email, push" }
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

- [ ] Uses upsert (INSERT ... ON DUPLICATE KEY UPDATE) for efficiency
- [ ] Invalid `notification_type_id` values are silently skipped; no error is thrown

---

## GET /api/notifications/event-logs

### Title

> List RabbitMQ event logs (admin only)

### Description

Returns a paginated log of all events consumed from RabbitMQ by the notification service. Useful for debugging message delivery and auditing the system's async event flow.

---

### Authentication / Authorization

| Field         | Value  |
| ------------- | ------ |
| Auth Required | Yes    |
| Role(s)       | admin  |
| Notes         | Bearer token with `admin` role required |

---

### Path Parameters

None.

---

### Query Parameters

| Name       | Type    | Required | Default     | Description                                               |
| ---------- | ------- | -------- | ----------- | --------------------------------------------------------- |
| page       | integer | No       | 1           | Page number                                               |
| limit      | integer | No       | 50          | Items per page (max 200)                                  |
| event_type | string  | No       | -           | Filter by event type code                                 |
| status     | string  | No       | -           | Filter by status: `received`, `processed`, `failed`, `skipped` |
| from_date  | string  | No       | -           | ISO 8601 datetime lower bound for `received_at`           |
| to_date    | string  | No       | -           | ISO 8601 datetime upper bound for `received_at`           |

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
    "event_logs": [
      {
        "id": 1042,
        "event_id": "b2c3d4e5-f6a7-8901-bcde-f23456789012",
        "event_type": "report.submitted",
        "source_service": "place-service",
        "status": "processed",
        "attempts": 1,
        "processed_at": "2025-01-05T11:30:05.000Z",
        "received_at": "2025-01-05T11:30:04.000Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 50,
      "total": 1042,
      "total_pages": 21
    }
  },
  "error": null
}
```

---

#### Error Responses

**403 Forbidden**

```json
{
  "message": "Admin access required",
  "data": null,
  "error": { "code": "FORBIDDEN" }
}
```

---

### Notes (Business Rules)

- [ ] Payload data is excluded from the list response for performance; use the detail endpoint if needed
- [ ] `event_logs` is an append-only table; no modifications are allowed via the API

---

## POST /api/notifications/event-logs/:eventLogId/retry

### Title

> Retry a failed event (admin only)

### Description

Re-queues a failed event for reprocessing by resetting its status to `received` and incrementing the attempt counter. Used to manually recover from transient failures.

---

### Authentication / Authorization

| Field         | Value |
| ------------- | ----- |
| Auth Required | Yes   |
| Role(s)       | admin |
| Notes         | Bearer token with `admin` role required |

---

### Path Parameters

| Name       | Type    | Required | Description             |
| ---------- | ------- | -------- | ----------------------- |
| eventLogId | integer | Yes      | ID of the event log row |

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
  "message": "Event re-queued for processing",
  "data": {
    "event_log_id": 1044,
    "event_type": "place.approved",
    "status": "received",
    "attempts": 2
  },
  "error": null
}
```

---

#### Error Responses

**400 Bad Request**

```json
{
  "message": "Only failed events can be retried",
  "data": null,
  "error": { "code": "INVALID_EVENT_STATUS" }
}
```

**403 Forbidden**

```json
{
  "message": "Admin access required",
  "data": null,
  "error": { "code": "FORBIDDEN" }
}
```

**404 Not Found**

```json
{
  "message": "Event log not found",
  "data": null,
  "error": { "code": "NOT_FOUND" }
}
```

---

### Notes (Business Rules)

- [ ] Maximum retry attempts is configurable via environment variable `MAX_EVENT_RETRIES` (default: 5)
- [ ] If `attempts >= MAX_EVENT_RETRIES`, the event is moved to `failed_events` instead of being retried