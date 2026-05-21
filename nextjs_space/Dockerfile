# — Stage 1: Install dependencies —
FROM node:22-alpine AS deps
WORKDIR /app

# Enable Corepack so the correct Yarn version (Berry/v4) is used
RUN corepack enable && corepack prepare yarn@4.13.0 --activate

COPY package.json yarn.lock .yarnrc.yml ./
COPY prisma ./prisma/

RUN yarn install --immutable && \
    yarn prisma generate

# — Stage 2: Build —
FROM node:22-alpine AS builder
WORKDIR /app

RUN corepack enable && corepack prepare yarn@4.13.0 --activate

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Enable standalone output for Docker
RUN sed -i 's/const nextConfig = {/const nextConfig = {\n  output: "standalone",/' next.config.js

ARG NEXT_PUBLIC_VAPID_PUBLIC_KEY
ENV NEXT_PUBLIC_VAPID_PUBLIC_KEY=$NEXT_PUBLIC_VAPID_PUBLIC_KEY

RUN yarn build

# — Stage 3: Production runner —
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Copy standalone server (includes node_modules it needs)
COPY --from=builder /app/.next/standalone ./
# Copy static assets and public files
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
# Copy prisma for db push/seed commands
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma

EXPOSE 3000

# Start directly with node — no Yarn needed at runtime
CMD ["node", "server.js"]
