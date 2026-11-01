#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../components/pao/guest"

: "${XGOROOT:?set XGOROOT to the xgo checkout that provides the tinygo target}"

XGO_BIN="${XGO_BIN:-xgo}"
TINYGO_BIN="${TINYGO_BIN:-tinygo}"
WASMOPT_BIN="${WASMOPT_BIN:-wasm-opt}"

for tool in "$XGO_BIN" "$TINYGO_BIN" "$WASMOPT_BIN"; do
    if ! command -v "$tool" >/dev/null 2>&1; then
        echo "missing guest tool: $tool" >&2
        exit 1
    fi
done

export WASMOPT="$WASMOPT_BIN"
XGO_GOCMD=true "$XGO_BIN" build -o /dev/null .
"$TINYGO_BIN" build -target=wasip1 -o guest.wasm .
rm -f xgo_autogen.go
echo "guest.wasm: $(wc -c < guest.wasm) bytes"
