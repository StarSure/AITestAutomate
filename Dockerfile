FROM node:20-bookworm-slim AS base

WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json

RUN npm install

COPY . .

RUN npm run build

ENV NODE_ENV=production
ENV PORT=4318
ENV HOST=0.0.0.0

EXPOSE 4318

CMD ["npm", "run", "start"]

