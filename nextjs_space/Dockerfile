# — Stage 1: Install dependencies —
FROM node:22-alpine AS deps
WORKDIR /app

# Enable Corepack so the correct Yarn version (Berry/v4) is used
RUN corepack enable && corepack prepare yarn@4.13.0 --activate

COPY package.json yarn.lock .yarnrc.yml* ./
COPY prisma ./prisma/

RUN yarn install --immutable && \
    yarn prisma generate

# — Stage 2: Build —
FROM node:22-alpine AS builder
WORKDIR /app

RUN corepack enable && corepack prepare yarn@4.13.0 --activate

COPY --from=deps /app/node_modules ./node_modules
COPY . .

ARG NEXT_PUBLIC_VAPID_PUBLIC_KEY
ENV NEXT_PUBLIC_VAPID_PUBLIC_KEY=$NEXT_PUBLIC_VAPID_PUBLIC_KEY

RUN yarn build

# — Stage 3: Production runner —
FROM node:22-alpine AS runner
WORKDIR /app

RUN corepack enable && corepack prepare yarn@4.13.0 --activate

ENV NODE_ENV=production
ENV PORT=3000

COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/scripts ./scripts

EXPOSE 3000

CMD ["yarn", "start"]
