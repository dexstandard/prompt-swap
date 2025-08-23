# --- Build frontend from /frontend ---
FROM node:22-alpine AS fe-build
WORKDIR /app/frontend

# inject build-time env so Vite embeds secrets
ARG VITE_GOOGLE_CLIENT_ID
ENV VITE_GOOGLE_CLIENT_ID=${VITE_GOOGLE_CLIENT_ID}

# deps (cache-friendly)
COPY frontend/package*.json ./
RUN npm ci

# source + build
COPY frontend/ .
# Vite -> dist ; CRA/Next static -> build. Your compose sets FRONTEND_BUILD_DIR.
RUN npm run build

# --- Caddy runtime ---
FROM caddy:2.7-alpine

# allow switching between dist/build via build-arg
ARG FRONTEND_BUILD_DIR=dist

# static files
COPY --from=fe-build /app/frontend/${FRONTEND_BUILD_DIR} /usr/share/caddy

# caddy config
COPY Caddyfile /etc/caddy/Caddyfile
