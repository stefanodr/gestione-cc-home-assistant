FROM python:3.12-alpine

RUN apk add --no-cache openssl tzdata \
    && addgroup -S app \
    && adduser -S -G app app

WORKDIR /app
COPY gestione_cc/server.py /app/server.py
COPY gestione_cc/login.html gestione_cc/login.css gestione_cc/login.js /app/www/
COPY gestione_cc/www/ /app/www/

RUN mkdir -p /data /data/tls /data/backups \
    && chown -R app:app /app /data

ENV DATA_DIR=/data \
    WWW_DIR=/app/www \
    ADDON_OPTIONS_FILE=/data/options.json \
    SSL_DIR=/data/tls \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

COPY docker-test/entrypoint.sh /entrypoint.sh
RUN chmod 755 /entrypoint.sh

USER app
EXPOSE 8443
ENTRYPOINT ["/entrypoint.sh"]
