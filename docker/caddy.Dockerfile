# syntax=docker/dockerfile:1
FROM caddy:2.11.7-builder AS builder
ENV GOMAXPROCS=2 GOFLAGS=-p=2
COPY docker/caddy-single-device/ /src/single-device/
RUN --mount=type=cache,id=pao-simulator-caddy-mod,target=/go/pkg/mod \
    --mount=type=cache,id=pao-simulator-caddy-build,target=/root/.cache/go-build \
    cd /src/single-device && go test ./... && xcaddy build v2.11.7 --output /usr/bin/caddy \
    --with github.com/pao-1024/pao/docker/caddy-single-device=/src/single-device

FROM caddy:2.11.7-alpine
COPY --from=builder /usr/bin/caddy /usr/bin/caddy
COPY docker/Caddyfile /etc/caddy/Caddyfile
