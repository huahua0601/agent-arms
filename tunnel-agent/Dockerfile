# syntax=docker/dockerfile:1

# ---- Stage 1: build wheels for the pinned dependencies ----
FROM python:3.11-slim AS builder

WORKDIR /build
COPY requirements.txt .
RUN pip wheel --no-cache-dir --wheel-dir /wheels -r requirements.txt

# ---- Stage 2: minimal runtime ----
FROM python:3.11-slim AS runtime

# Install dependencies from the prebuilt wheels (no network needed at this layer).
COPY --from=builder /wheels /wheels
COPY requirements.txt /tmp/requirements.txt
RUN pip install --no-cache-dir --no-index --find-links=/wheels -r /tmp/requirements.txt \
    && rm -rf /wheels /tmp/requirements.txt

# Run as a non-root user.
RUN useradd --create-home --uid 10001 tunnel
USER tunnel
WORKDIR /home/tunnel

COPY --chown=tunnel:tunnel agent.py .

ENTRYPOINT ["python", "agent.py"]
