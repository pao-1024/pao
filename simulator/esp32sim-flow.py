#!/usr/bin/env python3
"""Run production PAO Wi-Fi provisioning and wake-word conversation in esp32sim."""
import argparse
import csv
import fcntl
import hashlib
import json
import math
import os
from pathlib import Path
import re
import socket
import struct
import subprocess
import time
import urllib.request
import uuid
import wave

ROOT = Path(__file__).resolve().parents[1]
SSID = "pao-sim-ap"
PASSWORD = "pao-sim-password"


def flash_image(build, destination, nvs):
    config = json.loads((build / "flasher_args.json").read_text())
    image = bytearray(b"\xff" * (16 * 1024 * 1024))
    for offset, name in config["flash_files"].items():
        data = (build / name).read_bytes()
        start = int(offset, 0)
        if start < 0 or start + len(data) > len(image):
            raise ValueError(f"Flash segment outside 16 MB: {name}")
        image[start:start + len(data)] = data
    data = nvs.read_bytes()
    if len(data) != 0x4000:
        raise ValueError("Voice NVS must match the 0x4000-byte partition")
    image[0x9000:0xd000] = data
    destination.write_bytes(image)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--build", type=Path)
    parser.add_argument("--emulator", type=Path, default=ROOT / "tmp/esp32sim-build/release/pao-sim")
    parser.add_argument("--rom", type=Path, required=True)
    parser.add_argument("--mac", required=True)
    parser.add_argument("--device-uuid", type=uuid.UUID, required=True)
    parser.add_argument("--wake-input", type=Path, required=True, help="16 kHz mono PCM16 wake phrase")
    parser.add_argument("--pcm-input", type=Path, required=True, help="16 kHz mono PCM16 question")
    parser.add_argument("--expected-asr", default="介绍你自己")
    parser.add_argument("--timeout", type=float, default=300)
    args = parser.parse_args()
    if not re.fullmatch(r"(?:[0-9a-fA-F]{2}:){5}[0-9a-fA-F]{2}", args.mac):
        parser.error("--mac must contain six hexadecimal octets")
    if not math.isfinite(args.timeout) or args.timeout <= 0 or not args.expected_asr.strip():
        parser.error("Use a positive timeout and nonempty expected ASR text")
    for path in [args.rom, args.emulator, args.wake_input, args.pcm_input]:
        if not path.is_file():
            parser.error(f"Missing input: {path}")
    for path in [args.wake_input, args.pcm_input]:
        if not path.stat().st_size or path.stat().st_size % 2:
            parser.error(f"Expected complete nonempty PCM16 samples: {path}")
    revision = json.loads((ROOT / "tmp/base-revision.json").read_text())["commit"]
    build = (args.build or ROOT / "tmp/build" / revision).resolve()
    config = json.loads((build / "config/sdkconfig.json").read_text())
    if (not config.get("BOARD_TYPE_PAO")
            or not config.get("USE_AFE_WAKE_WORD") or not config.get("SR_WN_WN9_NIHAOXIAOZHI_TTS")):
        raise RuntimeError("Build the production PAO firmware with WakeNet enabled")
    output = ROOT / "tmp/esp32sim-full-flow"
    output.mkdir(parents=True, exist_ok=True)
    with (output / "run.lock").open("a") as lock:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        run(args, build, output)


def run(args, build, output):
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
                                   ("uuid", "data", "string", str(args.device_uuid))])
    generator = Path(description["idf_path"]) / "components/nvs_flash/nvs_partition_generator/nvs_partition_gen.py"
    subprocess.run([python, str(generator), "generate", str(output / "nvs.csv"),
                    str(output / "nvs.bin"), "0x4000"], check=True, env=environment)
    flash_image(build, output / "fresh.bin", output / "nvs.bin")
    firmware_hash = hashlib.sha256((build / "xiaozhi.bin").read_bytes()).hexdigest()
    common = [str(args.emulator.resolve()), "--board", "pao", "--boot", "rom",
              "--mac", args.mac, "--rom", str(args.rom.resolve()),
              "--flash-mb", "16", "--psram-mb", "8", "--elf", str(build / "xiaozhi.elf"),
              "--wifi", f"ssid={SSID},psk={PASSWORD}", "--realtime", "--console", "uart0", "--no-dump"]
    with socket.socket() as listener:
        listener.bind(("127.0.0.1", 0))
        port = listener.getsockname()[1]

    def request(path, data=None, timeout=30):
        body = json.dumps(data).encode() if data is not None else None
        req = urllib.request.Request(f"http://127.0.0.1:{port}{path}", data=body,
                                     headers={"Content-Type": "application/json"})
        with urllib.request.urlopen(req, timeout=timeout) as response:
            return response.read()

    with (output / "provision.log").open("w") as log:
        command = common + ["--flash-image", str(output / "fresh.bin"),
                            "--wifi-join", "", "--hostfwd", f"tcp:127.0.0.1:{port}-192.168.4.1:80",
                            "--max-seconds", "30", "--flash-out", str(output / "saved.bin"),
                            "--tft-png", str(output / "provision-oled.png")]
        process = subprocess.Popen(command, stdin=subprocess.DEVNULL, stdout=log, stderr=log, env=environment)
        try:
            deadline = time.monotonic() + args.timeout
            while True:
                try:
                    page = request("/", timeout=3)
                    assert b"ssid" in page.lower(), "Missing provisioning portal"
                    break
                except (OSError, TimeoutError):
                    if process.poll() is not None or time.monotonic() >= deadline:
                        raise RuntimeError(f"Production portal unavailable; inspect {output / 'provision.log'}")
            assert json.loads(request("/saved/list")) == [], "Fresh NVS already contains a network"
            while not any(ap["ssid"] == SSID for ap in json.loads(request("/scan"))["aps"]):
                if process.poll() is not None or time.monotonic() >= deadline:
                    raise TimeoutError("Virtual WPA2 AP absent from firmware scan")
                time.sleep(.1)
            assert json.loads(request("/submit", {"ssid": SSID, "password": PASSWORD}))["success"]
            assert SSID in json.loads(request("/saved/list")), "SSID was not persisted"
            assert json.loads(request("/exit", {}))["success"]
            process.wait(timeout=max(1, deadline - time.monotonic()))
            assert process.returncode == 0, "Provisioning emulator failed"
        finally:
            if process.poll() is None:
                process.terminate()
                process.wait(timeout=15)
    text = (output / "provision.log").read_text(errors="replace")
    assert "State: activating -> idle" in text, f"Device activation incomplete; inspect {output / 'provision.log'}"
    assert "OledDisplay: Adding OLED display" in text and "OLED unavailable" not in text
    # A 32-bit digital microphone slot is shifted by 12 in the production codec.
    # esp32sim left-aligns PCM16 by 16, so compensate the host samples by 16.
    for name, source in [("wake", args.wake_input), ("question", args.pcm_input)]:
        data = source.read_bytes()
        normalized = b"".join(struct.pack("<h", sample // 16) for (sample,) in struct.iter_unpack("<h", data))
        (output / f"{name}.pcm").write_bytes(b"\0" * 16000 + normalized + b"\0" * 16000)
    wake_duration = args.wake_input.stat().st_size / 32000 + 2
    question_done = wake_duration + 2.5 + args.pcm_input.stat().st_size / 32000
    (output / "voice.script").write_text(
        "0 release 0\n0 waituart0 60 Startup wake word hint:\n"
        f"1 i2spcm 1 {output / 'wake.pcm'} 16000\n"
        f"{wake_duration + 1} waituart0 60 State: speaking -> listening\n"
        f"{wake_duration + 1.5} i2spcm 1 {output / 'question.pcm'} 16000\n"
        f"{question_done} waituart0 60 State: speaking -> listening\n"
        f"{question_done + .2} press 0 100\n")
    with (output / "voice.log").open("w") as log:
        subprocess.run(common + ["--flash-image", str(output / "saved.bin"), "--max-seconds", "60",
                                "--script", str(output / "voice.script"), "--wav", str(output / "speaker.wav"),
                                "--tft-png", str(output / "oled.png")],
                       stdin=subprocess.DEVNULL, stdout=log, stderr=log,
                       env=environment, timeout=args.timeout, check=True)
    text = (output / "voice.log").read_text(errors="replace")
    for required in [f"Connected to WiFi: {SSID}", "Wake word detected: 你好小智",
                     "State: connecting -> listening", "State: listening -> speaking"]:
        assert required in text, f"Missing {required!r}; inspect {output / 'voice.log'}"
    assert "State: starting -> wifi_configuring" not in text
    assert "OledDisplay: Adding OLED display" in text and "OLED unavailable" not in text
    assert "I2S1 input overflow" not in text and "wait uart0 timeout" not in text
    assert "Guru Meditation Error" not in text and "task_wdt: Task watchdog got triggered" not in text
    asr = re.findall(r"Application: >> (.*)", text)
    assert any(args.expected_asr in line for line in asr), f"Unexpected ASR: {asr}"
    assert text.count("State: speaking -> listening") >= 2, "Greeting and response must both finish"
    button = text.find("Gpio(0, false)")
    assert button >= 0 and "State: listening -> idle" in text[button:], "BOOT click did not close the conversation"
    greeting_end = re.search(r"I \((\d+)\) StateMachine: State: speaking -> listening", text)
    assert greeting_end, "Missing greeting completion time"
    with wave.open(str(output / "speaker.wav"), "rb") as wav:
        assert wav.getsampwidth() == 2 and wav.getnchannels() == 1
        samples = [sample for (sample,) in struct.iter_unpack("<h", wav.readframes(wav.getnframes()))]
        nonzero = sum(sample != 0 for sample in samples)
        assert nonzero > wav.getframerate(), "Missing sustained I2S playback"
        # Capture omits disabled TX periods, so this offset is an upper bound on the greeting's end.
        reply_start = int(greeting_end[1]) * wav.getframerate() // 1000
        reply_nonzero = sum(sample != 0 for sample in samples[reply_start:])
        assert reply_nonzero > wav.getframerate() // 4, "Missing I2S audio after the greeting"
        audio = {"sample_rate": wav.getframerate(), "frames": len(samples),
                 "nonzero_samples": nonzero, "reply_nonzero_samples": reply_nonzero}
    assert hashlib.sha256((build / "xiaozhi.bin").read_bytes()).hexdigest() == firmware_hash
    result = {"backend": "esp32sim", "firmware_sha256": firmware_hash, "production_firmware": True,
              "first_provisioning": True, "saved_wifi_cold_boot": True, "real_wakenet": True,
              "oled_initialized": True,
              "boot_button_closed_conversation": True,
              "question_asr": asr, "tts_returned_to_listening": True, "i2s_output": audio}
    (output / "result.json").write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n")
    print(json.dumps(result, ensure_ascii=False))
    print(f"Evidence: {output}")


if __name__ == "__main__":
    main()
