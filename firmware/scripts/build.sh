#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../.."

mkdir -p tmp/temp
export TMPDIR="$PWD/tmp/temp"
export PIP_CACHE_DIR="$PWD/tmp/pip-cache"
if [[ -z "${IDF_PATH:-}" ]]; then
    export IDF_TOOLS_PATH="$PWD/tmp/idf-tools"
    if [[ ! -d tmp/esp-idf ]]; then
        git clone --branch v6.0.1 --depth 1 --recursive --shallow-submodules \
            https://github.com/espressif/esp-idf.git tmp/esp-idf
    fi
    export IDF_PATH="$PWD/tmp/esp-idf"
    if [[ ! -f "$IDF_TOOLS_PATH/.pao-installed-v6.0.1" ]]; then
        "$IDF_PATH/install.sh" esp32s3
        touch "$IDF_TOOLS_PATH/.pao-installed-v6.0.1"
    fi
fi

# export.sh manages its own environment and does not support nounset.
set +u
# shellcheck source=/dev/null
source "$IDF_PATH/export.sh"
set -u
if [[ "${PAO_BUILD_ACTION:-build}" == "probe" ]]; then
    python "$IDF_PATH/tools/idf.py" -C firmware/simulation/probe -B "$PWD/tmp/probe-build" \
        -DIDF_TARGET=esp32s3 -DSDKCONFIG="$PWD/tmp/probe-build/sdkconfig" build
    exit
fi
python firmware/scripts/build.py "${PAO_BUILD_ACTION:-build}"
