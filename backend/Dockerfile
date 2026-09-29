# ── Sandesh Backend Dockerfile ─────────────────────────────────────────────────
# Node.js 20 LTS on Debian Slim — required for bcrypt native bindings

FROM node:20-slim

# Install dumb-init for proper PID 1 signal handling (graceful shutdown)
RUN apt-get update && apt-get install -y --no-install-recommends dumb-init \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy dependency manifests first (Docker layer caching)
COPY package*.json ./

# Install production dependencies only
RUN npm ci --omit=dev

# Copy backend source code
COPY . .

# Create uploads directory structure for avatar storage
RUN mkdir -p uploads/avatars

# Expose REST API port and self-hosted SMTP port
EXPOSE 5000 2525

# Default environment configuration for Docker context
ENV NODE_ENV=production \
    PORT=5000 \
    SMTP_PORT=2525

# Use dumb-init to handle signals properly (SIGTERM → graceful shutdown)
ENTRYPOINT ["dumb-init", "--"]

# Launch the Sandesh backend service
CMD ["node", "src/index.js"]
