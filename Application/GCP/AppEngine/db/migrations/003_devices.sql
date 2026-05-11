-- Migration 003 : table devices (caméras HikConnect rattachées à un club).
-- Idempotent : peut être exécuté plusieurs fois sans erreur.
--
-- Note : pour rester cohérent avec les autres tables (clubs.id en UUID),
-- on utilise UUID pour `devices.id` et `devices.club_id` plutôt que SERIAL.
-- La FK ON DELETE CASCADE supprime les caméras si le club est supprimé.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS devices (
  id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id         UUID         NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  hik_device_id   TEXT         NOT NULL UNIQUE,
  name            TEXT,
  serial_number   TEXT,
  status          TEXT,
  raw_data        JSONB,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS devices_club_id_idx ON devices (club_id);

-- Réutilise la fonction set_updated_at() définie en migration 001.
DROP TRIGGER IF EXISTS devices_set_updated_at ON devices;
CREATE TRIGGER devices_set_updated_at
  BEFORE UPDATE ON devices
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
