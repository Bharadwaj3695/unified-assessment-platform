# UAP Execution Orchestrator Service Dockerfile
FROM node:22-alpine

WORKDIR /app

RUN apk add --no-cache curl

COPY package*.json ./
RUN npm ci --omit=dev

COPY src/ ./src/

ENV NODE_ENV=production \
    PORT=5050 \
    DOCKER_SOCKET_PATH=/var/run/docker.sock

EXPOSE 5050

HEALTHCHECK --interval=10s --timeout=5s --retries=3 \
  CMD curl -f http://localhost:5050/health || exit 1

CMD ["node", "src/server.js"]
