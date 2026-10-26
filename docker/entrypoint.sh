#!/usr/bin/env bash
set -euo pipefail

simulator_pid=
nginx_pid=
stop() {
    trap '' TERM INT
    for pid in "$simulator_pid" "$nginx_pid"; do
        if [[ -n "$pid" ]]; then kill -TERM "$pid" 2>/dev/null || true; fi
    done
    for pid in "$simulator_pid" "$nginx_pid"; do
        if [[ -n "$pid" ]]; then wait "$pid" 2>/dev/null || true; fi
    done
}
trap stop EXIT
trap 'exit 0' TERM INT

"$@" &
simulator_pid=$!
nginx -c /etc/pao/nginx.conf -g 'daemon off;' &
nginx_pid=$!
wait -n "$simulator_pid" "$nginx_pid"
