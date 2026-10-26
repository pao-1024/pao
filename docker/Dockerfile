# syntax=docker/dockerfile:1
FROM node:24-bookworm-slim AS web
WORKDIR /src/simulator
RUN npm install --global pnpm@10.32.1
COPY simulator/package.json simulator/pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY simulator/vite.config.ts simulator/tsconfig.json ./
COPY simulator/web/ web/
COPY simulator/pao-sim/microphone-check.mjs pao-sim/microphone-check.mjs
RUN pnpm run check && VITE_CONTROL_BASE=/control/ pnpm run build

FROM rust:1.99-bookworm AS kernel
WORKDIR /src
COPY simulator/pao-sim/ simulator/pao-sim/
COPY simulator/esp32sim/ simulator/esp32sim/
COPY simulator/i2s-streaming.patch simulator/board-input.patch simulator/
RUN test -s simulator/esp32sim/Cargo.toml || (echo 'Run git submodule update --init --recursive before building' >&2; exit 1)
RUN git apply --directory simulator/esp32sim simulator/i2s-streaming.patch \
    && git apply --directory simulator/esp32sim simulator/board-input.patch
RUN --mount=type=cache,target=/usr/local/cargo/registry \
    cargo build --locked --release --manifest-path simulator/pao-sim/Cargo.toml \
    && strip simulator/pao-sim/target/release/pao-sim

FROM espressif/idf:v6.0.1 AS firmware
SHELL ["/bin/bash", "-o", "pipefail", "-c"]
WORKDIR /src
COPY firmware/ firmware/
RUN . /opt/esp/idf/export.sh && python firmware/scripts/build.py
RUN . /opt/esp/idf/export.sh && mkdir -p /out/rom \
    && cp "$ESP_ROM_ELF_DIR/esp32s3_rev0_rom.elf" /out/rom/ \
    && mkdir -p /out/licenses \
    && cp /src/tmp/xiaozhi/LICENSE /out/licenses/xiaozhi-LICENSE \
    && cp /opt/esp/idf/LICENSE /out/licenses/esp-idf-LICENSE
RUN python3 - <<'PY'
import json
from pathlib import Path
import shutil
root = Path('/src/tmp')
revision = json.loads((root / 'base-revision.json').read_text())['commit']
build = root / 'build' / revision
output = Path('/out/firmware')
manifest = json.loads((build / 'flasher_args.json').read_text())
for name in ['xiaozhi.elf', 'flasher_args.json', *manifest['flash_files'].values()]:
    target = output / name
    target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(build / name, target)
description = json.loads((build / 'project_description.json').read_text())
for directory in description['build_component_paths']:
    component = Path(directory)
    for source in component.iterdir():
        if source.is_file() and source.name.upper().startswith(('LICENSE', 'COPYING', 'NOTICE')):
            target = Path('/out/licenses/components') / component.name / source.name
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(source, target)
PY

FROM python:3.12-slim-bookworm AS runtime
RUN apt-get update && apt-get install -y --no-install-recommends nginx bash ca-certificates \
    && rm -rf /var/lib/apt/lists/* \
    && pip install --no-cache-dir esp-idf-nvs-partition-gen==0.3.0 \
    && useradd --uid 10001 --create-home pao \
    && mkdir /data && chown pao:pao /data
WORKDIR /opt/pao
COPY --from=kernel /src/simulator/pao-sim/target/release/pao-sim tmp/esp32sim-build/release/pao-sim
COPY --from=web /src/tmp/simulator-web/ tmp/simulator-web/
COPY --from=firmware /out/ ./
COPY simulator/run-esp32sim.py simulator/run-esp32sim.py
COPY simulator/pao-sim/LICENSE /usr/share/doc/pao-sim/LICENSE
COPY simulator/esp32sim/LICENSE /usr/share/doc/esp32sim/LICENSE
COPY docker/esp-rom-LICENSE docker/esp-rom-NOTICE licenses/
COPY docker/nginx.conf /etc/pao/nginx.conf
COPY --chmod=755 docker/entrypoint.sh /usr/local/bin/pao-simulator
USER pao
EXPOSE 8000
VOLUME ["/data"]
STOPSIGNAL SIGTERM
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s \
    CMD ["python3", "-c", "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/', timeout=3).read(1)"]
ENTRYPOINT ["/usr/local/bin/pao-simulator"]
CMD ["python3", "simulator/run-esp32sim.py", "--rom", "/opt/pao/rom/esp32s3_rev0_rom.elf", "--firmware-dir", "/opt/pao/firmware", "--state-dir", "/data", "--nvs-python", "/usr/local/bin/python3"]
