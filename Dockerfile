FROM python:3.11-slim

WORKDIR /app

# System dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Application code
COPY server/ ./server/
COPY run.py .

# Storage & Database persistent volume
VOLUME ["/app/storage", "/app/data"]

ENV PORT=8765
ENV STORAGE_DIR=/app/storage
ENV DATABASE_URL=sqlite:////app/data/cloudsync.db

EXPOSE 8765

CMD ["python", "run.py", "--host", "0.0.0.0"]
