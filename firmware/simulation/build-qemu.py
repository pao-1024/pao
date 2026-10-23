#!/usr/bin/env python3
"""Build the pinned ESP32-S3 peripheral emulator."""
import json
import os
from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parents[2]


def main():
    config = json.loads(Path(__file__).with_name("qemu.json").read_text())
    source = ROOT / "tmp" / "qemu-src"
    build = ROOT / "tmp" / "qemu-install-build"
    temp = ROOT / "tmp" / "temp"
    temp.mkdir(parents=True, exist_ok=True)
    os.environ["TMPDIR"] = str(temp)

    def run(*args, cwd=ROOT, capture=False):
        return subprocess.run([str(x) for x in args], cwd=cwd, check=True,
                              text=True, stdout=subprocess.PIPE if capture else None)

    if not source.exists():
        run("git", "clone", "--filter=blob:none", "--depth=1", "--no-checkout", config["repository"], source)
        run("git", "fetch", "--depth=1", "origin", config["ref"], cwd=source)
        run("git", "checkout", "--detach", config["ref"], cwd=source)
    remote = run("git", "remote", "get-url", "origin", cwd=source, capture=True).stdout.strip()
    if remote != config["repository"]:
        raise RuntimeError(f"Unexpected QEMU origin: {remote}")
    if run("git", "status", "--porcelain", cwd=source, capture=True).stdout:
        raise RuntimeError(f"QEMU source has local changes: {source}")
    binary = build / "qemu-system-xtensa"
    stamp = build / "pao-revision"
    if binary.is_file() and stamp.is_file() and stamp.read_text().strip() == config["ref"]:
        print(binary)
        return
    run("git", "fetch", "--depth=1", "origin", config["ref"], cwd=source)
    run("git", "checkout", "--detach", config["ref"], cwd=source)
    build.mkdir(parents=True, exist_ok=True)
    run(source / "configure", "--target-list=xtensa-softmmu", "--enable-gcrypt",
        "--enable-slirp", "--disable-gnutls", "--disable-fuse", "--disable-werror",
        "--disable-docs", "--disable-user", "--disable-gtk", "--disable-sdl",
        "--disable-vnc", "--disable-capstone", cwd=build)
    run("ninja", f"-j{min(os.cpu_count() or 1, 8)}", "qemu-system-xtensa", cwd=build)
    stamp.write_text(config["ref"] + "\n")
    print(binary)


if __name__ == "__main__":
    main()
