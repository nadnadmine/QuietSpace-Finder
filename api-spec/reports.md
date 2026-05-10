# API Specification - Condition Reports

> File: paths/reports.md
> Owner: QuietSpace Finder — Place Service
> Last Updated: 2025-01-01
> Service: place-service (Node.js / Express.js)
> Base URL (via Gateway): /api/places/:placeId/reports, /api/reports

---

## POST /api/places/:placeId/reports

### Title

> Submit a real-time condition report for a place

### Description

Allows an authenticated user to submit a current condition report for a specific place. The report rates five dimensions on a 1–5 scale. A composite quiet score is computed and the place's aggregated `quiet_score` is recalculated. A `report.submitted` event is published to RabbitMQ.

---

### Authentication / Authorization

| Field         | Value                  |
| ------------- | ---------------------- |
| Auth Required | Yes                    |
| Role(s)       | user, moderator, admin |
| Notes         | A user may only report the same place once every 30 minutes |

---

### Path Parameters

| Name    | Type   | Required | Description       |
| ------- | ------ | -------- | ----------------- |
| placeId | string | Yes      | UUID of the place |

---

### Query Parameters

None.

---

### Request Body (JSON)

```json
{
  "noise_level": 4,
  "crowd_level": 3,
  "comfort_level": 5,
  "facility_rating": 4,
  "ambiance_rating": 4,
  "comment": "string | null"
}
```

**Field Definitions**

| Field           | Type    | Required | Description                                          |
| --------------- | ------- | -------- | ---------------------------------------------------- |
| noise_level     | integer | Yes      | 1 (very noisy) to 5 (very quiet)                     |
| crowd_level     | integer | Yes      | 1 (very crowded) to 5 (nearly empty)                 |
| comfort_level   | integer | Yes      | 1 (uncomfortable) to 5 (very comfortable)            |
| facility_rating | integer | Yes      | 1 (poor facilities) to 5 (excellent facilities)      |
| ambiance_rating | integer | Yes      | 1 (bad vibe) to 5 (great vibe)                       |
| comment         | string  | No       | Optional text description, max 1000 characters       |

---

### Responses

#### Success - 201 Created

```json
{
  "message": "Report submitted successfully",
  "data": {
    "report": {
      "id": "a3f2d1c4-8b9e-4f0a-b1c2-d3e4f5a6b7c8",
      "place_id": "7c9e6679-7425-40de-944b-e07fc1f90ae7",
      "noise_level": 4,
      "crowd_level": 3,
      "comfort_level": 5,
      "facility_rating": 4,
      "ambiance_rating": 4,
      "quiet_score": 8.00,
      "comment": "Very calm afternoon. Only 3 other people here.",
      "reported_at": "2025-01-05T11:30:00.000Z"
    },
    "place_quiet_score_updated": 8.35
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
    "details": { "noise_level": "Must be an integer between 1 and 5" }
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

**404 Not Found**

```json
{
  "message": "Place not found",
  "data": null,
  "error": { "code": "NOT_FOUND" }
}
```

**429 Too Many Requests**

```json
{
  "message": "You can only report this place once every 30 minutes",
  "data": null,
  "error": {
    "code": "REPORT_COOLDOWN",
    "retry_after_seconds": 1200
  }
}
```

---

### Notes (Business Rules)

- [ ] Quiet score formula: `(noise_level * 0.35 + crowd_level * 0.25 + comfort_level * 0.20 + facility_rating * 0.10 + ambiance_rating * 0.10) * 2`; this gives a 0–10 scale
- [ ] After insert, a background job recalculates the place's aggregated `quiet_score` as the weighted average of the last 20 reports (recency-weighted)
- [ ] Publishes `report.submitted` event to RabbitMQ with `place_id`, `user_id`, and `quiet_score` in payload

---

## GET /api/places/:placeId/reports

### Title

> List condition reports for a place

### Description

Returns a paginated list of condition reports for a specific place, ordered by most recent first. Includes helpfulness vote counts.

---

### Authentication / Authorization

| Field         | Value  |
| ------------- | ------ |
| Auth Required | No     |
| Role(s)       | -      |
| Notes         | Public. Authenticated users additionally see whether they have voted on each report. |

---

### Path Parameters

| Name    | Type   | Required | Description       |
| ------- | ------ | -------- | ----------------- |
| placeId | string | Yes      | UUID of the place |

---

### Query Parameters

| Name   | Type    | Required | Default     | Description          |
| ------ | ------- | -------- | ----------- | -------------------- |
| page   | integer | No       | 1           | Page number          |
| limit  | integer | No       | 10          | Items per page (max 50) |
| sortBy | string  | No       | reported_at | `reported_at` or `quiet_score` |
| order  | string  | No       | desc        | `asc` or `desc`      |

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
    "reports": [
      {
        "id": "a3f2d1c4-8b9e-4f0a-b1c2-d3e4f5a6b7c8",
        "noise_level": 4,
        "crowd_level": 3,
        "comfort_level": 5,
        "facility_rating": 4,
        "ambiance_rating": 4,
        "quiet_score": 8.00,
        "comment": "Very calm afternoon.",
        "reported_at": "2025-01-05T11:30:00.000Z",
        "reported_by": {
          "id": "user-uuid",
          "username": "jane_smith",
          "avatar_url": null
        },
        "helpfulness": {
          "helpful_count": 5,
          "not_helpful_count": 0,
          "my_vote": null
        }
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 24,
      "total_pages": 3
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
  "message": "Place not found",
  "data": null,
  "error": { "code": "NOT_FOUND" }
}
```

---

### Notes (Business Rules)

- [ ] `my_vote` is `true` (helpful), `false` (not helpful), or `null` (not voted); only present for authenticated users

---

## GET /api/reports/:reportId

### Title

> Get a single condition report by ID

### Description

Returns the full detail of a single condition report, including the place summary and reporter info.

---

### Authentication / Authorization

| Field         | Value  |
| ------------- | ------ |
| Auth Required | No     |
| Role(s)       | -      |
| Notes         | Public |

---

### Path Parameters

| Name     | Type   | Required | Description        |
| -------- | ------ | -------- | ------------------ |
| reportId | string | Yes      | UUID of the report |

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
    "report": {
      "id": "a3f2d1c4-8b9e-4f0a-b1c2-d3e4f5a6b7c8",
      "place": {
        "id": "7c9e6679-7425-40de-944b-e07fc1f90ae7",
        "name": "Kopi Kenangan Tenang",
        "slug": "kopi-kenangan-tenang-bandung",
        "city": "Bandung"
      },
      "noise_level": 4,
      "crowd_level": 3,
      "comfort_level": 5,
      "facility_rating": 4,
      "ambiance_rating": 4,
      "quiet_score": 8.00,
      "comment": "Very calm afternoon. Only 3 other people here.",
      "reported_at": "2025-01-05T11:30:00.000Z",
      "reported_by": {
        "id": "user-uuid",
        "username": "jane_smith",
        "avatar_url": null
      },
      "helpfulness": {
        "helpful_count": 5,
        "not_helpful_count": 0,
        "my_vote": null
      }
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
  "message": "Report not found",
  "data": null,
  "error": { "code": "NOT_FOUND" }
}
```

---

### Notes (Business Rules)

- [ ] No restrictions on viewing; all approved place reports are publicly readable

---

## DELETE /api/reports/:reportId

### Title

> Delete a condition report

### Description

Soft-deletes a condition report. After deletion, the place's aggregated `quiet_score` is recalculated. Only the report's author or an admin may delete it.

---

### Authentication / Authorization

| Field         | Value                         |
| ------------- | ----------------------------- |
| Auth Required | Yes                           |
| Role(s)       | user (own reports only), admin |
| Notes         | Bearer token required         |

---

### Path Parameters

| Name     | Type   | Required | Description        |
| -------- | ------ | -------- | ------------------ |
| reportId | string | Yes      | UUID of the report |

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
  "message": "Report deleted successfully",
  "data": null,
  "error": null
}
```

---

#### Error Responses

**403 Forbidden**

```json
{
  "message": "You are not allowed to delete this report",
  "data": null,
  "error": { "code": "FORBIDDEN" }
}
```

**404 Not Found**

```json
{
  "message": "Report not found",
  "data": null,
  "error": { "code": "NOT_FOUND" }
}
```

---

### Notes (Business Rules)

- [ ] Deleting a report triggers recalculation of the parent place's `quiet_score`

---

## POST /api/reports/:reportId/vote

### Title

> Vote a condition report as helpful or not helpful

### Description

Allows an authenticated user to cast a helpfulness vote on a condition report. Each user may only vote once per report; submitting again toggles or changes the vote.

---

### Authentication / Authorization

| Field         | Value                  |
| ------------- | ---------------------- |
| Auth Required | Yes                    |
| Role(s)       | user, moderator, admin |
| Notes         | Bearer token required  |

---

### Path Parameters

| Name     | Type   | Required | Description        |
| -------- | ------ | -------- | ------------------ |
| reportId | string | Yes      | UUID of the report |

---

### Query Parameters

None.

---

### Request Body (JSON)

```json
{
  "is_helpful": true
}
```

**Field Definitions**

| Field      | Type    | Required | Description                      |
| ---------- | ------- | -------- | -------------------------------- |
| is_helpful | boolean | Yes      | `true` = helpful, `false` = not helpful |

---

### Responses

#### Success - 200 OK

```json
{
  "message": "Vote recorded",
  "data": {
    "report_id": "a3f2d1c4-8b9e-4f0a-b1c2-d3e4f5a6b7c8",
    "is_helpful": true,
    "helpfulness": {
      "helpful_count": 6,
      "not_helpful_count": 0
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
  "message": "Cannot vote on your own report",
  "data": null,
  "error": { "code": "SELF_VOTE" }
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

**404 Not Found**

```json
{
  "message": "Report not found",
  "data": null,
  "error": { "code": "NOT_FOUND" }
}
```

---

### Notes (Business Rules)

- [ ] Voting on a report the user has already voted on overwrites the previous vote (upsert behavior)
- [ ] A user cannot vote on their own report