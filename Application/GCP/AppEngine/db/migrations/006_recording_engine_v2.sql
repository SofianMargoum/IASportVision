-- Migration 006 : moteur d'enregistrement V2 (machine d'état, source de vérité Cloud SQL).
--
-- Le moteur V2 remplace le pipeline "chunks 60s + merge ffmpeg" par un EXPORT
-- UNIQUE au STOP : un seul save Hik-Connect sur [début, fin], poll download-url,
-- puis streaming HTTP→GCS direct (aucun ffmpeg, aucune fusion, mémoire plate).
--
-- L'état du moteur est porté par la colonne `state` (FSM) ; `status` reste le
-- statut métier coarse (EN_COURS / COMPLET / TIMEOUT / ERREUR). Les deux
-- coexistent : `state` pilote le moteur, `status` résume pour l'UI/reporting.
--
-- Idempotent : ADD COLUMN IF NOT EXISTS partout. N'impacte pas les lignes V1
-- existantes (engine reste 'v1', state reste NULL).

ALTER TABLE current_recording ADD COLUMN IF NOT EXISTS engine              TEXT NOT NULL DEFAULT 'v1';
ALTER TABLE current_recording ADD COLUMN IF NOT EXISTS state               TEXT;
ALTER TABLE current_recording ADD COLUMN IF NOT EXISTS hik_task_id         TEXT;
ALTER TABLE current_recording ADD COLUMN IF NOT EXISTS export_begin_iso    TEXT;
ALTER TABLE current_recording ADD COLUMN IF NOT EXISTS export_end_iso      TEXT;
ALTER TABLE current_recording ADD COLUMN IF NOT EXISTS cam_offset          TEXT;
ALTER TABLE current_recording ADD COLUMN IF NOT EXISTS voice_switch        INTEGER;
ALTER TABLE current_recording ADD COLUMN IF NOT EXISTS attempts            INTEGER NOT NULL DEFAULT 0;
ALTER TABLE current_recording ADD COLUMN IF NOT EXISTS next_action_at      TIMESTAMPTZ;
ALTER TABLE current_recording ADD COLUMN IF NOT EXISTS dismissed_at        TIMESTAMPTZ;
ALTER TABLE current_recording ADD COLUMN IF NOT EXISTS thumbnail_generated BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE current_recording ADD COLUMN IF NOT EXISTS thumb_json          JSONB;
ALTER TABLE current_recording ADD COLUMN IF NOT EXISTS download_url        TEXT;
ALTER TABLE current_recording ADD COLUMN IF NOT EXISTS auto_timeout        BOOLEAN NOT NULL DEFAULT FALSE;

-- Contrainte de domaine sur la FSM (idempotente : on drop puis recrée).
ALTER TABLE current_recording DROP CONSTRAINT IF EXISTS current_recording_state_chk;
ALTER TABLE current_recording ADD CONSTRAINT current_recording_state_chk
  CHECK (state IS NULL OR state IN (
    'IDLE',
    'RECORDING',
    'EXPORTING',
    'WAITING_DOWNLOAD_URL',
    'DOWNLOADING',
    'FINALIZING',
    'COMPLETED',
    'FAILED'
  ));

-- Reprise après crash / balayage : retrouver vite les sessions V2 actives
-- (état non terminal) dont l'action est due.
CREATE INDEX IF NOT EXISTS current_recording_v2_active_idx
  ON current_recording (next_action_at)
  WHERE engine = 'v2'
    AND state IS NOT NULL
    AND state NOT IN ('COMPLETED', 'FAILED');
