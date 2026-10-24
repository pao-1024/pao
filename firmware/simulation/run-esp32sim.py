#!/usr/bin/env python3
"""Run the production PAO firmware with a local microphone/speaker web interface."""
import argparse
import json
import os
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[2]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--rom", type=Path, required=True)
    parser.add_argument("--mac", required=True)
    args = parser.parse_args()
    if not re.fullmatch(r"(?:[0-9a-fA-F]{2}:){5}[0-9a-fA-F]{2}", args.mac):
        parser.error("--mac must contain six hexadecimal octets")
    emulator = ROOT / "tmp/esp32sim-build/release/pao-sim"
    output = ROOT / "tmp/esp32sim-full-flow"
    seed = output / "saved.bin"
    revision = json.loads((ROOT / "tmp/base-revision.json").read_text())["commit"]
    elf = ROOT / "tmp/build" / revision / "xiaozhi.elf"
    for path in [args.rom, emulator, seed, elf]:
        if not path.is_file():
            parser.error(f"Missing {path}; prepare the emulator, firmware and provisioned flash with sim:full first")
    command = [emulator, "--board", "pao", "--boot", "rom", "--rom", args.rom.resolve(),
               "--mac", args.mac, "--flash-mb", "16", "--psram-mb", "8", "--elf", elf,
               "--flash-image", seed, "--flash-file", output / "interactive.bin",
               "--wifi", "ssid=pao-sim-ap,psk=pao-sim-password",
               "--web", "8080", "--web-dir", ROOT / "firmware/simulation/web", "--console", "uart0", "--no-dump"]
    print("Open http://127.0.0.1:8080/ and enable the microphone/speaker. Ctrl+C stops and saves flash.", flush=True)
    os.execv(emulator, [str(arg) for arg in command])


if __name__ == "__main__":
    main()
