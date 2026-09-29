# Use Node.js 20 LTS Debian slim for fast builds and pre-built native module support (bcrypt)
FROM node:20-slim

WORKDIR /app

# Copy dependency manifests
COPY package*.json ./

# Install application dependencies
RUN npm ci

# Copy backend source
COPY . .

# Expose REST API port (5000) and self-hosted SMTP port (2525)
EXPOSE 5000 2525

# Default environment configuration
ENV NODE_ENV=production \
    PORT=5000 \
    SMTP_PORT=2525

# Launch the PhoneMail backend service
CMD ["node", "src/index.js"]
