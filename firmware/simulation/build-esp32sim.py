#!/usr/bin/env python3
"""Fetch the pinned esp32sim core and build the local PAO extension."""
import json
import os
from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parents[2]


def main():
    config = json.loads(Path(__file__).with_name("esp32sim.json").read_text())
    source = ROOT / "tmp/esp32sim"
    target = ROOT / "tmp/esp32sim-build"
    temp = ROOT / "tmp/temp"
    temp.mkdir(parents=True, exist_ok=True)
    environment = dict(os.environ, TMPDIR=str(temp), CARGO_TARGET_DIR=str(target),
                       CARGO_HOME=str(ROOT / "tmp/cargo-home"))

    def run(*args, cwd=ROOT, capture=False):
        return subprocess.run([str(arg) for arg in args], cwd=cwd, env=environment, check=True,
                              text=True, stdout=subprocess.PIPE if capture else None)

    if not source.exists():
        run("git", "clone", "--filter=blob:none", "--depth=1", config["repository"], source)
    remote = run("git", "remote", "get-url", "origin", cwd=source, capture=True).stdout.strip()
    if remote != config["repository"]:
        raise RuntimeError(f"Unexpected esp32sim origin: {remote}")
    if run("git", "status", "--porcelain", cwd=source, capture=True).stdout:
        raise RuntimeError(f"esp32sim source has local changes: {source}")
    run("git", "fetch", "--depth=1", "origin", config["ref"], cwd=source)
    run("git", "checkout", "--detach", config["ref"], cwd=source)
    run("cargo", "build", "--locked", "--release", "--manifest-path",
        ROOT / "firmware/simulation/pao-sim/Cargo.toml")
    print(target / "release/pao-sim")


if __name__ == "__main__":
    main()
