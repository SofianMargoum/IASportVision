-- Migration 008 : refresh tokens rotatifs et révocables.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS refresh_tokens (
  id                   UUID         PRIMARY KEY,
  user_id              UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_id           UUID         NOT NULL,
  token_hash           TEXT         NOT NULL UNIQUE,
  expires_at           TIMESTAMPTZ  NOT NULL,
  last_used_at         TIMESTAMPTZ,
  rotated_at           TIMESTAMPTZ,
  revoked_at           TIMESTAMPTZ,
  revoked_reason       TEXT,
  replaced_by_token_id UUID         REFERENCES refresh_tokens(id) ON DELETE SET NULL,
  created_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS refresh_tokens_user_id_idx
  ON refresh_tokens (user_id);

CREATE INDEX IF NOT EXISTS refresh_tokens_session_id_idx
  ON refresh_tokens (session_id);

CREATE INDEX IF NOT EXISTS refresh_tokens_expires_at_idx
  ON refresh_tokens (expires_at);

CREATE INDEX IF NOT EXISTS refresh_tokens_active_session_idx
  ON refresh_tokens (session_id, revoked_at, expires_at);

DROP TRIGGER IF EXISTS refresh_tokens_set_updated_at ON refresh_tokens;
CREATE TRIGGER refresh_tokens_set_updated_at
  BEFORE UPDATE ON refresh_tokens
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();