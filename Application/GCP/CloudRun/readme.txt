Je veux créer un service backend prêt pour Google Cloud Run.

Contraintes :
- langage : Python
- framework : Flask
- doit exposer une API HTTP
- port dynamique via variable d'environnement PORT
- endpoint GET / pour test
- endpoint POST /process qui reçoit du JSON avec { videoUrl }

- pour l’instant je veux juste un service fonctionnel minimal

Je veux que tu génères :

1. app.py complet :
- Flask app
- route GET /
- route POST /process qui retourne le JSON reçu

2. requirements.txt :
- flask
- gunicorn

3. Dockerfile compatible Cloud Run :
- basé sur python:3.11-slim
- installe requirements
- expose port via $PORT
- lance avec gunicorn

4. Commandes pour :
- build docker local
- run docker local
- déployer sur Google Cloud Run avec gcloud