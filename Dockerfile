# ==========================================================
# Multi-stage production container setup for IT Helpdesk app
# ==========================================================

# --- Build Stage ---
FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# --- Runtime Stage ---
FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production

COPY package*.json ./
RUN npm ci --only=production

# Copy static frontend assets and typescript code files
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server.ts ./
COPY --from=builder /app/src/types.ts ./src/
COPY --from=builder /app/src/dataStore.ts ./src/

# Install server launch utilities
RUN npm install -g tsx esbuild

# Expose HTTP + WS entry point port
EXPOSE 3000

# Start compiled server
CMD ["node", "dist/server.cjs"]
