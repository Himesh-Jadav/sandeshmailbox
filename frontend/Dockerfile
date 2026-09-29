# Stage 1: Build Vite React Application
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package manifests
COPY package*.json ./

# Install dependencies (including devDependencies needed for build)
RUN npm ci

# Copy application source code
COPY . .

# Build the production distribution
RUN npm run build

# Stage 2: Production Nginx Server
FROM nginx:alpine

# Copy compiled assets from build stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy custom Nginx reverse proxy configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Expose default HTTP port
EXPOSE 80

# Run Nginx in foreground
CMD ["nginx", "-g", "daemon off;"]
