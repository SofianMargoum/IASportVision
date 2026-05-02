-- Migration 001 : table users + index + extension uuid.
-- Idempotent : peut être exécuté plusieurs fois sans erreur.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
  id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  username      TEXT         NOT NULL UNIQUE,
  email         TEXT         UNIQUE,
  password_hash TEXT         NOT NULL,
  name          TEXT         NOT NULL,
  role          TEXT         NOT NULL CHECK (role IN ('coach', 'player', 'supporter', 'admin')),
  club_id       TEXT,
  photo_asset   TEXT,
  is_active     BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Recherche insensible à la casse sur username.
CREATE UNIQUE INDEX IF NOT EXISTS users_username_lower_idx
  ON users (LOWER(username));

CREATE INDEX IF NOT EXISTS users_role_idx     ON users (role);
CREATE INDEX IF NOT EXISTS users_is_active_idx ON users (is_active);

-- Trigger pour updated_at.
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS users_set_updated_at ON users;
CREATE TRIGGER users_set_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
