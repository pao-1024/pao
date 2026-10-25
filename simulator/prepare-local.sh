#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p tmp/temp
export TMPDIR="$PWD/tmp/temp"
export PYTHONPYCACHEPREFIX="$PWD/tmp/pycache"
export PIP_CACHE_DIR="$PWD/tmp/pip-cache"
export IDF_TOOLS_PATH="$PWD/tmp/idf-tools"
export IDF_CCACHE_ENABLE=0

# Keep the SDK and toolchains local; do not change the user's EIM selection.
if [[ ! -d tmp/esp-idf ]]; then
    git clone --branch v6.0.1 --depth 1 --recursive --shallow-submodules \
        https://github.com/espressif/esp-idf.git tmp/esp-idf
fi
if [[ "$(git -C tmp/esp-idf describe --tags --exact-match)" != v6.0.1 ]]; then
    echo 'Expected ESP-IDF v6.0.1 in tmp/esp-idf' >&2
    exit 1
fi
bash tmp/esp-idf/install.sh esp32s3
# ESP-IDF's environment script is not nounset-safe.
set +u
# shellcheck source=/dev/null
source tmp/esp-idf/export.sh
set -u
task firmware:build
task simulator:install
