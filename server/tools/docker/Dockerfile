FROM python:3.11-slim

ENV PYTHONUNBUFFERED=1

# Install build deps needed by some freqtrade dependencies
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
       gcc libffi-dev libssl-dev build-essential git curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy wrapper internals
COPY freqtrade_wrapper_inner.py /app/
COPY entrypoint.sh /app/

# Install freqtrade (pin or change as needed)
RUN pip install --no-cache-dir freqtrade

RUN chmod +x /app/entrypoint.sh

ENTRYPOINT ["/app/entrypoint.sh"]
