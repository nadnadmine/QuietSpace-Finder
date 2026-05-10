-- ============================================================
-- QuietSpace Finder — Notification Service Database Schema
-- Service   : notification-service  (PHP CodeIgniter 4)
-- Database  : quietspace_notifications
-- Engine    : MySQL 8.x (Docker)
-- Description: Stores notifications delivered to users,
--              event logs consumed from RabbitMQ, and
--              user notification preferences.
-- ============================================================

CREATE DATABASE IF NOT EXISTS quietspace_notifications
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE quietspace_notifications;

-- ------------------------------------------------------------
-- Table: notification_types
-- Catalogue of all notification types the system can emit.
-- ------------------------------------------------------------
CREATE TABLE notification_types (
  id          TINYINT UNSIGNED NOT NULL AUTO_INCREMENT,
  code        VARCHAR(80)      NOT NULL,  -- e.g. 'place.approved', 'report.submitted'
  label       VARCHAR(150)     NOT NULL,
  description TEXT             NULL,
  channel     ENUM('in_app','email','push','all') NOT NULL DEFAULT 'in_app',
  is_active   TINYINT(1)       NOT NULL DEFAULT 1,
  created_at  TIMESTAMP        NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  UNIQUE KEY uq_notification_types_code (code)
) ENGINE=InnoDB COMMENT='Catalogue of notification event types';

INSERT INTO notification_types (code, label, channel) VALUES
  ('place.submitted',        'New place submitted for review',          'in_app'),
  ('place.approved',         'Your place submission was approved',       'email'),
  ('place.rejected',         'Your place submission was rejected',       'email'),
  ('report.submitted',       'New condition report submitted',           'in_app'),
  ('report.flagged',         'Your report was flagged for review',       'in_app'),
  ('user.welcome',           'Welcome to QuietSpace Finder',             'email'),
  ('user.password_reset',    'Password reset requested',                 'email'),
  ('user.email_verified',    'Email address verified',                   'in_app'),
  ('bookmark.quiet_alert',   'A bookmarked place is now quiet',          'in_app'),
  ('system.announcement',    'System announcement',                      'all');

-- ------------------------------------------------------------
-- Table: notifications
-- Individual notification records delivered to a user.
-- ------------------------------------------------------------
CREATE TABLE notifications (
  id                  CHAR(36)         NOT NULL,  -- UUID v4
  notification_type_id TINYINT UNSIGNED NOT NULL,
  recipient_user_id   CHAR(36)         NOT NULL,  -- auth-service user UUID
  title               VARCHAR(200)     NOT NULL,
  body                TEXT             NOT NULL,
  action_url          VARCHAR(500)     NULL,  -- deep-link for the notification
  metadata            JSON             NULL,  -- arbitrary extra payload
  is_read             TINYINT(1)       NOT NULL DEFAULT 0,
  read_at             TIMESTAMP        NULL,
  sent_at             TIMESTAMP        NULL,
  created_at          TIMESTAMP        NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  KEY idx_notifications_recipient    (recipient_user_id),
  KEY idx_notifications_type_id      (notification_type_id),
  KEY idx_notifications_is_read      (is_read),
  KEY idx_notifications_created_at   (created_at),

  CONSTRAINT fk_notifications_type
    FOREIGN KEY (notification_type_id) REFERENCES notification_types (id)
    ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB COMMENT='Per-user notification inbox';

-- ------------------------------------------------------------
-- Table: user_notification_preferences
-- Allows each user to opt in/out of specific notification types
-- and choose preferred delivery channel.
-- ------------------------------------------------------------
CREATE TABLE user_notification_preferences (
  id                   INT UNSIGNED     NOT NULL AUTO_INCREMENT,
  user_id              CHAR(36)         NOT NULL,  -- auth-service user UUID
  notification_type_id TINYINT UNSIGNED NOT NULL,
  is_enabled           TINYINT(1)       NOT NULL DEFAULT 1,
  preferred_channel    ENUM('in_app','email','push') NOT NULL DEFAULT 'in_app',
  updated_at           TIMESTAMP        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  UNIQUE KEY uq_user_notif_pref (user_id, notification_type_id),
  KEY idx_user_notif_pref_user  (user_id),

  CONSTRAINT fk_user_notif_pref_type
    FOREIGN KEY (notification_type_id) REFERENCES notification_types (id)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB COMMENT='Per-user notification opt-in/out preferences';

-- ------------------------------------------------------------
-- Table: event_logs
-- Append-only log of every RabbitMQ event consumed by this
-- service. Provides full audit trail and supports idempotency
-- via the event_id deduplication key.
-- ------------------------------------------------------------
CREATE TABLE event_logs (
  id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  event_id        CHAR(36)        NOT NULL,  -- UUID from publisher (idempotency key)
  event_type      VARCHAR(100)    NOT NULL,  -- mirrors routing key, e.g. 'report.submitted'
  source_service  VARCHAR(80)     NULL,      -- originating service name
  payload         JSON            NULL,
  status          ENUM('received','processed','failed','skipped') NOT NULL DEFAULT 'received',
  error_message   TEXT            NULL,
  attempts        TINYINT UNSIGNED NOT NULL DEFAULT 0,
  processed_at    TIMESTAMP       NULL,
  received_at     TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  UNIQUE KEY uq_event_logs_event_id  (event_id),  -- prevents duplicate processing
  KEY idx_event_logs_type            (event_type),
  KEY idx_event_logs_status          (status),
  KEY idx_event_logs_received_at     (received_at)
) ENGINE=InnoDB COMMENT='Audit log of all consumed RabbitMQ events';

-- ------------------------------------------------------------
-- Table: failed_events
-- Dead-letter queue mirror for events that exhausted retries.
-- Allows manual inspection and reprocessing.
-- ------------------------------------------------------------
CREATE TABLE failed_events (
  id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  event_log_id    BIGINT UNSIGNED NOT NULL,
  event_id        CHAR(36)        NOT NULL,
  event_type      VARCHAR(100)    NOT NULL,
  payload         JSON            NULL,
  failure_reason  TEXT            NULL,
  failed_at       TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  retry_at        TIMESTAMP       NULL,
  is_resolved     TINYINT(1)      NOT NULL DEFAULT 0,

  PRIMARY KEY (id),
  KEY idx_failed_events_event_log_id (event_log_id),
  KEY idx_failed_events_is_resolved  (is_resolved),

  CONSTRAINT fk_failed_events_log
    FOREIGN KEY (event_log_id) REFERENCES event_logs (id)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB COMMENT='Dead-letter store for failed RabbitMQ events';

-- ============================================================
-- End of notification_service_schema.sql
-- ============================================================

-- ------------------------------------------------------------
-- DUMMY DATA (5 Records)
-- ------------------------------------------------------------
INSERT IGNORE INTO notifications (id, notification_type_id, recipient_user_id, title, body) VALUES
('ffffffff-ffff-ffff-ffff-ffffffffffff', 6, '11111111-1111-1111-1111-111111111111', 'Welcome Admin', 'Welcome to QuietSpace admin panel.'),
('gggggggg-gggg-gggg-gggg-gggggggggggg', 6, '22222222-2222-2222-2222-222222222222', 'Welcome Moderator', 'Start reviewing places.'),
('hhhhhhhh-hhhh-hhhh-hhhh-hhhhhhhhhhhh', 2, '11111111-1111-1111-1111-111111111111', 'Place Approved', 'Your place Silent Cafe was approved.'),
('iiiiiiii-iiii-iiii-iiii-iiiiiiiiiiii', 6, '33333333-3333-3333-3333-333333333333', 'Welcome to QuietSpace', 'Find quiet places now!'),
('jjjjjjjj-jjjj-jjjj-jjjj-jjjjjjjjjjjj', 4, '22222222-2222-2222-2222-222222222222', 'New Report Submitted', 'A new report needs your attention.');