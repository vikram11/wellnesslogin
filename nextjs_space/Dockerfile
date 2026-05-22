# — Stage 1: Install dependencies —
FROM node:22-alpine AS deps
WORKDIR /app

RUN corepack enable && corepack prepare yarn@4.13.0 --activate

COPY package.json .yarnrc.yml ./
COPY prisma ./prisma/

RUN rm -f yarn.lock && \
    yarn install && \
    yarn prisma generate

# — Stage 2: Build —
FROM node:22-alpine AS builder
WORKDIR /app

RUN corepack enable && corepack prepare yarn@4.13.0 --activate

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/yarn.lock ./yarn.lock
COPY . .

ARG NEXT_PUBLIC_VAPID_PUBLIC_KEY
ENV NEXT_PUBLIC_VAPID_PUBLIC_KEY=$NEXT_PUBLIC_VAPID_PUBLIC_KEY

RUN npx prisma generate && \
    yarn build

# — Stage 3: Production runner —
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Copy standalone server
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# Copy Prisma schema + seed scripts (for db push / db seed)
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/scripts ./scripts

# Copy Prisma client runtime (needed by the app)
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma

# Copy Prisma CLI (needed for db push / db seed)
COPY --from=deps /app/node_modules/prisma ./node_modules/prisma
RUN mkdir -p node_modules/.bin && \
    ln -s ../prisma/build/index.js node_modules/.bin/prisma && \
    chmod +x node_modules/.bin/prisma

EXPOSE 3000

CMD ["node", "server.js"]
