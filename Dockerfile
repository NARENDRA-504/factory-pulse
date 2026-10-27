FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

COPY api_server/requirements.txt ./api_server/requirements.txt
RUN pip install --no-cache-dir -r api_server/requirements.txt

# The API uses this canonical machine catalog to resolve simulator records.
COPY api_server/main.py ./api_server/main.py
COPY public/machine-name.json ./public/machine-name.json
COPY scripts/provision_initial_admin.py ./scripts/provision_initial_admin.py

RUN addgroup --system app && adduser --system --ingroup app --no-create-home app
USER app

EXPOSE 8000
CMD ["sh", "-c", "uvicorn api_server.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
