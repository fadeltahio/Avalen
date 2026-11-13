# Avalen server: serves the API and the built web app from one process.
# With DATABASE_URL (PostgreSQL) and AVALEN_R2_* (file storage) set, it keeps nothing
# on disk. Without them, mount a persistent volume at /data for the SQLite file,
# uploaded files and daily snapshots.
FROM node:24-slim AS build
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@10.34.9 --activate
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build

FROM node:24-slim
# ffmpeg/ffprobe validate uploaded videos and voice notes and make thumbnails.
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@10.34.9 --activate
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --prod --frozen-lockfile
COPY server ./server
COPY src/avalen ./src/avalen
COPY --from=build /app/dist ./dist
RUN mkdir -p /data && chown node:node /data
ENV NODE_ENV=production \
  HOST=0.0.0.0 \
  PORT=8080 \
  AVALEN_DATA_DIR=/data \
  AVALEN_SECURE_COOKIE=true
USER node
EXPOSE 8080
CMD ["node", "server/index.js"]
