-- ============================================================
-- QuietSpace Finder — Auth Service Database Schema
-- Service   : auth-service
-- Database  : quietspace_auth
-- Engine    : MySQL 8.x (Docker)
-- Description: Handles user accounts, OAuth providers,
--              roles, refresh tokens, and audit trail.
-- ============================================================

CREATE DATABASE IF NOT EXISTS quietspace_auth
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE quietspace_auth;

-- ------------------------------------------------------------
-- Table: roles
-- Stores available system roles (admin, user, moderator)
-- ------------------------------------------------------------
CREATE TABLE roles (
  id          TINYINT UNSIGNED  NOT NULL AUTO_INCREMENT,
  name        VARCHAR(50)       NOT NULL,
  description VARCHAR(255)      NULL,
  created_at  TIMESTAMP         NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  UNIQUE KEY uq_roles_name (name)
) ENGINE=InnoDB COMMENT='System roles available for assignment';

-- Seed default roles
INSERT INTO roles (name, description) VALUES
  ('admin',     'Full system administrator with all privileges'),
  ('moderator', 'Can review and moderate place reports'),
  ('user',      'Regular authenticated user');

-- ------------------------------------------------------------
-- Table: users
-- Core user accounts — may register via email/password
-- or via an OAuth provider.
-- ------------------------------------------------------------
CREATE TABLE users (
  id               CHAR(36)          NOT NULL,            -- UUID v4
  role_id          TINYINT UNSIGNED  NOT NULL DEFAULT 3,  -- default: user
  username         VARCHAR(50)       NOT NULL,
  email            VARCHAR(191)      NOT NULL,
  password_hash    VARCHAR(255)      NULL,                 -- NULL for OAuth-only accounts
  display_name     VARCHAR(100)      NULL,
  avatar_url       VARCHAR(500)      NULL,
  bio              TEXT              NULL,
  is_active        TINYINT(1)        NOT NULL DEFAULT 1,
  is_email_verified TINYINT(1)       NOT NULL DEFAULT 0,
  email_verified_at TIMESTAMP        NULL,
  last_login_at    TIMESTAMP         NULL,
  created_at       TIMESTAMP         NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       TIMESTAMP         NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at       TIMESTAMP         NULL,                -- soft delete

  PRIMARY KEY (id),
  UNIQUE KEY uq_users_email    (email),
  UNIQUE KEY uq_users_username (username),
  KEY idx_users_role_id        (role_id),
  KEY idx_users_is_active      (is_active),
  KEY idx_users_deleted_at     (deleted_at),

  CONSTRAINT fk_users_role
    FOREIGN KEY (role_id) REFERENCES roles (id)
    ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB COMMENT='Core user accounts';

-- ------------------------------------------------------------
-- Table: oauth_providers
-- Reference list of supported OAuth providers
-- ------------------------------------------------------------
CREATE TABLE oauth_providers (
  id         TINYINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name       VARCHAR(50)      NOT NULL,  -- 'google', 'github'
  is_enabled TINYINT(1)       NOT NULL DEFAULT 1,
  created_at TIMESTAMP        NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  UNIQUE KEY uq_oauth_providers_name (name)
) ENGINE=InnoDB COMMENT='Supported OAuth provider registry';

INSERT INTO oauth_providers (name) VALUES ('google'), ('github');

-- ------------------------------------------------------------
-- Table: oauth_accounts
-- Links a user to one or more OAuth provider identities.
-- One user can have both Google and GitHub linked.
-- ------------------------------------------------------------
CREATE TABLE oauth_accounts (
  id                CHAR(36)         NOT NULL,  -- UUID v4
  user_id           CHAR(36)         NOT NULL,
  provider_id       TINYINT UNSIGNED NOT NULL,
  provider_user_id  VARCHAR(255)     NOT NULL,  -- provider's own user ID
  provider_email    VARCHAR(191)     NULL,
  access_token      TEXT             NULL,      -- encrypted at rest
  refresh_token     TEXT             NULL,      -- encrypted at rest
  token_expires_at  TIMESTAMP        NULL,
  raw_profile       JSON             NULL,      -- full provider profile snapshot
  created_at        TIMESTAMP        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        TIMESTAMP        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  UNIQUE KEY uq_oauth_provider_user (provider_id, provider_user_id),
  KEY idx_oauth_user_id             (user_id),

  CONSTRAINT fk_oauth_user
    FOREIGN KEY (user_id) REFERENCES users (id)
    ON UPDATE CASCADE ON DELETE CASCADE,

  CONSTRAINT fk_oauth_provider
    FOREIGN KEY (provider_id) REFERENCES oauth_providers (id)
    ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB COMMENT='OAuth provider identities linked to users';

-- ------------------------------------------------------------
-- Table: refresh_tokens
-- Stores hashed refresh tokens for JWT rotation strategy.
-- ------------------------------------------------------------
CREATE TABLE refresh_tokens (
  id          CHAR(36)     NOT NULL,  -- UUID v4
  user_id     CHAR(36)     NOT NULL,
  token_hash  VARCHAR(255) NOT NULL,  -- SHA-256 of the actual token
  user_agent  VARCHAR(500) NULL,
  ip_address  VARCHAR(45)  NULL,      -- IPv4 or IPv6
  expires_at  TIMESTAMP    NOT NULL,
  revoked_at  TIMESTAMP    NULL,
  created_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  UNIQUE KEY uq_refresh_token_hash (token_hash),
  KEY idx_refresh_user_id          (user_id),
  KEY idx_refresh_expires_at       (expires_at),

  CONSTRAINT fk_refresh_user
    FOREIGN KEY (user_id) REFERENCES users (id)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB COMMENT='Refresh token store for JWT rotation';

-- ------------------------------------------------------------
-- Table: email_verification_tokens
-- One-time tokens for verifying user email addresses.
-- ------------------------------------------------------------
CREATE TABLE email_verification_tokens (
  id         CHAR(36)     NOT NULL,
  user_id    CHAR(36)     NOT NULL,
  token_hash VARCHAR(255) NOT NULL,
  expires_at TIMESTAMP    NOT NULL,
  used_at    TIMESTAMP    NULL,
  created_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  UNIQUE KEY uq_email_ver_token (token_hash),
  KEY idx_email_ver_user_id     (user_id),

  CONSTRAINT fk_email_ver_user
    FOREIGN KEY (user_id) REFERENCES users (id)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB COMMENT='Email address verification tokens';

-- ------------------------------------------------------------
-- Table: password_reset_tokens
-- One-time tokens for password reset requests.
-- ------------------------------------------------------------
CREATE TABLE password_reset_tokens (
  id         CHAR(36)     NOT NULL,
  user_id    CHAR(36)     NOT NULL,
  token_hash VARCHAR(255) NOT NULL,
  expires_at TIMESTAMP    NOT NULL,
  used_at    TIMESTAMP    NULL,
  created_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  UNIQUE KEY uq_pwd_reset_token (token_hash),
  KEY idx_pwd_reset_user_id     (user_id),

  CONSTRAINT fk_pwd_reset_user
    FOREIGN KEY (user_id) REFERENCES users (id)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB COMMENT='Password reset one-time tokens';

-- ============================================================
-- End of auth_service_schema.sql
-- ============================================================

-- ------------------------------------------------------------
-- DUMMY DATA (5 Records)
-- ------------------------------------------------------------
INSERT IGNORE INTO users (id, role_id, username, email, password_hash, display_name, is_email_verified) VALUES
('11111111-1111-1111-1111-111111111111', 1, 'admin_qs', 'admin@quietspace.com', '$2a$12$abcdefghijklmnopqrstuv', 'System Admin', 1),
('22222222-2222-2222-2222-222222222222', 2, 'mod_qs', 'moderator@quietspace.com', '$2a$12$abcdefghijklmnopqrstuv', 'Chief Moderator', 1),
('33333333-3333-3333-3333-333333333333', 3, 'user_john', 'john@example.com', '$2a$12$abcdefghijklmnopqrstuv', 'John Quiet Seeker', 1),
('44444444-4444-4444-4444-444444444444', 3, 'user_jane', 'jane@example.com', '$2a$12$abcdefghijklmnopqrstuv', 'Jane Coffee Lover', 1),
('55555555-5555-5555-5555-555555555555', 3, 'user_bob', 'bob@example.com', '$2a$12$abcdefghijklmnopqrstuv', 'Bob Student', 1);