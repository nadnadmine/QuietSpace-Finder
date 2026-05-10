# API Specification - Bookmarks & Tags

> File: paths/bookmarks-tags.md
> Owner: QuietSpace Finder — Place Service
> Last Updated: 2025-01-01
> Service: place-service (Node.js / Express.js)
> Base URL (via Gateway): /api/bookmarks, /api/tags

---

## GET /api/bookmarks

### Title

> List the authenticated user's bookmarked places

### Description

Returns all places the authenticated user has bookmarked, with their current quiet score and latest condition data.

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

| Name   | Type    | Required | Default    | Description                        |
| ------ | ------- | -------- | ---------- | ---------------------------------- |
| page   | integer | No       | 1          | Page number                        |
| limit  | integer | No       | 20         | Items per page (max 50)            |
| sortBy | string  | No       | created_at | `created_at` or `quiet_score`      |
| order  | string  | No       | desc       | `asc` or `desc`                    |

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
    "bookmarks": [
      {
        "place": {
          "id": "7c9e6679-7425-40de-944b-e07fc1f90ae7",
          "name": "Kopi Kenangan Tenang",
          "slug": "kopi-kenangan-tenang-bandung",
          "category": { "slug": "cafe", "label": "Café / Coffee Shop" },
          "city": "Bandung",
          "cover_image_url": "https://storage.example.com/places/kopi-kenangan.jpg",
          "quiet_score": 8.50,
          "report_count": 24
        },
        "bookmarked_at": "2025-01-03T07:00:00.000Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 5,
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

---

### Notes (Business Rules)

- [ ] Bookmarks pointing to soft-deleted places are excluded from results

---

## POST /api/bookmarks/:placeId

### Title

> Bookmark a place

### Description

Adds the specified place to the authenticated user's bookmarks. Idempotent — bookmarking an already-bookmarked place returns 200 without error.

---

### Authentication / Authorization

| Field         | Value                  |
| ------------- | ---------------------- |
| Auth Required | Yes                    |
| Role(s)       | user, moderator, admin |
| Notes         | Bearer token required  |

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

#### Success - 201 Created

```json
{
  "message": "Place bookmarked",
  "data": {
    "place_id": "7c9e6679-7425-40de-944b-e07fc1f90ae7",
    "bookmarked_at": "2025-01-06T10:00:00.000Z"
  },
  "error": null
}
```

#### Success - 200 OK (already bookmarked)

```json
{
  "message": "Place is already bookmarked",
  "data": {
    "place_id": "7c9e6679-7425-40de-944b-e07fc1f90ae7",
    "bookmarked_at": "2025-01-03T07:00:00.000Z"
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
  "message": "Place not found",
  "data": null,
  "error": { "code": "NOT_FOUND" }
}
```

---

### Notes (Business Rules)

- [ ] Only approved, non-deleted places can be bookmarked

---

## DELETE /api/bookmarks/:placeId

### Title

> Remove a place from bookmarks

### Description

Removes the specified place from the authenticated user's bookmarks. Idempotent — removing a place that was never bookmarked returns 200 without error.

---

### Authentication / Authorization

| Field         | Value                  |
| ------------- | ---------------------- |
| Auth Required | Yes                    |
| Role(s)       | user, moderator, admin |
| Notes         | Bearer token required  |

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
  "message": "Bookmark removed",
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

- [ ] No error is returned if the bookmark does not exist (idempotent delete)

---

## GET /api/tags

### Title

> List all available tags

### Description

Returns the full list of available tags that can be associated with places. Used to populate tag selector UIs.

---

### Authentication / Authorization

| Field         | Value  |
| ------------- | ------ |
| Auth Required | No     |
| Role(s)       | -      |
| Notes         | Public endpoint |

---

### Path Parameters

None.

---

### Query Parameters

| Name   | Type   | Required | Default | Description           |
| ------ | ------ | -------- | ------- | --------------------- |
| search | string | No       | -       | Filter tags by label  |

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
    "tags": [
      { "id": 1, "slug": "wifi", "label": "Free Wi-Fi" },
      { "id": 2, "slug": "power-outlet", "label": "Power Outlets Available" },
      { "id": 3, "slug": "no-music", "label": "No Background Music" },
      { "id": 4, "slug": "ac", "label": "Air Conditioned" },
      { "id": 5, "slug": "24h", "label": "Open 24 Hours" },
      { "id": 6, "slug": "outdoor", "label": "Outdoor Seating" },
      { "id": 7, "slug": "study-friendly", "label": "Study Friendly" },
      { "id": 8, "slug": "quiet-zone", "label": "Dedicated Quiet Zone" },
      { "id": 9, "slug": "no-phone-calls", "label": "No Phone Calls Policy" },
      { "id": 10, "slug": "parking", "label": "Parking Available" }
    ]
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

- [ ] Tags are global and managed by admins; regular users cannot create new tags via this endpoint

---

## POST /api/tags

### Title

> Create a new tag (admin only)

### Description

Creates a new tag that can be associated with places.

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

None.

---

### Request Body (JSON)

```json
{
  "slug": "string",
  "label": "string"
}
```

**Field Definitions**

| Field | Type   | Required | Description                                     |
| ----- | ------ | -------- | ----------------------------------------------- |
| slug  | string | Yes      | URL-friendly identifier, max 60 chars, unique   |
| label | string | Yes      | Human-readable label, max 80 chars              |

---

### Responses

#### Success - 201 Created

```json
{
  "message": "Tag created successfully",
  "data": {
    "tag": {
      "id": 11,
      "slug": "pet-friendly",
      "label": "Pet Friendly",
      "created_at": "2025-01-06T10:00:00.000Z"
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
  "error": { "code": "VALIDATION_ERROR", "details": { "slug": "Slug must be lowercase and hyphen-separated" } }
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

**409 Conflict**

```json
{
  "message": "A tag with this slug already exists",
  "data": null,
  "error": { "code": "DUPLICATE_SLUG" }
}
```

---

### Notes (Business Rules)

- [ ] Slug must match the pattern `^[a-z0-9]+(-[a-z0-9]+)*$`

---

## GET /api/places/categories

### Title

> List all place categories

### Description

Returns all available place categories for use in place submission and filter UIs.

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
  "message": "Success",
  "data": {
    "categories": [
      { "id": 1, "slug": "cafe",       "label": "Café / Coffee Shop" },
      { "id": 2, "slug": "library",    "label": "Library" },
      { "id": 3, "slug": "coworking",  "label": "Co-working Space" },
      { "id": 4, "slug": "park",       "label": "Outdoor Park / Garden" },
      { "id": 5, "slug": "restaurant", "label": "Restaurant (quiet area)" },
      { "id": 6, "slug": "hotel_lobby","label": "Hotel Lobby" },
      { "id": 7, "slug": "other",      "label": "Other" }
    ]
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

- [ ] Categories are seeded at database initialization and do not change frequently; responses may be cached for up to 1 hour