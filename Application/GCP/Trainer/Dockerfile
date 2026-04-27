# Image PyTorch + CUDA fournie par NVIDIA. Pour CPU-only, utiliser python:3.11-slim.
FROM pytorch/pytorch:2.3.0-cuda12.1-cudnn8-runtime

ENV PYTHONUNBUFFERED=1
ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update \
 && apt-get install -y --no-install-recommends libgl1 libglib2.0-0 ffmpeg git \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY Trainer/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# On embarque le script d'export depuis le sous-projet Annotation/
COPY Annotation/backend/export_yolo.py /app/export_yolo.py
COPY Trainer/train.py /app/train.py

# Les modèles de base YOLO seront téléchargés au runtime par ultralytics.
ENV YOLO_CONFIG_DIR=/tmp/ultralytics

ENTRYPOINT ["python", "/app/train.py"]
