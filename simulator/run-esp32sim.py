#!/usr/bin/env python3
"""Run the production PAO firmware with a local microphone/speaker web interface."""
import argparse
import csv
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import uuid

ROOT = Path(__file__).resolve().parents[1]
SSID = "pao-sim-ap"
PASSWORD = "pao-sim-password"


def find_rom(rom=None):
    """Use an explicit ROM or the ROM tools from the active ESP-IDF environment."""
    if rom is None:
        directory = os.environ.get("ESP_ROM_ELF_DIR")
        if not directory:
            local = sorted((ROOT / "tmp/idf-tools/tools/esp-rom-elfs").glob("*/esp32s3_rev0_rom.elf"))
            if local:
                return local[-1].resolve()
        if not directory and shutil.which("eim"):
            result = subprocess.run(
                ["eim", "run", 'printf "\\nPAO_SIM_ROM_DIR=%s\\n" "$ESP_ROM_ELF_DIR"'],
                capture_output=True, text=True)
            if result.returncode:
                raise ValueError("EIM could not activate ESP-IDF; run eim select or pass --rom")
            # EIM also prints setup logs, so identify the probe's output explicitly.
            prefix = "PAO_SIM_ROM_DIR="
            directory = next((line.removeprefix(prefix) for line in result.stdout.splitlines()
                              if line.startswith(prefix)), None)
        if not directory:
            raise ValueError("Cannot find ESP32-S3 ROM; activate ESP-IDF, run eim select, or pass --rom")
        rom = Path(directory).expanduser() / "esp32s3_rev0_rom.elf"
    if not rom.is_file():
        raise ValueError(f"Missing ESP32-S3 ROM ELF: {rom}; check ESP-IDF ROM tools or pass --rom")
    return rom.resolve()


def load_identity(state):
    """Create one virtual device identity and reuse it across simulator runs."""
    identity_file = state / "identity.json"
    if identity_file.is_file():
        identity = json.loads(identity_file.read_text())
        if (not isinstance(identity, dict) or
                not isinstance(identity.get("mac"), str) or
                not re.fullmatch(r"(?:[0-9a-fA-F]{2}:){5}[0-9a-fA-F]{2}", identity["mac"]) or
                not isinstance(identity.get("uuid"), str)):
            raise ValueError("identity.json must contain a valid MAC and UUID")
        uuid.UUID(identity["uuid"])
        return identity
    if (state / "interactive.bin").exists():
        raise ValueError("Flash exists without identity.json; restore the identity file or "
                         f"move {state} aside to initialize a new virtual device")
    mac = bytearray(os.urandom(6))
    mac[0] = (mac[0] & 0xfc) | 0x02  # Locally administered, unicast address.
    identity = {"mac": mac.hex(":"), "uuid": str(uuid.uuid4())}
    state.mkdir(parents=True, exist_ok=True)
    identity_file.write_text(json.dumps(identity, indent=2) + "\n")
    return identity


def create_flash(build, flash, device_uuid):
    """Write a blank 16 MB flash whose NVS already holds the virtual AP and device UUID."""
    description = json.loads((build / "project_description.json").read_text())
    cache = (build / "CMakeCache.txt").read_text().splitlines()
    python = next(line.split("=", 1)[1] for line in cache if line.startswith("PYTHON:"))
    generator = Path(description["idf_path"]) / "components/nvs_flash/nvs_partition_generator/nvs_partition_gen.py"
    with (flash.parent / "nvs.csv").open("w", newline="") as file:
        csv.writer(file).writerows([("key", "type", "encoding", "value"),
                                   ("board", "namespace", "", ""),
                                   ("uuid", "data", "string", str(device_uuid)),
                                   ("wifi", "namespace", "", ""),
                                   ("ssid", "data", "string", SSID),
                                   ("password", "data", "string", PASSWORD)])
    subprocess.run([python, str(generator), "generate", str(flash.parent / "nvs.csv"),
                    str(flash.parent / "nvs.bin"), "0x4000"], check=True)
    image = bytearray(b"\xff" * (16 * 1024 * 1024))
    image[0x9000:0xd000] = (flash.parent / "nvs.bin").read_bytes()
    flash.write_bytes(image)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--rom", type=Path, help="ROM ELF (default: active ESP-IDF or selected EIM environment)")
    args = parser.parse_args()
    try:
        rom = find_rom(args.rom)
    except (OSError, ValueError) as error:
        parser.error(str(error))
    emulator = ROOT / "tmp/esp32sim-build/release/pao-sim"
    state = ROOT / "tmp/esp32sim-full-flow"
    flash = state / "interactive.bin"
    revision = json.loads((ROOT / "tmp/base-revision.json").read_text())["commit"]
    build = ROOT / "tmp/build" / revision
    elf = build / "xiaozhi.elf"
    for path in [emulator, elf]:
        if not path.is_file():
            parser.error(f"Missing {path}; run task firmware:build first")
    try:
        identity = load_identity(state)
    except (OSError, ValueError) as error:
        parser.error(f"Cannot load {state / 'identity.json'}: {error}")
    if not flash.is_file():
        create_flash(build, flash, identity["uuid"])
    command = [emulator, "--board", "pao", "--boot", "rom", "--rom", rom,
               "--mac", identity["mac"], "--flash-mb", "16", "--psram-mb", "8", "--elf", elf,
               "--flash-file", flash, "--wifi", f"ssid={SSID},psk={PASSWORD}",
               # The firmware's remote-control page on port 80, reachable from the host.
               "--hostfwd", "tcp:127.0.0.1:8081-:80",
               # Wake-word recognition runs below real time while someone speaks; catch up during
               # silence instead of skipping the lag, so no speech is dropped. 4 s fills the 16 kHz
               # microphone queue.
               "--max-lag", "4",
               "--web", "8080", "--web-dir", ROOT / "tmp/simulator-web", "--console", "uart0", "--no-dump"]
    # Refresh firmware images over the persistent flash without overwriting its NVS.
    images = json.loads((build / "flasher_args.json").read_text())["flash_files"]
    for offset, name in images.items():
        image = build / name
        start = int(offset, 0)
        if start < 0xd000 and start + image.stat().st_size > 0x9000:
            parser.error(f"Firmware image overlaps the saved NVS partition: {name}")
        command.extend(["--flash-at", f"{offset}={image}"])
    print("Open http://127.0.0.1:8080/ and enable the microphone/speaker; the remote control is at "
          "http://127.0.0.1:8081/. Ctrl+C stops and saves flash.", flush=True)
    os.execv(emulator, [str(arg) for arg in command])


if __name__ == "__main__":
    main()
