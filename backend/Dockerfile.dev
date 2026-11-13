FROM node:24-alpine

WORKDIR /app

RUN apk add --no-cache curl

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 5000

HEALTHCHECK --interval=10s --timeout=5s --retries=3 \
  CMD curl -f http://localhost:5000/api/health || exit 1

CMD ["npm", "run", "dev"]
