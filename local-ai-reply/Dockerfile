FROM oven/bun:1.3-alpine

WORKDIR /app
COPY package.json ./
RUN bun -e 'const packageJson = await Bun.file("package.json").json(); delete packageJson.devDependencies; await Bun.write("package.json", JSON.stringify(packageJson));'
RUN bun install --production --registry=https://registry.npmjs.org
COPY server.ts redis-memory.ts sufy-docs.md ./

EXPOSE 3001
CMD ["bun", "run", "server.ts"]
