#!/usr/bin/env python3
"""Install the pinned Espressif simulator into the project cache."""
import hashlib
import json
from pathlib import Path
import platform
import tarfile
import urllib.request

ROOT = Path(__file__).resolve().parents[2]
ARTIFACTS = {
    ("Darwin", "arm64"): ("aarch64-apple-darwin", "3328b4cce9e3338a0ea34767db1f2fdd9a264b126434dfec16a02091e1949eb8"),
    ("Linux", "aarch64"): ("aarch64-unknown-linux-gnu", "a25f040348c17286885d4e84cd8f0691ed572eac1f3428d88c2814fe930c83e5"),
    ("Linux", "x86_64"): ("x86_64-unknown-linux-gnu", "3f388f44ae38e829c74d637a68f4d80a136c375ff4d7d168acf87c8d274f0075"),
}


def main():
    key = (platform.system(), platform.machine())
    if key not in ARTIFACTS:
        raise RuntimeError(f"No pinned esp-emu binary for {key}")
    target, expected = ARTIFACTS[key]
    directory = ROOT / "tmp/esp-emulator"
    directory.mkdir(parents=True, exist_ok=True)
    executable = directory / "esp-emu"
    stamp = directory / "checksum.json"
    if executable.exists() and stamp.exists():
        recorded = json.loads(stamp.read_text())
        if recorded.get("archive") == expected and hashlib.sha256(executable.read_bytes()).hexdigest() == recorded.get("binary"):
            print(executable)
            return
    archive = directory / "release.tar.gz"
    name = f"esp-emu-0.50.0-{target}.tar.gz"
    urllib.request.urlretrieve(f"https://github.com/espressif/esp-emulator/releases/download/v0.50.0/{name}", archive)
    if hashlib.sha256(archive.read_bytes()).hexdigest() != expected:
        raise RuntimeError("esp-emu release checksum mismatch")
    with tarfile.open(archive) as package:
        members = [m for m in package.getmembers() if m.isfile() and Path(m.name).name == "esp-emu"]
        if len(members) != 1:
            raise RuntimeError("Expected one esp-emu executable")
        staged = directory / "esp-emu.download"
        with package.extractfile(members[0]) as source:
            staged.write_bytes(source.read())
    staged.chmod(0o755)
    staged.replace(executable)
    stamp.write_text(json.dumps({"archive": expected, "binary": hashlib.sha256(executable.read_bytes()).hexdigest()}) + "\n")
    archive.unlink()
    print(executable)


if __name__ == "__main__":
    main()
