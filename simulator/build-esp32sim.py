#!/usr/bin/env python3
"""Initialize the pinned esp32sim submodule and build the local PAO extension."""
import os
from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parents[1]


def main():
    source = ROOT / "simulator/esp32sim"
    target = ROOT / "tmp/esp32sim-build"
    temp = ROOT / "tmp/temp"
    temp.mkdir(parents=True, exist_ok=True)
    environment = dict(os.environ, TMPDIR=str(temp), CARGO_TARGET_DIR=str(target),
                       CARGO_HOME=str(ROOT / "tmp/cargo-home"))

    def run(*args, cwd=ROOT, capture=False):
        return subprocess.run([str(arg) for arg in args], cwd=cwd, env=environment, check=True,
                              text=True, stdout=subprocess.PIPE if capture else None)

    if (source / ".git").exists() and run("git", "status", "--porcelain", cwd=source, capture=True).stdout:
        raise RuntimeError(f"esp32sim source has local changes: {source}")
    run("git", "submodule", "update", "--init", "--recursive", "--", "simulator/esp32sim")
    run("cargo", "build", "--locked", "--release", "--manifest-path",
        ROOT / "simulator/pao-sim/Cargo.toml")
    print(target / "release/pao-sim")


if __name__ == "__main__":
    main()
