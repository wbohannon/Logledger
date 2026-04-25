# Stage 1: build frontend
FROM node:20-slim AS frontend
WORKDIR /build
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm ci 2>/dev/null || npm install
COPY frontend/ .
RUN npm run build

# Stage 2: app (backend + serve frontend). Full node image includes OpenSSL for Prisma.
FROM node:20
WORKDIR /app

COPY backend/package.json backend/package-lock.json* ./
RUN npm ci --omit=dev 2>/dev/null || npm install --omit=dev
COPY backend/ .
COPY --from=frontend /build/dist ./frontend/dist

RUN npx prisma generate

ENV NODE_ENV=production
ENV PORT=3000

# SQLite DB path (use volume mount at /app/data)
ENV DATABASE_URL="file:/app/data/sqlite.db"

EXPOSE 3000
CMD ["node", "src/index.js"]
