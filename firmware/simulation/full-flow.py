#!/usr/bin/env python3
"""Verify WiFi in esp-emu, then hand persisted NVS to QEMU for I2S/WakeNet/dialog."""
import argparse
from contextlib import contextmanager
import csv
import fcntl
import json
import os
from pathlib import Path
import shutil
import signal
import socket
import subprocess
import sys
import time
import urllib.request
import uuid

from qemu import flash_image

ROOT = Path(__file__).resolve().parents[2]
SSID = "pao-sim-ap"
PASSWORD = "pao-sim-password"


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--build", type=Path, help="esp-emu firmware build")
    parser.add_argument("--qemu-build", type=Path)
    parser.add_argument("--emulator", type=Path, default=ROOT / "tmp/esp-emulator/esp-emu")
    parser.add_argument("--pcm-input", type=Path, required=True, help="Wake phrase, greeting pause, then a spoken question")
    parser.add_argument("--efuse", type=Path, required=True)
    parser.add_argument("--device-uuid", default=str(uuid.uuid4()))
    parser.add_argument("--expected-asr", default="介绍你自己")
    parser.add_argument("--timeout", type=float, default=240)
    args = parser.parse_args()
    if args.timeout <= 0 or not args.expected_asr:
        parser.error("Use a positive timeout and nonempty expected ASR text")
    device_uuid = str(uuid.UUID(args.device_uuid))
    if not args.pcm_input.is_file() or args.pcm_input.stat().st_size == 0 or args.pcm_input.stat().st_size % 2:
        parser.error("Input must contain complete 16-bit PCM samples")
    if args.efuse.stat().st_size != 336:
        parser.error("Expected a 336-byte QEMU-compatible eFuse image")
    revision = json.loads((ROOT / "tmp/base-revision.json").read_text())["commit"]
    build = (args.build or ROOT / "tmp/build" / (revision + "-esp-emu")).resolve()
    qemu_build = (args.qemu_build or ROOT / "tmp/build" / (revision + "-qemu")).resolve()
    config = json.loads((build / "config/sdkconfig.json").read_text())
    if not config.get("PAO_ESP_EMU") or not config.get("WAKE_WORD_DISABLED"):
        raise RuntimeError("Build must use the WiFi-only esp-emu profile")
    output = ROOT / "tmp/full-flow"
    output.mkdir(parents=True, exist_ok=True)
    lock = (output / "run.lock").open("a")
    fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
    (output / "result.json").unlink(missing_ok=True)
    temp = ROOT / "tmp/temp"
    temp.mkdir(exist_ok=True)
    environment = dict(os.environ, TMPDIR=str(temp))
    description = json.loads((build / "project_description.json").read_text())
    cache = (build / "CMakeCache.txt").read_text().splitlines()
    python = next(line.split("=", 1)[1] for line in cache if line.startswith("PYTHON:"))
    with (output / "nvs.csv").open("w", newline="") as file:
        csv.writer(file).writerows([("key", "type", "encoding", "value"),
                                   ("board", "namespace", "", ""),
                                   ("uuid", "data", "string", device_uuid)])
    generator = Path(description["idf_path"]) / "components/nvs_flash/nvs_partition_generator/nvs_partition_gen.py"
    subprocess.run([python, str(generator), "generate", str(output / "nvs.csv"),
                    str(output / "nvs.bin"), "0x4000"], check=True, env=environment)
    flash = output / "flash.bin"
    flash_image(build, flash, output / "nvs.bin")
    efuse = output / "efuse.bin"
    shutil.copyfile(args.efuse, efuse)
    with socket.socket() as listener:
        listener.bind(("127.0.0.1", 0))
        port = listener.getsockname()[1]
    deadline = time.monotonic() + args.timeout

    @contextmanager
    def simulator(name, password=PASSWORD, forward=False, duration="180s"):
        command = [str(args.emulator.resolve()), "--chip", "esp32s3", "--firmware", str(flash),
                   "--efuse", str(efuse), "--wifi-ssid", SSID, "--wifi-password", password,
                   "--wifi-fw-ap-password", "", "--net",
                   f"user,hostfwd=tcp:127.0.0.1:{port}-:80" if forward else "user",
                   "--save-state", "--timeout", duration]
        with (output / name).open("w") as log:
            process = subprocess.Popen(command, stdin=subprocess.DEVNULL, stdout=log,
                                       stderr=subprocess.STDOUT, env=environment)
            try:
                yield process, output / name
            finally:
                process.terminate()
                try:
                    process.wait(timeout=5)
                except subprocess.TimeoutExpired:
                    process.kill()
                    process.wait()

    def wait(process, log, predicate, label):
        while time.monotonic() < deadline:
            content = log.read_text(errors="replace")
            if "Guru Meditation Error" in content or "abort() was called" in content:
                raise RuntimeError(f"Guest crashed: {log}")
            if predicate(content):
                return content
            if process.poll() is not None:
                raise RuntimeError(f"Simulator exited before {label}: {log}")
            time.sleep(.1)
        raise TimeoutError(f"Timed out waiting for {label}: {log}")

    def request(path, body=None):
        data = json.dumps(body).encode() if body is not None else None
        req = urllib.request.Request(f"http://127.0.0.1:{port}{path}", data=data,
                                     headers={"Content-Type": "application/json"})
        with urllib.request.urlopen(req, timeout=30) as response:
            return response.read()

    with simulator("provision.log", forward=True) as (process, log):
        wait(process, log, lambda text: "DHCP server assigned IP to a client" in text,
             "emulated station joining the firmware SoftAP")
        page = request("/")
        assert b"ssid" in page.lower(), "Missing provisioning portal"
        (output / "portal.html").write_bytes(page)
        # The portal appears before the asynchronous first scan completes.
        wait(process, log, lambda text: any(ap["ssid"] == SSID for ap in
             json.loads(request("/scan"))["aps"]), "virtual AP in scan results")
        rejected = json.loads(request("/submit", {"ssid": "x" * 33, "password": PASSWORD}))
        assert rejected["success"] is False, "Invalid SSID accepted"
        connected = json.loads(request("/submit", {"ssid": SSID, "password": PASSWORD}))
        assert connected["success"] is True, "WiFi association failed"
        saved = json.loads(request("/saved/list"))
        assert SSID in saved, "SSID was not saved"
        assert json.loads(request("/exit", {}))["success"] is True
        wait(process, log, lambda text: "State: activating -> idle" in text, "cloud activation")
    # --save-state flushes Flash at simulator exit; transfer only the common NVS partition.
    nvs = output / "provisioned-nvs.bin"
    nvs.write_bytes(flash.read_bytes()[0x9000:0xd000])
    with simulator("restart.log") as (process, log):
        content = wait(process, log, lambda text: "State: activating -> idle" in text,
                       "automatic reconnect after restart")
        assert "Got IP:" in content and "Access Point started" not in content
    with simulator("wrong-password.log", password="wrong-sim-password", duration="25s") as (process, log):
        process.wait(timeout=min(40, max(1, deadline - time.monotonic())))
        content = log.read_text(errors="replace")
        assert "WiFi disconnected, reason:" in content and "Got IP:" not in content
        assert "Guru Meditation Error" not in content
    remaining = deadline - time.monotonic()
    if remaining <= 0:
        raise TimeoutError("WiFi checks exhausted the full-flow timeout")
    with (output / "qemu.log").open("w") as log:
        command = [sys.executable, str(Path(__file__).with_name("qemu.py")), "wake",
                        "--build", str(qemu_build), "--pcm-input", str(args.pcm_input.resolve()),
                        "--efuse", str(efuse), "--nvs", str(nvs),
                        "--expected-asr", args.expected_asr, "--timeout", str(remaining)]
        process = subprocess.Popen(command, stdout=log, stderr=subprocess.STDOUT, env=environment)
        try:
            if process.wait(timeout=remaining + 15):
                raise subprocess.CalledProcessError(process.returncode, command)
        finally:
            if process.poll() is None:
                process.terminate()
                try:
                    process.wait(timeout=15)
                except subprocess.TimeoutExpired:
                    process.kill()
                    process.wait()
    voice = json.loads((ROOT / "tmp/qemu-wake/result.json").read_text())
    result = {"provisioned": True, "saved_ssid": saved, "restart_reconnected": True,
              "invalid_ssid_rejected": True, "wrong_password_rejected": True,
              "wakeword_dialog": voice, "backends": "esp-emu WiFi -> persisted NVS -> QEMU I2S/WakeNet"}
    (output / "result.json").write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n")
    print(json.dumps(result, ensure_ascii=False))
    print(f"Evidence: {output}")


if __name__ == "__main__":
    def interrupted(signum, frame):
        raise KeyboardInterrupt()
    signal.signal(signal.SIGTERM, interrupted)
    main()
