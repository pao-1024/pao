#!/usr/bin/env python3
"""Run the production PAO firmware with a local microphone/speaker web interface."""
import argparse
import csv
import json
import os
from pathlib import Path
import re
import subprocess
import uuid

ROOT = Path(__file__).resolve().parents[1]
SSID = "pao-sim-ap"
PASSWORD = "pao-sim-password"


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
    parser.add_argument("--rom", type=Path, required=True)
    parser.add_argument("--mac", required=True)
    parser.add_argument("--device-uuid", type=uuid.UUID, help="activated device UUID; needed only to create the flash")
    args = parser.parse_args()
    if not re.fullmatch(r"(?:[0-9a-fA-F]{2}:){5}[0-9a-fA-F]{2}", args.mac):
        parser.error("--mac must contain six hexadecimal octets")
    emulator = ROOT / "tmp/esp32sim-build/release/pao-sim"
    flash = ROOT / "tmp/esp32sim-full-flow/interactive.bin"
    revision = json.loads((ROOT / "tmp/base-revision.json").read_text())["commit"]
    build = ROOT / "tmp/build" / revision
    elf = build / "xiaozhi.elf"
    for path in [args.rom, emulator, elf]:
        if not path.is_file():
            parser.error(f"Missing {path}; run task firmware:build first")
    if not flash.is_file():
        if args.device_uuid is None:
            parser.error(f"Missing {flash}; pass --device-uuid to create it")
        flash.parent.mkdir(parents=True, exist_ok=True)
        create_flash(build, flash, args.device_uuid)
    command = [emulator, "--board", "pao", "--boot", "rom", "--rom", args.rom.resolve(),
               "--mac", args.mac, "--flash-mb", "16", "--psram-mb", "8", "--elf", elf,
               "--flash-file", flash, "--wifi", f"ssid={SSID},psk={PASSWORD}",
               # The firmware's remote-control page on port 80, reachable from the host.
               "--hostfwd", "tcp:127.0.0.1:8081-:80",
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
