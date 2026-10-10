FROM node:22-bookworm-slim AS base
RUN apt-get -o Acquire::Retries=3 update \
    && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app

FROM base AS builder
COPY package*.json ./
RUN npm ci
COPY tsconfig.json ./
COPY prisma/ ./prisma/
RUN npx prisma generate
COPY src/ ./src/
RUN npx tsc

FROM base AS runner
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/src ./src
EXPOSE 3000
CMD ["node", "dist/app.js"]
