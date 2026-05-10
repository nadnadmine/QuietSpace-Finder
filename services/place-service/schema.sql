-- ============================================================
-- QuietSpace Finder — Place & Report Service Database Schema
-- Service   : place-service
-- Database  : quietspace_places
-- Engine    : MySQL 8.x (Docker)
-- Description: Manages place listings, user-submitted condition
--              reports, quiet scoring, tags, and bookmarks.
-- ============================================================

CREATE DATABASE IF NOT EXISTS quietspace_places
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE quietspace_places;

-- ------------------------------------------------------------
-- Table: place_categories
-- High-level classification of venues.
-- ------------------------------------------------------------
CREATE TABLE place_categories (
  id          TINYINT UNSIGNED NOT NULL AUTO_INCREMENT,
  slug        VARCHAR(60)      NOT NULL,  -- e.g. 'cafe', 'library', 'coworking'
  label       VARCHAR(100)     NOT NULL,
  icon_url    VARCHAR(500)     NULL,
  created_at  TIMESTAMP        NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  UNIQUE KEY uq_categories_slug (slug)
) ENGINE=InnoDB COMMENT='Venue category reference table';

INSERT INTO place_categories (slug, label) VALUES
  ('cafe',       'Café / Coffee Shop'),
  ('library',    'Library'),
  ('coworking',  'Co-working Space'),
  ('park',       'Outdoor Park / Garden'),
  ('restaurant', 'Restaurant (quiet area)'),
  ('hotel_lobby','Hotel Lobby'),
  ('other',      'Other');

-- ------------------------------------------------------------
-- Table: places
-- Core venue information submitted by users or admins.
-- ------------------------------------------------------------
CREATE TABLE places (
  id               CHAR(36)         NOT NULL,  -- UUID v4
  category_id      TINYINT UNSIGNED NOT NULL,
  submitted_by     CHAR(36)         NOT NULL,  -- auth-service user UUID
  name             VARCHAR(150)     NOT NULL,
  slug             VARCHAR(180)     NOT NULL,  -- URL-friendly, unique
  description      TEXT             NULL,
  address          VARCHAR(300)     NOT NULL,
  city             VARCHAR(100)     NOT NULL,
  province         VARCHAR(100)     NULL,
  country_code     CHAR(2)          NOT NULL DEFAULT 'ID',
  latitude         DECIMAL(10,7)    NOT NULL,
  longitude        DECIMAL(10,7)    NOT NULL,
  google_place_id  VARCHAR(255)     NULL,
  cover_image_url  VARCHAR(500)     NULL,
  website_url      VARCHAR(500)     NULL,
  phone            VARCHAR(30)      NULL,
  -- Aggregated quiet score (0.00 – 10.00), recalculated on each new report
  quiet_score      DECIMAL(4,2)     NOT NULL DEFAULT 0.00,
  report_count     INT UNSIGNED     NOT NULL DEFAULT 0,
  status           ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
  is_verified      TINYINT(1)       NOT NULL DEFAULT 0,
  created_at       TIMESTAMP        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       TIMESTAMP        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at       TIMESTAMP        NULL,

  PRIMARY KEY (id),
  UNIQUE KEY uq_places_slug        (slug),
  KEY idx_places_category_id       (category_id),
  KEY idx_places_city              (city),
  KEY idx_places_quiet_score       (quiet_score),
  KEY idx_places_status            (status),
  KEY idx_places_deleted_at        (deleted_at),
  KEY idx_places_latlon            (latitude, longitude),

  CONSTRAINT fk_places_category
    FOREIGN KEY (category_id) REFERENCES place_categories (id)
    ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB COMMENT='Registered quiet-place venues';

-- ------------------------------------------------------------
-- Table: place_images
-- Additional photos uploaded by users for a place.
-- ------------------------------------------------------------
CREATE TABLE place_images (
  id           CHAR(36)      NOT NULL,
  place_id     CHAR(36)      NOT NULL,
  uploaded_by  CHAR(36)      NOT NULL,  -- auth-service user UUID
  image_url    VARCHAR(500)  NOT NULL,
  caption      VARCHAR(255)  NULL,
  is_primary   TINYINT(1)    NOT NULL DEFAULT 0,
  created_at   TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  KEY idx_place_images_place_id (place_id),

  CONSTRAINT fk_place_images_place
    FOREIGN KEY (place_id) REFERENCES places (id)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB COMMENT='Gallery images for a place';

-- ------------------------------------------------------------
-- Table: tags
-- Free-form labels users can attach to places (e.g. "wifi",
-- "power outlet", "no music", "cozy", "24h").
-- ------------------------------------------------------------
CREATE TABLE tags (
  id         SMALLINT UNSIGNED NOT NULL AUTO_INCREMENT,
  slug       VARCHAR(60)       NOT NULL,
  label      VARCHAR(80)       NOT NULL,
  created_at TIMESTAMP         NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  UNIQUE KEY uq_tags_slug (slug)
) ENGINE=InnoDB COMMENT='Descriptive tags for places';

INSERT INTO tags (slug, label) VALUES
  ('wifi',           'Free Wi-Fi'),
  ('power-outlet',   'Power Outlets Available'),
  ('no-music',       'No Background Music'),
  ('ac',             'Air Conditioned'),
  ('24h',            'Open 24 Hours'),
  ('outdoor',        'Outdoor Seating'),
  ('study-friendly', 'Study Friendly'),
  ('quiet-zone',     'Dedicated Quiet Zone'),
  ('no-phone-calls', 'No Phone Calls Policy'),
  ('parking',        'Parking Available');

-- ------------------------------------------------------------
-- Table: place_tags
-- Many-to-many link between places and tags.
-- ------------------------------------------------------------
CREATE TABLE place_tags (
  place_id   CHAR(36)          NOT NULL,
  tag_id     SMALLINT UNSIGNED NOT NULL,
  added_by   CHAR(36)          NOT NULL,  -- auth-service user UUID
  created_at TIMESTAMP         NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (place_id, tag_id),

  CONSTRAINT fk_place_tags_place
    FOREIGN KEY (place_id) REFERENCES places (id)
    ON UPDATE CASCADE ON DELETE CASCADE,

  CONSTRAINT fk_place_tags_tag
    FOREIGN KEY (tag_id) REFERENCES tags (id)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB COMMENT='Many-to-many place ↔ tag association';

-- ------------------------------------------------------------
-- Table: condition_reports
-- The core of QuietSpace Finder — real-time user reports
-- about the current condition of a place.
-- Each report captures five dimensions (1–5 scale):
--   noise_level     : 1 = very noisy  → 5 = very quiet
--   crowd_level     : 1 = very crowded → 5 = nearly empty
--   comfort_level   : 1 = uncomfortable → 5 = very comfortable
--   facility_rating : 1 = poor facilities → 5 = excellent
--   ambiance_rating : 1 = bad vibe → 5 = great vibe
-- ------------------------------------------------------------
CREATE TABLE condition_reports (
  id               CHAR(36)         NOT NULL,  -- UUID v4
  place_id         CHAR(36)         NOT NULL,
  reported_by      CHAR(36)         NOT NULL,  -- auth-service user UUID
  -- Five-dimension ratings (1–5)
  noise_level      TINYINT UNSIGNED NOT NULL CHECK (noise_level BETWEEN 1 AND 5),
  crowd_level      TINYINT UNSIGNED NOT NULL CHECK (crowd_level BETWEEN 1 AND 5),
  comfort_level    TINYINT UNSIGNED NOT NULL CHECK (comfort_level BETWEEN 1 AND 5),
  facility_rating  TINYINT UNSIGNED NOT NULL CHECK (facility_rating BETWEEN 1 AND 5),
  ambiance_rating  TINYINT UNSIGNED NOT NULL CHECK (ambiance_rating BETWEEN 1 AND 5),
  -- Weighted composite quiet score stored for fast aggregation
  quiet_score      DECIMAL(4,2)     NOT NULL,
  comment          TEXT             NULL,
  reported_at      TIMESTAMP        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at       TIMESTAMP        NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  KEY idx_reports_place_id      (place_id),
  KEY idx_reports_reported_by   (reported_by),
  KEY idx_reports_reported_at   (reported_at),
  KEY idx_reports_quiet_score   (quiet_score),

  CONSTRAINT fk_reports_place
    FOREIGN KEY (place_id) REFERENCES places (id)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB COMMENT='Real-time user condition reports for a place';

-- Index to prevent duplicate reports from the same user within 30 minutes
-- (enforced at application layer; this index speeds up the lookup)
CREATE INDEX idx_reports_user_time ON condition_reports (reported_by, place_id, reported_at);

-- ------------------------------------------------------------
-- Table: report_helpfulness
-- Users can mark a condition report as helpful/unhelpful.
-- ------------------------------------------------------------
CREATE TABLE report_helpfulness (
  report_id  CHAR(36)  NOT NULL,
  user_id    CHAR(36)  NOT NULL,  -- auth-service user UUID
  is_helpful TINYINT(1) NOT NULL, -- 1 = helpful, 0 = not helpful
  created_at TIMESTAMP  NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (report_id, user_id),

  CONSTRAINT fk_helpfulness_report
    FOREIGN KEY (report_id) REFERENCES condition_reports (id)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB COMMENT='Helpfulness votes on condition reports';

-- ------------------------------------------------------------
-- Table: bookmarks
-- Users can save favourite places.
-- ------------------------------------------------------------
CREATE TABLE bookmarks (
  user_id    CHAR(36)  NOT NULL,  -- auth-service user UUID
  place_id   CHAR(36)  NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (user_id, place_id),
  KEY idx_bookmarks_place_id (place_id),

  CONSTRAINT fk_bookmarks_place
    FOREIGN KEY (place_id) REFERENCES places (id)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB COMMENT='User bookmarked / saved places';

-- ------------------------------------------------------------
-- Table: opening_hours
-- Flexible store for each day's opening hours per place.
-- ------------------------------------------------------------
CREATE TABLE opening_hours (
  id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  place_id   CHAR(36)     NOT NULL,
  day_of_week TINYINT UNSIGNED NOT NULL CHECK (day_of_week BETWEEN 0 AND 6), -- 0=Sun … 6=Sat
  open_time  TIME         NULL,  -- NULL = closed that day
  close_time TIME         NULL,
  is_closed  TINYINT(1)   NOT NULL DEFAULT 0,
  created_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  UNIQUE KEY uq_opening_hours_place_day (place_id, day_of_week),

  CONSTRAINT fk_opening_hours_place
    FOREIGN KEY (place_id) REFERENCES places (id)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB COMMENT='Weekly opening hours for each place';

-- ============================================================
-- End of place_service_schema.sql
-- ============================================================

-- ------------------------------------------------------------
-- DUMMY DATA (5 Records)
-- ------------------------------------------------------------
INSERT IGNORE INTO places (id, category_id, submitted_by, name, slug, address, city, latitude, longitude, quiet_score, status, is_verified) VALUES
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 1, '11111111-1111-1111-1111-111111111111', 'Silent Cafe', 'silent-cafe', 'Jl. Merdeka 1', 'Jakarta', -6.2000000, 106.8000000, 8.50, 'approved', 1),
('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 2, '22222222-2222-2222-2222-222222222222', 'Central Library', 'central-library', 'Jl. Pustaka 2', 'Bandung', -6.9000000, 107.6000000, 9.20, 'approved', 1),
('cccccccc-cccc-cccc-cccc-cccccccccccc', 3, '33333333-3333-3333-3333-333333333333', 'Focus Coworking', 'focus-coworking', 'Jl. Kerja 3', 'Surabaya', -7.2000000, 112.7000000, 7.80, 'approved', 1),
('dddddddd-dddd-dddd-dddd-dddddddddddd', 4, '44444444-4444-4444-4444-444444444444', 'Green Park', 'green-park', 'Jl. Alam 4', 'Yogyakarta', -7.7000000, 110.3000000, 6.50, 'approved', 0),
('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 5, '55555555-5555-5555-5555-555555555555', 'Quiet Resto', 'quiet-resto', 'Jl. Makan 5', 'Bali', -8.6000000, 115.2000000, 8.00, 'pending', 0);