#!/usr/bin/env python3
"""Boot the generated Studio ESP-IDF project with its matching virtual board."""
import argparse
import json
import os
import runpy
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
find_rom = runpy.run_path(str(ROOT / "simulator/run-esp32sim.py"))["find_rom"]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("project", type=Path)
    args, extra = parser.parse_known_args()
    project = args.project.resolve()
    if project.parent != ROOT / "tmp/studio":
        parser.error("Project must be generated under tmp/studio")
    build = project / "build"
    if not (project / "ready.json").is_file():
        parser.error("Project has not completed a successful build")
    flash = project / "flash.bin"
    if not flash.exists():
        flash.write_bytes(b"\xff" * (16 * 1024 * 1024))
    emulator = ROOT / "tmp/esp32sim-build/release/pao-sim"
    command = [emulator, "--board-file", project / "board.json", "--boot", "rom", "--rom", find_rom(),
               "--flash-mb", "16", "--psram-mb", "8", "--elf", build / "studio.elf",
               "--flash-file", flash, "--web", "8080", "--web-dir", ROOT / "tmp/platform-dist",
               "--console", "uart0", "--no-dump"]
    images = json.loads((build / "flasher_args.json").read_text())["flash_files"]
    for offset, name in images.items():
        command.extend(["--flash-at", f"{offset}={build / name}"])
    command.extend(extra)
    print(f"STUDIO project={project.name} board={project / 'board.json'}", flush=True)
    os.execv(emulator, [str(arg) for arg in command])


if __name__ == "__main__":
    main()
