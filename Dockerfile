FROM node:24-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts --no-audit --no-fund
COPY . .
RUN npm run build

FROM node:24-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/db/migrations ./db/migrations
COPY --from=builder --chown=node:node /app/scripts/migrate.ts /app/scripts/provision-runtime-logins.ts /app/scripts/expire-import-drafts.ts ./scripts/
USER node
EXPOSE 3000
CMD ["node", "server.js"]
