#!/usr/bin/env python3
"""Initialize the pinned esp32sim submodule and build the local PAO extension."""
import os
import hashlib
import fcntl
from pathlib import Path
import shutil
import subprocess

ROOT = Path(__file__).resolve().parents[1]


def build():
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
    # Keep the pinned checkout pristine; the tracked extension is compiled from an isolated copy.
    work = ROOT / "tmp/studio-sim"
    patches = [ROOT / "simulator/i2s-streaming.patch", ROOT / "simulator/board-input.patch"]
    stamp = hashlib.sha256(run("git", "rev-parse", "HEAD", cwd=source, capture=True).stdout.encode() + b"".join(p.read_bytes() for p in patches) + Path(__file__).read_bytes()).hexdigest()
    marker = work / "kernel-revision"
    if not marker.exists() or marker.read_text() != stamp:
        if (work / "esp32sim").exists():
            shutil.rmtree(work / "esp32sim")
        shutil.copytree(source, work / "esp32sim", ignore=shutil.ignore_patterns(".git", "target", "node_modules"))
        directory = str((work / "esp32sim").relative_to(ROOT))
        for patch in patches:
            run("git", "apply", "--directory", directory, patch)
            run("git", "apply", "--directory", directory, "--reverse", "--check", patch)
        marker.write_text(stamp)
    if (work / "pao-sim").exists():
        shutil.rmtree(work / "pao-sim")
    shutil.copytree(ROOT / "simulator/pao-sim", work / "pao-sim")
    run("cargo", "build", "--locked", "--release", "--manifest-path", work / "pao-sim/Cargo.toml")
    print(target / "release/pao-sim")


if __name__ == "__main__":
    (ROOT / "tmp").mkdir(exist_ok=True)
    with (ROOT / "tmp/esp32sim-source.lock").open("w") as lock:
        fcntl.flock(lock, fcntl.LOCK_EX)
        build()
