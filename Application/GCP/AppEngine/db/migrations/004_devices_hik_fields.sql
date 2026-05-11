-- Migration 004 : ajout des colonnes device_id / camera_id à `devices`.
-- Aligne le schéma sur le format Hik-Connect réel utilisé par l'app mobile :
--   nom       <- camera.name
--   deviceId  <- camera.device.devInfo.id
--   cameraId  <- camera.id           (identifiant unique de caméra Hik-Connect)
--
-- Idempotent : peut être exécuté plusieurs fois sans erreur.

ALTER TABLE devices
  ADD COLUMN IF NOT EXISTS device_id TEXT,
  ADD COLUMN IF NOT EXISTS camera_id TEXT;

-- Pour les lignes existantes, on rapatrie hik_device_id dans camera_id
-- afin de conserver l'unicité par caméra.
UPDATE devices
   SET camera_id = hik_device_id
 WHERE camera_id IS NULL
   AND hik_device_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS devices_camera_id_unique_idx
  ON devices (camera_id)
  WHERE camera_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS devices_device_id_idx
  ON devices (device_id);
