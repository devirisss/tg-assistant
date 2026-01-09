FROM node:24.12.0-alpine3.23

WORKDIR /app

COPY package.json pnpm-lock.yaml ./

RUN npm install -g pnpm@9.12.2

RUN pnpm install

COPY prisma ./prisma
COPY prisma.config.ts ./

RUN npx prisma generate

COPY . .

RUN pnpm run build

RUN ls -la /app/dist

EXPOSE 3000

CMD ["pnpm", "run", "start:prod"]