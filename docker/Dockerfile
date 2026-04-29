# ── Build Linux binary inside Linux (Mach-O from macOS host cannot run in Debian) ──
FROM oven/bun:1.2 AS builder
WORKDIR /build
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile
COPY src ./src
COPY web/dist ./web/dist
RUN bun build --compile src/main.ts --outfile /build/nerve-hub

FROM debian:bookworm-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates curl \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /build/nerve-hub /app/nerve-hub
RUN chmod +x /app/nerve-hub

COPY web/dist /app/web/dist

ENV NERVE_DB_PATH=/data/hub.db
ENV NERVE_WEB_DIST=/app/web/dist

VOLUME ["/data"]

EXPOSE 3141

CMD ["/app/nerve-hub", "start"]
