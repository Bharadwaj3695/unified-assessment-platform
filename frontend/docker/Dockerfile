# Stage 1: Build the Vite production bundle
FROM node:20.11.1-alpine3.19 AS builder

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

# Stage 2: Production Nginx web server
FROM nginx:1.27.5-alpine

# Remove default static HTML
RUN rm -rf /usr/share/nginx/html/*

# Copy pre-built production assets from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy custom Nginx configuration
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf

# Install curl for container healthcheck probe
RUN apk add --no-cache curl

EXPOSE 80 5173

HEALTHCHECK --interval=10s --timeout=5s --retries=3 \
  CMD curl -f http://localhost:80/health || exit 1

CMD ["nginx", "-g", "daemon off;"]
