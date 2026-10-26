#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../.."
export TMPDIR="$PWD/tmp/temp"
export IDF_TOOLS_PATH="$PWD/tmp/idf-tools"
export PYTHONPYCACHEPREFIX="$PWD/tmp/pycache"
export IDF_CCACHE_ENABLE=0
export IDF_TARGET=esp32s3
if [[ ! -f tmp/esp-idf/export.sh ]]; then
    echo '缺少 ESP-IDF，请先在仿真页面准备环境' >&2
    exit 1
fi
[[ "$(git -C tmp/esp-idf describe --tags --exact-match)" == v6.0.1 ]]
set +u
source tmp/esp-idf/export.sh
set -u
idf.py -C "$1" -B "$1/build" build
python3 simulator/build-esp32sim.py
