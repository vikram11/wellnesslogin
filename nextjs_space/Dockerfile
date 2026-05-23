# — Stage 1: Build —
FROM node:22-alpine AS builder
WORKDIR /app

RUN corepack enable && corepack prepare yarn@4.13.0 --activate

COPY package.json .yarnrc.yml ./
COPY prisma ./prisma/
COPY app ./app
COPY components ./components
COPY hooks ./hooks
COPY lib ./lib
COPY public ./public
COPY scripts ./scripts
COPY types ./types
COPY next.config.js next-env.d.ts tailwind.config.ts tsconfig.json postcss.config.js ./

ARG DATABASE_URL
ENV DATABASE_URL=$DATABASE_URL
ARG NEXT_PUBLIC_VAPID_PUBLIC_KEY
ENV NEXT_PUBLIC_VAPID_PUBLIC_KEY=$NEXT_PUBLIC_VAPID_PUBLIC_KEY

RUN rm -f yarn.lock && \
    yarn install && \
    yarn prisma generate && \
    NODE_ENV=production yarn build

# — Stage 2: Production runner —
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Copy entire .next build
COPY --from=builder /app/.next /app/.next
COPY --from=builder /app/public ./public

# Copy node_modules (needed for non-standalone)
COPY --from=builder /app/node_modules ./node_modules

# Copy Prisma schema
COPY --from=builder /app/prisma ./prisma

# Copy Prisma client runtime
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma

# Copy Prisma CLI (already has .bin/prisma from builder)
COPY --from=builder /app/node_modules/prisma ./node_modules/prisma

EXPOSE 3000

CMD ["node", "node_modules/next/dist/bin/next", "start"]
