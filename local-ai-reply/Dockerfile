FROM node:22-alpine

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts
COPY server.mjs redis-memory.mjs ./

USER node
EXPOSE 3001
CMD ["node", "server.mjs"]
