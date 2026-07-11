-- Migration 007 : moteur d'enregistrement HLS Live (capture directe FFmpeg).
--
-- Le moteur HLS remplace l'export Hik-Connect (save/download-url) par une
-- capture FFmpeg du flux HLS Live (api/hccgw/video/v1/live/address/get),
-- exécutée dans un Cloud Run Job (process longue durée, jusqu'à 2 h).
-- App Engine orchestre ; Cloud SQL reste la source de vérité.
--
-- Idempotent.

-- 1) Autoriser le statut métier INTERROMPU (capture interrompue / erreur worker).
ALTER TABLE current_recording DROP CONSTRAINT IF EXISTS current_recording_status_check;
ALTER TABLE current_recording ADD CONSTRAINT current_recording_status_check
  CHECK (status IN ('EN_COURS', 'COMPLET', 'TIMEOUT', 'ERREUR', 'INTERROMPU'));

-- 2) Colonnes spécifiques HLS.
--    live_url : URL HLS signée (contient un token) — NE JAMAIS journaliser.
ALTER TABLE current_recording ADD COLUMN IF NOT EXISTS device_serial      TEXT;
ALTER TABLE current_recording ADD COLUMN IF NOT EXISTS live_url           TEXT;
ALTER TABLE current_recording ADD COLUMN IF NOT EXISTS stop_requested     BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE current_recording ADD COLUMN IF NOT EXISTS execution_name     TEXT;
ALTER TABLE current_recording ADD COLUMN IF NOT EXISTS capture_started_at TIMESTAMPTZ;
ALTER TABLE current_recording ADD COLUMN IF NOT EXISTS heartbeat_at       TIMESTAMPTZ;
ALTER TABLE current_recording ADD COLUMN IF NOT EXISTS temp_gcs_path      TEXT;

-- 3) Reprise / supervision : retrouver vite les captures HLS actives.
CREATE INDEX IF NOT EXISTS current_recording_hls_active_idx
  ON current_recording (heartbeat_at)
  WHERE engine = 'hls'
    AND state IS NOT NULL
    AND state NOT IN ('COMPLETED', 'FAILED');
