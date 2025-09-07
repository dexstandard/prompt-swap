FROM node:22.19.0-alpine AS build
WORKDIR /app
COPY frontend/package*.json frontend/tsconfig.json frontend/vite.config.ts ./frontend/
RUN npm --prefix frontend ci
COPY frontend ./frontend
ARG VITE_GOOGLE_CLIENT_ID
ARG VITE_DO_SSH_HOST
RUN VITE_GOOGLE_CLIENT_ID=$VITE_GOOGLE_CLIENT_ID VITE_DO_SSH_HOST=$VITE_DO_SSH_HOST npm --prefix frontend run build

FROM caddy:2.7-alpine
COPY Caddyfile /etc/caddy/Caddyfile
COPY --from=build /app/frontend/dist /usr/share/caddy/

