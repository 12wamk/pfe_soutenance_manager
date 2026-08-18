# ============================================================
# Microservice IA — Flask + OR-Tools (auto-planning CP-SAT)
# ============================================================
FROM python:3.11-slim

WORKDIR /app

COPY backend/ai-service/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/ai-service/app.py ./

# La connexion MySQL est configurée par variables d'environnement (docker-compose)
ENV DB_HOST=db \
    DB_NAME=pfe_soutenance_manager \
    DB_USER=pfe \
    DB_PASS=pfe_pass_2026

EXPOSE 5001

HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=5 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:5001/impact-stats', timeout=4)"

CMD ["python", "app.py"]
