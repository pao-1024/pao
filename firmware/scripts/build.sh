#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../.."

mkdir -p tmp/temp
export TMPDIR="$PWD/tmp/temp"
export PIP_CACHE_DIR="$PWD/tmp/pip-cache"
export PAO_BUILD_ACTION="${PAO_BUILD_ACTION:-build}"

if [[ -n "${IDF_PATH:-}" ]] && command -v idf.py >/dev/null 2>&1; then
    exec python firmware/scripts/build.py "$PAO_BUILD_ACTION"
fi

if ! command -v eim >/dev/null 2>&1; then
    cat >&2 <<'EOF'
未检测到已激活的 ESP-IDF 环境，也未找到 EIM。
请先按照乐鑫官方文档安装 ESP-IDF 安装管理器（EIM）：
https://docs.espressif.com/projects/esp-idf/zh_CN/stable/esp32s3/get-started/linux-setup.html

安装 EIM 后，为 ESP32-S3 安装并选择 ESP-IDF：
  eim install -i v6.0.1 -t esp32s3
  eim select
然后重新运行 task firmware:build。
EOF
    exit 1
fi

# Expand the action inside EIM's shell to preserve argument boundaries.
# shellcheck disable=SC2016
exec eim run 'python firmware/scripts/build.py "$PAO_BUILD_ACTION"'
