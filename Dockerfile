FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    DEPLOYMENT_MODE=hosted \
    APP_ENV=production \
    DEMO_AUTH_ENABLED=false

WORKDIR /app

COPY api_server/requirements-deploy.txt ./api_server/requirements-deploy.txt
RUN pip install --no-cache-dir -r api_server/requirements-deploy.txt
ARG INSTALL_VECTOR_RAG=0
COPY api_server/requirements-rag.txt ./api_server/requirements-rag.txt
RUN if [ "$INSTALL_VECTOR_RAG" = "1" ]; then pip install --no-cache-dir -r api_server/requirements-rag.txt; fi

# The API uses this canonical machine catalog to resolve simulator records.
COPY api_server/ ./api_server/
COPY knowledge/ ./knowledge/
COPY public/machine-name.json ./public/machine-name.json
COPY public/available-machine-ids.json ./public/available-machine-ids.json
COPY config/ ./config/
COPY scripts/provision_initial_admin.py ./scripts/provision_initial_admin.py
COPY deploy/artifacts/health-model-v2/ ./.local/health-model-v2/

RUN addgroup --system app && adduser --system --ingroup app --no-create-home app \
    && mkdir -p /app/.local && chown -R app:app /app/.local /app/config
USER app

EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s CMD python -c "import urllib.request,os; urllib.request.urlopen('http://127.0.0.1:'+os.getenv('PORT','8000')+'/ready',timeout=4)"
CMD ["sh", "-c", "exec uvicorn api_server.main:app --host 0.0.0.0 --port ${PORT:-8000} --workers 1 --no-proxy-headers"]
