-- Migration 002 : table clubs (clubs IA Sport Vision référencés via FFF DOFA).
-- Idempotent : peut être exécuté plusieurs fois sans erreur.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS clubs (
  id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  fff_cl_no   TEXT         NOT NULL UNIQUE,
  name        TEXT         NOT NULL,
  logo_url    TEXT,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS clubs_name_lower_idx ON clubs (LOWER(name));

-- Réutilise la fonction set_updated_at() définie en migration 001.
DROP TRIGGER IF EXISTS clubs_set_updated_at ON clubs;
CREATE TRIGGER clubs_set_updated_at
  BEFORE UPDATE ON clubs
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
