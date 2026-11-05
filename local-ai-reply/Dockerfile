FROM oven/bun:1.3-alpine

WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production
COPY server.ts redis-memory.ts ./

EXPOSE 3001
CMD ["bun", "run", "server.ts"]
