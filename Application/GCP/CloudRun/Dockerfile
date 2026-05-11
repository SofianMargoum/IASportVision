# syntax=docker/dockerfile:1.6
# -----------------------------------------------------------------------------
# Cloud Run image (services: iasv-cloudrun, video-processor).
# Optimisée pour la taille : on force PyTorch CPU-only (gain ~2 GB), pas de
# multi-stage (pas nécessaire pour Python pur), pip --no-cache-dir + slim base.
# -----------------------------------------------------------------------------
FROM python:3.11-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

# Dépendances système minimales (ffmpeg pour le découpage vidéo, libgl/glib
# requis par opencv-python-headless).
RUN apt-get update \
 && apt-get install -y --no-install-recommends \
        ffmpeg \
        libgl1 \
        libglib2.0-0 \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# 1) Installer torch + torchvision en CPU AVANT le reste : ultralytics ne
#    réinstallera pas la variante CUDA si elle est déjà présente. Gain ~2 GB.
RUN pip install --no-cache-dir \
        --index-url https://download.pytorch.org/whl/cpu \
        "torch==2.3.1" "torchvision==0.18.1"

# 2) Reste des dépendances applicatives.
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Code applicatif.
COPY app.py .
COPY ball_tracker ./ball_tracker
COPY frontend ./frontend

ENV PORT=8080

CMD exec gunicorn --bind 0.0.0.0:$PORT --workers 1 --threads 8 --timeout 0 app:app
