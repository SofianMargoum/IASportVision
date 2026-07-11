# Cloud Run Job : capture HLS Live via FFmpeg, streamée directement vers GCS.
# Node 22 + ffmpeg système (apt). Image volontairement minimale.
FROM node:22-bookworm-slim

# ffmpeg pour la capture/remux ; ca-certificates pour HTTPS (HLS + GCS).
RUN apt-get update \
 && apt-get install -y --no-install-recommends ffmpeg ca-certificates \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Dépendances d'abord (cache Docker).
COPY package.json ./
RUN npm install --omit=dev --no-audit --no-fund

# Code du worker.
COPY worker.js ./

# Le worker lit ROLLING_ID (override d'exécution) + la config DB/GCS (env du job).
CMD ["node", "worker.js"]
