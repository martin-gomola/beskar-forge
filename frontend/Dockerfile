# syntax=docker/dockerfile:1

FROM node:20-alpine AS dependencies

WORKDIR /app

COPY package.json package-lock.json ./

RUN --mount=type=cache,target=/root/.npm \
    npm ci

FROM dependencies AS development

ARG APP_VERSION=0.1.0
ENV APP_VERSION=$APP_VERSION

COPY index.html ./
COPY tsconfig*.json ./
COPY vite.config.ts postcss.config.js tailwind.config.js ./
COPY scripts ./scripts
COPY public ./public
COPY src ./src

FROM development AS build

RUN --mount=type=cache,target=/app/node_modules/.vite \
    --mount=type=cache,target=/app/node_modules/.cache \
    npm run build

FROM nginx:alpine AS production

COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget -q -O /dev/null http://127.0.0.1:80/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
