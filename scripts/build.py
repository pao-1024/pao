#!/usr/bin/env python3
"""Build PAO against a selected upstream Xiaozhi revision."""

import argparse
import json
import os
from pathlib import Path
import shlex
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "tmp" / "xiaozhi"
PATCH = ROOT / "firmware" / "integration.patch"


def run(*args, cwd=ROOT, capture=False, check=True):
    print("+", shlex.join(str(arg) for arg in args), flush=True)
    return subprocess.run(
        [str(arg) for arg in args], cwd=cwd, check=check,
        text=True, stdout=subprocess.PIPE if capture else None,
        stderr=subprocess.PIPE if capture else None,
    )


def main():
    config = json.loads((ROOT / "firmware" / "base.json").read_text())
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("action", nargs="?", choices=("prepare", "configure", "build"), default="build")
    parser.add_argument("--ref", default=os.environ.get("PAO_BASE_REF") or config["ref"], help="upstream branch, tag or commit (default: firmware/base.json)")
    args = parser.parse_args()
    if not args.ref.strip() or args.ref.startswith("-"):
        parser.error("--ref must be a non-empty branch, tag or commit")

    temp = ROOT / "tmp" / "temp"
    temp.mkdir(parents=True, exist_ok=True)
    os.environ["TMPDIR"] = str(temp)
    if not SOURCE.exists():
        run("git", "clone", "--filter=blob:none", config["repository"], SOURCE)
    repository = run("git", "remote", "get-url", "origin", cwd=SOURCE, capture=True).stdout.strip()
    if repository != config["repository"]:
        raise RuntimeError(f"Unexpected origin in {SOURCE}: {repository}")

    run("git", "fetch", "origin", args.ref, cwd=SOURCE)
    revision = run("git", "rev-parse", "FETCH_HEAD^{commit}", cwd=SOURCE, capture=True).stdout.strip()
    # Remove only our known patch; never reset user edits in the upstream checkout.
    patched = run("git", "apply", "--reverse", "--check", PATCH, cwd=SOURCE, capture=True, check=False)
    if patched.returncode == 0:
        run("git", "apply", "--reverse", PATCH, cwd=SOURCE)
    board = SOURCE / "main" / "boards" / "pao-minimal"
    linked = board.is_symlink() and board.resolve() == ROOT / "boards" / "pao-minimal"
    if linked:
        board.unlink()
    dirty = run("git", "status", "--porcelain", "--untracked-files=normal", cwd=SOURCE, capture=True).stdout
    if dirty:
        if patched.returncode == 0:
            run("git", "apply", PATCH, cwd=SOURCE)
        if linked:
            board.symlink_to(ROOT / "boards" / "pao-minimal", target_is_directory=True)
        raise RuntimeError(f"Upstream checkout has local changes; preserve them before retrying:\n{dirty}")
    run("git", "checkout", "--detach", revision, cwd=SOURCE)
    compatible = run("git", "apply", "--check", PATCH, cwd=SOURCE, capture=True, check=False)
    if compatible.returncode:
        raise RuntimeError(f"Integration patch does not match {revision}; adapt firmware/integration.patch:\n{compatible.stderr}")
    run("git", "apply", PATCH, cwd=SOURCE)
    if board.exists() or board.is_symlink():
        raise RuntimeError(f"Refusing to replace existing board path: {board}")
    board.symlink_to(ROOT / "boards" / "pao-minimal", target_is_directory=True)
    (ROOT / "tmp" / "base-revision.json").write_text(json.dumps({
        "repository": repository, "ref": args.ref, "commit": revision,
    }, indent=2) + "\n")
    print(f"Base: {args.ref} -> {revision}", flush=True)
    if args.action == "prepare":
        return

    idf_path = os.environ.get("IDF_PATH")
    if not idf_path or not (Path(idf_path) / "tools" / "idf.py").is_file():
        raise RuntimeError("ESP-IDF is not active. Source ESP-IDF export.sh, then retry (see docs/build.md).")
    build = ROOT / "tmp" / "build" / revision
    build.mkdir(parents=True, exist_ok=True)
    defaults = ";".join(str(path) for path in (
        SOURCE / "sdkconfig.defaults",
        SOURCE / f"sdkconfig.defaults.{config['target']}",
        ROOT / "firmware" / "sdkconfig.defaults",
    ))
    command = [sys.executable, Path(idf_path) / "tools" / "idf.py",
               "-C", SOURCE, "-B", build,
               f"-DIDF_TARGET={config['target']}",
               f"-DSDKCONFIG={build / 'sdkconfig'}",
               f"-DSDKCONFIG_DEFAULTS={defaults}",
               f"-DBOARD_NAME={config['board_name']}",
               f"-DEXTRA_COMPONENT_DIRS={ROOT / 'components'}",
               "-DCMAKE_EXPORT_COMPILE_COMMANDS=ON"]
    run(*command, "reconfigure" if args.action == "configure" else "build")
    database = ROOT / "tmp" / "compile_commands.json"
    if database.is_symlink():
        database.unlink()
    if database.exists():
        raise RuntimeError(f"Refusing to replace {database}; move it aside and retry.")
    database.symlink_to(build / "compile_commands.json")
    print(f"IDE compilation database: {database}", flush=True)


if __name__ == "__main__":
    try:
        main()
    except (OSError, RuntimeError, subprocess.CalledProcessError) as error:
        print(f"error: {error}", file=sys.stderr)
        sys.exit(1)
