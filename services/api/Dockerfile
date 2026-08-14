# syntax=docker/dockerfile:1

FROM python:3.11.15-slim-bookworm

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

RUN groupadd --system zhishi \
    && useradd --system --gid zhishi --home-dir /app --no-create-home zhishi

COPY pyproject.toml README.md ./
COPY app ./app

RUN python -m pip install .

USER zhishi

EXPOSE 10000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:10000/health', timeout=4)"

CMD ["sh", "-c", "exec uvicorn app.main:app --host 0.0.0.0 --port \"${PORT:-10000}\" --proxy-headers --forwarded-allow-ips=\"*\""]
