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

RUN rm -f yarn.lock && \
    yarn install && \
    yarn prisma generate && \
    yarn build

# — Stage 2: Production runner —
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Copy standalone server
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# Copy Prisma schema (for db push / db seed)
COPY --from=builder /app/prisma ./prisma

# Copy Prisma client runtime
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma

# Copy Prisma CLI
COPY --from=builder /app/node_modules/prisma ./node_modules/prisma
RUN mkdir -p node_modules/.bin && \
    ln -s ../prisma/build/index.js node_modules/.bin/prisma && \
    chmod +x node_modules/.bin/prisma

EXPOSE 3000

CMD ["node", "server.js"]