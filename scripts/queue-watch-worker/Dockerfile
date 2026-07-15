# Build from repository root:
#   fly deploy --config scripts/queue-watch-worker/fly.toml

FROM mcr.microsoft.com/playwright:v1.51.1-jammy

WORKDIR /app

COPY scripts/queue-watch-worker/package.json scripts/queue-watch-worker/package-lock.json* ./scripts/queue-watch-worker/
WORKDIR /app/scripts/queue-watch-worker
RUN npm install

WORKDIR /app
COPY lib/pokemon-center ./lib/pokemon-center
COPY scripts/queue-watch-worker ./scripts/queue-watch-worker

WORKDIR /app/scripts/queue-watch-worker

ENV PROFILE_DIR=/data/pc-profile
ENV NODE_ENV=production

VOLUME ["/data"]

CMD ["npx", "tsx", "src/index.ts"]
