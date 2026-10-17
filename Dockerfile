FROM node:24-slim

ENV NODE_ENV=production

WORKDIR /app

# Dependencies first, so this layer is cached while only app code changes
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# App source. Node 24 strips TypeScript types at runtime, so src/prisma/db.ts
# runs as-is and no build step is needed.
COPY src ./src
COPY public ./public

EXPOSE 8080

# Run as the unprivileged user that ships with the Node image
USER node

CMD ["node", "src/server.js"]
