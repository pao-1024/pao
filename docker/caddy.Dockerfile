# syntax=docker/dockerfile:1
FROM caddy:2.11.7-builder AS builder
COPY docker/caddy-single-device/ /src/single-device/
RUN --mount=type=cache,target=/go/pkg/mod \
    --mount=type=cache,target=/root/.cache/go-build \
    cd /src/single-device && go test ./... && xcaddy build v2.11.7 \
    --with github.com/pao-1024/pao/docker/caddy-single-device=/src/single-device

FROM caddy:2.11.7-alpine
COPY --from=builder /usr/bin/caddy /usr/bin/caddy
COPY docker/Caddyfile /etc/caddy/Caddyfile
