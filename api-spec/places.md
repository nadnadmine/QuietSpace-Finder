# API Specification - Places

> File: paths/places.md
> Owner: QuietSpace Finder — Place Service
> Last Updated: 2025-01-01
> Service: place-service (Node.js / Express.js)
> Base URL (via Gateway): /api/places

---

## GET /api/places

### Title

> List and search places with quiet score filtering

### Description

Returns a paginated, filterable list of approved places. Supports filtering by city, category, quiet score range, and tags. Results are sorted by quiet score by default, making it the primary discovery endpoint.

---

### Authentication / Authorization

| Field         | Value  |
| ------------- | ------ |
| Auth Required | No     |
| Role(s)       | -      |
| Notes         | Public endpoint. Authenticated users additionally see their bookmark status. |

---

### Path Parameters

None.

---

### Query Parameters

| Name          | Type    | Required | Default     | Description                                             |
| ------------- | ------- | -------- | ----------- | ------------------------------------------------------- |
| page          | integer | No       | 1           | Page number                                             |
| limit         | integer | No       | 20          | Items per page (max 50)                                 |
| search        | string  | No       | -           | Search by place name or address                         |
| city          | string  | No       | -           | Filter by city name (case-insensitive)                  |
| category      | string  | No       | -           | Filter by category slug (e.g. `cafe`, `library`)        |
| tags          | string  | No       | -           | Comma-separated tag slugs (e.g. `wifi,no-music`)        |
| min_score     | number  | No       | 0           | Minimum quiet score (0–10)                              |
| max_score     | number  | No       | 10          | Maximum quiet score (0–10)                              |
| lat           | number  | No       | -           | Latitude for proximity sort (requires `lng`)            |
| lng           | number  | No       | -           | Longitude for proximity sort (requires `lat`)           |
| radius_km     | number  | No       | 5           | Radius in km when `lat`/`lng` provided                  |
| sortBy        | string  | No       | quiet_score | Sort field: `quiet_score`, `distance`, `report_count`, `created_at` |
| order         | string  | No       | desc        | `asc` or `desc`                                         |

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
    "places": [
      {
        "id": "7c9e6679-7425-40de-944b-e07fc1f90ae7",
        "name": "Kopi Kenangan Tenang",
        "slug": "kopi-kenangan-tenang-bandung",
        "category": { "id": 1, "slug": "cafe", "label": "Café / Coffee Shop" },
        "address": "Jl. Dago No. 42, Bandung",
        "city": "Bandung",
        "country_code": "ID",
        "latitude": -6.8955,
        "longitude": 107.6123,
        "cover_image_url": "https://storage.example.com/places/kopi-kenangan.jpg",
        "quiet_score": 8.50,
        "report_count": 24,
        "tags": ["wifi", "ac", "study-friendly"],
        "is_bookmarked": false,
        "distance_km": 1.2
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 85,
      "total_pages": 5
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
    "details": { "min_score": "Must be between 0 and 10" }
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

- [ ] Only places with `status = 'approved'` and `deleted_at IS NULL` are returned
- [ ] `is_bookmarked` is only populated when the request includes a valid Bearer token
- [ ] `distance_km` is only populated when `lat` and `lng` query params are provided
- [ ] Proximity search uses the Haversine formula

---

## POST /api/places

### Title

> Submit a new place

### Description

Allows an authenticated user to submit a new place for review. The place enters a `pending` status and must be approved by a moderator or admin before becoming publicly visible. A `place.submitted` event is published to RabbitMQ.

---

### Authentication / Authorization

| Field         | Value                  |
| ------------- | ---------------------- |
| Auth Required | Yes                    |
| Role(s)       | moderator / admin |
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
  "name": "string",
  "category_id": 1,
  "description": "string | null",
  "address": "string",
  "city": "string",
  "province": "string | null",
  "country_code": "ID",
  "latitude": -6.8955,
  "longitude": 107.6123,
  "google_place_id": "string | null",
  "website_url": "string | null",
  "phone": "string | null",
  "cover_image_url": "string | null",
  "tag_ids": [1, 2, 3],
  "opening_hours": [
    { "day_of_week": 1, "open_time": "07:00", "close_time": "22:00", "is_closed": false }
  ]
}
```

**Field Definitions**

| Field           | Type     | Required | Description                                            |
| --------------- | -------- | -------- | ------------------------------------------------------ |
| name            | string   | Yes      | Place name, max 150 characters                         |
| category_id     | integer  | Yes      | ID from `place_categories` table                       |
| description     | string   | No       | Full description of the place                          |
| address         | string   | Yes      | Street address                                         |
| city            | string   | Yes      | City name                                              |
| province        | string   | No       | Province or state                                      |
| country_code    | string   | No       | ISO 3166-1 alpha-2 code, defaults to `ID`              |
| latitude        | number   | Yes      | Decimal latitude (-90 to 90)                           |
| longitude       | number   | Yes      | Decimal longitude (-180 to 180)                        |
| google_place_id | string   | No       | Google Maps place ID for cross-referencing             |
| website_url     | string   | No       | Valid URL                                              |
| phone           | string   | No       | Contact phone number                                   |
| cover_image_url | string   | No       | Valid URL to a cover image                             |
| tag_ids         | integer[]| No       | Array of tag IDs to associate                          |
| opening_hours   | object[] | No       | Array of daily hours (see sub-fields below)            |

**opening_hours sub-fields**

| Field       | Type    | Required | Description                    |
| ----------- | ------- | -------- | ------------------------------ |
| day_of_week | integer | Yes      | 0 = Sunday … 6 = Saturday      |
| open_time   | string  | No       | `HH:MM` 24-hour format         |
| close_time  | string  | No       | `HH:MM` 24-hour format         |
| is_closed   | boolean | No       | `true` if closed that day      |

---

### Responses

#### Success - 201 Created

```json
{
  "message": "Place submitted successfully. Pending review.",
  "data": {
    "place": {
      "id": "7c9e6679-7425-40de-944b-e07fc1f90ae7",
      "name": "Kopi Tenang Bandung",
      "slug": "kopi-tenang-bandung",
      "status": "pending",
      "created_at": "2025-01-01T10:00:00.000Z"
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
    "details": { "latitude": "Must be between -90 and 90" }
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

**409 Conflict**

```json
{
  "message": "A place with this name and location already exists",
  "data": null,
  "error": { "code": "DUPLICATE_PLACE" }
}
```

---

### Notes (Business Rules)

- [ ] A URL-friendly slug is auto-generated from `name + city`
- [ ] Admins and moderators may set `status` directly in the request body, bypassing the pending state
- [ ] Publishes `place.submitted` event to RabbitMQ after successful insert

---

## GET /api/places/:placeId

### Title

> Get a single place by ID

### Description

Returns the full detail view of an approved place, including all tags, opening hours, the latest 5 condition reports, and aggregated score breakdown.

---

### Authentication / Authorization

| Field         | Value  |
| ------------- | ------ |
| Auth Required | No     |
| Role(s)       | -      |
| Notes         | Public. Authenticated users additionally see bookmark status and whether they have reported in the last 30 minutes. |

---

### Path Parameters

| Name    | Type   | Required | Description     |
| ------- | ------ | -------- | --------------- |
| placeId | string | Yes      | UUID of the place |

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
    "place": {
      "id": "7c9e6679-7425-40de-944b-e07fc1f90ae7",
      "name": "Kopi Kenangan Tenang",
      "slug": "kopi-kenangan-tenang-bandung",
      "category": { "id": 1, "slug": "cafe", "label": "Café / Coffee Shop" },
      "description": "A cozy corner café with a dedicated study zone.",
      "address": "Jl. Dago No. 42, Bandung",
      "city": "Bandung",
      "province": "Jawa Barat",
      "country_code": "ID",
      "latitude": -6.8955,
      "longitude": 107.6123,
      "cover_image_url": "https://storage.example.com/places/kopi-kenangan.jpg",
      "images": [
        { "id": "uuid", "image_url": "https://...", "caption": "Study corner", "is_primary": false }
      ],
      "website_url": "https://kopikenangan.com",
      "phone": "+62811234567",
      "quiet_score": 8.50,
      "report_count": 24,
      "score_breakdown": {
        "avg_noise_level": 4.2,
        "avg_crowd_level": 3.8,
        "avg_comfort_level": 4.5,
        "avg_facility_rating": 4.0,
        "avg_ambiance_rating": 4.3
      },
      "tags": [
        { "id": 1, "slug": "wifi", "label": "Free Wi-Fi" },
        { "id": 3, "slug": "no-music", "label": "No Background Music" }
      ],
      "opening_hours": [
        { "day_of_week": 1, "open_time": "07:00", "close_time": "22:00", "is_closed": false }
      ],
      "is_bookmarked": true,
      "can_report": true,
      "status": "approved",
      "is_verified": true,
      "submitted_by": "550e8400-e29b-41d4-a716-446655440000",
      "created_at": "2025-01-01T10:00:00.000Z",
      "updated_at": "2025-01-05T12:00:00.000Z",
      "latest_reports": [
        {
          "id": "report-uuid",
          "quiet_score": 8.8,
          "noise_level": 4,
          "crowd_level": 4,
          "comfort_level": 5,
          "facility_rating": 4,
          "ambiance_rating": 5,
          "comment": "Very quiet today, great for deep work.",
          "reported_at": "2025-01-05T11:00:00.000Z",
          "reported_by": { "id": "user-uuid", "username": "jane_smith", "avatar_url": null }
        }
      ]
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

- [ ] `can_report` is `true` only for authenticated users who have not submitted a report for this place in the last 30 minutes
- [ ] `latest_reports` returns the 5 most recent reports ordered by `reported_at DESC`

---

## PATCH /api/places/:placeId

### Title

> Update place details

### Description

Allows the original submitter (or a moderator/admin) to update place information. Changes to coordinates or name trigger re-validation.

---

### Authentication / Authorization

| Field         | Value                                                        |
| ------------- | ------------------------------------------------------------ |
| Auth Required | Yes                                                          |
| Role(s)       | user (own submissions only), moderator, admin                |
| Notes         | Regular users can only edit their own pending/approved submissions |

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
  "name": "string | null",
  "description": "string | null",
  "address": "string | null",
  "city": "string | null",
  "website_url": "string | null",
  "phone": "string | null",
  "cover_image_url": "string | null",
  "tag_ids": [1, 2]
}
```

**Field Definitions**

| Field           | Type     | Required | Description                             |
| --------------- | -------- | -------- | --------------------------------------- |
| name            | string   | No       | Updated place name                      |
| description     | string   | No       | Updated description                     |
| address         | string   | No       | Updated street address                  |
| city            | string   | No       | Updated city                            |
| website_url     | string   | No       | Updated website URL                     |
| phone           | string   | No       | Updated phone number                    |
| cover_image_url | string   | No       | Updated cover image URL                 |
| tag_ids         | integer[]| No       | Replaces the entire tag set             |

---

### Responses

#### Success - 200 OK

```json
{
  "message": "Place updated successfully",
  "data": {
    "place": {
      "id": "7c9e6679-7425-40de-944b-e07fc1f90ae7",
      "name": "Kopi Kenangan Tenang (Updated)",
      "updated_at": "2025-01-06T09:00:00.000Z"
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
  "message": "You are not allowed to edit this place",
  "data": null,
  "error": { "code": "FORBIDDEN" }
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

---

### Notes (Business Rules)

- [ ] `tag_ids` fully replaces existing tags (not a merge); send the complete desired set
- [ ] Coordinate changes are not allowed via this endpoint; only moderators/admins may update coordinates

---

## DELETE /api/places/:placeId

### Title

> Soft-delete a place

### Description

Soft-deletes a place by setting its `deleted_at` timestamp. The place disappears from all public listings but data is retained. Only the original submitter or an admin may perform this action.

---

### Authentication / Authorization

| Field         | Value                         |
| ------------- | ----------------------------- |
| Auth Required | Yes                           |
| Role(s)       | user (own submissions), admin |
| Notes         | Bearer token required         |

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

None - no request body.

---

### Responses

#### Success - 200 OK

```json
{
  "message": "Place deleted successfully",
  "data": null,
  "error": null
}
```

---

#### Error Responses

**403 Forbidden**

```json
{
  "message": "You are not allowed to delete this place",
  "data": null,
  "error": { "code": "FORBIDDEN" }
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

---

### Notes (Business Rules)

- [ ] Publishes a `place.deleted` event to RabbitMQ for audit purposes

---

## PATCH /api/places/:placeId/status

### Title

> Approve or reject a submitted place (moderator/admin only)

### Description

Updates the moderation status of a place. Approved places become publicly visible. A `place.approved` or `place.rejected` event is published to RabbitMQ, triggering a notification to the submitting user.

---

### Authentication / Authorization

| Field         | Value              |
| ------------- | ------------------ |
| Auth Required | Yes                |
| Role(s)       | moderator, admin   |
| Notes         | Bearer token required |

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
  "status": "approved",
  "rejection_reason": "string | null"
}
```

**Field Definitions**

| Field            | Type   | Required | Description                                         |
| ---------------- | ------ | -------- | --------------------------------------------------- |
| status           | string | Yes      | `approved` or `rejected`                            |
| rejection_reason | string | No       | Required when `status` is `rejected`; sent to user  |

---

### Responses

#### Success - 200 OK

```json
{
  "message": "Place status updated to approved",
  "data": {
    "place_id": "7c9e6679-7425-40de-944b-e07fc1f90ae7",
    "status": "approved"
  },
  "error": null
}
```

---

#### Error Responses

**400 Bad Request**

```json
{
  "message": "rejection_reason is required when rejecting a place",
  "data": null,
  "error": { "code": "VALIDATION_ERROR" }
}
```

**403 Forbidden**

```json
{
  "message": "Moderator or Admin access required",
  "data": null,
  "error": { "code": "FORBIDDEN" }
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

---

### Notes (Business Rules)

- [ ] Publishes `place.approved` or `place.rejected` event to RabbitMQ with `submitter_user_id` and `rejection_reason` in the payload

---

## GET /api/places/recommendations

### Title

> Get personalized quiet place recommendations

### Description

Returns a curated list of the quietest places based on recent condition reports. Optionally filters by the user's city or current geolocation. Prioritizes places with reports submitted in the last 2 hours for maximum freshness.

---

### Authentication / Authorization

| Field         | Value  |
| ------------- | ------ |
| Auth Required | No     |
| Role(s)       | -      |
| Notes         | Public. Authenticated users additionally exclude places they have already bookmarked. |

---

### Path Parameters

None.

---

### Query Parameters

| Name      | Type    | Required | Default | Description                                        |
| --------- | ------- | -------- | ------- | -------------------------------------------------- |
| city      | string  | No       | -       | Filter recommendations by city                     |
| category  | string  | No       | -       | Filter by category slug                            |
| lat       | number  | No       | -       | Current latitude for proximity-based results       |
| lng       | number  | No       | -       | Current longitude for proximity-based results      |
| radius_km | number  | No       | 3       | Radius in km when coordinates are provided         |
| limit     | integer | No       | 10      | Number of results (max 20)                         |

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
    "recommendations": [
      {
        "id": "7c9e6679-7425-40de-944b-e07fc1f90ae7",
        "name": "Kopi Kenangan Tenang",
        "slug": "kopi-kenangan-tenang-bandung",
        "category": { "slug": "cafe", "label": "Café / Coffee Shop" },
        "address": "Jl. Dago No. 42, Bandung",
        "city": "Bandung",
        "cover_image_url": "https://storage.example.com/places/kopi-kenangan.jpg",
        "quiet_score": 8.50,
        "recent_quiet_score": 9.10,
        "report_count": 24,
        "last_reported_at": "2025-01-05T11:00:00.000Z",
        "tags": ["wifi", "no-music"],
        "distance_km": 0.8
      }
    ],
    "generated_at": "2025-01-05T12:00:00.000Z"
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
  "error": { "code": "VALIDATION_ERROR", "details": { "lat": "lng is required when lat is provided" } }
}
```

---

### Notes (Business Rules)

- [ ] `recent_quiet_score` is the average quiet score from reports in the last 2 hours; falls back to `quiet_score` if no recent reports exist
- [ ] Places with fewer than 3 total reports are excluded from recommendations
- [ ] Results are sorted by `recent_quiet_score DESC` then `report_count DESC`