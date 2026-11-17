FROM node:22-slim AS base
WORKDIR /app

# Install build tools required for native modules (better-sqlite3)
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

ENV NODE_ENV=production
ENV PORT=3000
ENV SQLITE_DB_PATH=/app/data/ecommerce.sqlite

VOLUME ["/app/data"]
EXPOSE 3000

CMD ["npm", "start"]
