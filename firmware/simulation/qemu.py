#!/usr/bin/env python3
"""Run the PAO peripheral probe or a real voice conversation in QEMU."""
import argparse
import array
import json
import os
from pathlib import Path
import socket
import signal
import subprocess
import sys
import time
import wave

ROOT = Path(__file__).resolve().parents[2]
DEVICE = "/machine/soc/peripherals"


def flash_image(build, destination, nvs):
    config = json.loads((build / "flasher_args.json").read_text())
    image = bytearray(b"\xff" * (16 * 1024 * 1024))
    for offset, name in config["flash_files"].items():
        data = (build / name).read_bytes()
        start = int(offset, 0)
        if start < 0 or start + len(data) > len(image):
            raise ValueError(f"Flash segment outside 16 MB: {name}")
        image[start:start + len(data)] = data
    if nvs:
        data = nvs.read_bytes()
        if len(data) != 0x4000:
            raise ValueError("Voice NVS must match the 0x4000-byte partition")
        image[0x9000:0xd000] = data
    destination.write_bytes(image)


class Qmp:
    def __init__(self, path):
        self.socket = socket.socket(socket.AF_UNIX)
        self.socket.settimeout(10)
        self.socket.connect(str(path))
        self.stream = self.socket.makefile("rwb", buffering=0)
        json.loads(self.stream.readline())
        self.command("qmp_capabilities")

    def command(self, name, arguments=None):
        self.stream.write(json.dumps({"execute": name, "arguments": arguments or {}}).encode() + b"\n")
        while True:
            reply = json.loads(self.stream.readline())
            if "error" in reply:
                raise RuntimeError(reply["error"])
            if "return" in reply:
                return reply["return"]

    def get(self, prop):
        return self.command("qom-get", {"path": DEVICE, "property": prop})

    def set(self, prop, value):
        self.command("qom-set", {"path": DEVICE, "property": prop, "value": value})

    def close(self):
        self.stream.close()
        self.socket.close()


def main():
    def interrupted(signum, frame):
        raise KeyboardInterrupt()
    signal.signal(signal.SIGTERM, interrupted)
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("mode", choices=("probe", "voice"))
    parser.add_argument("--qemu", type=Path, default=ROOT / "tmp/qemu-install-build/qemu-system-xtensa")
    parser.add_argument("--build", type=Path)
    parser.add_argument("--pcm-input", type=Path, help="16 kHz mono signed 16-bit little-endian PCM")
    parser.add_argument("--efuse", type=Path, help="Persistent QEMU ESP32-S3 eFuse image")
    parser.add_argument("--nvs", type=Path, help="Activated device's 16 KB NVS image")
    parser.add_argument("--timeout", type=float, default=180)
    args = parser.parse_args()
    if args.build is None:
        revision = json.loads((ROOT / "tmp/base-revision.json").read_text())["commit"]
        args.build = ROOT / "tmp/build" / (revision + "-qemu")
    if args.timeout <= 0:
        parser.error("--timeout must be positive")
    if args.mode == "voice" and not args.pcm_input:
        parser.error("voice requires --pcm-input")
    qmp_path = ROOT / "tmp" / "qmp.sock"
    if qmp_path.exists():
        raise RuntimeError(f"QMP socket already exists: {qmp_path}; check for a running simulator")
    output = ROOT / "tmp" / ("qemu-" + args.mode)
    output.mkdir(parents=True, exist_ok=True)
    for name in ("result.json", "speaker.wav", "reply.wav", "oled.pbm", "oled.png"):
        (output / name).unlink(missing_ok=True)
    temp = ROOT / "tmp" / "temp"
    temp.mkdir(exist_ok=True)
    flash = output / "flash.bin"
    flash_image(args.build.resolve(), flash, args.nvs)
    pcm_input = args.pcm_input
    if args.mode == "probe":
        pcm_input = output / "input.pcm"
        pcm_input.write_bytes(b"\x34\x12" * 160000)
    pcm_input = pcm_input.resolve()
    if pcm_input.stat().st_size % 2:
        raise ValueError("PCM input must contain complete 16-bit samples")
    pcm_output = output / "speaker.pcm"
    uart = output / "uart.log"
    command = [str(args.qemu.resolve()), "-S", "-display", "none", "-monitor", "none",
               "-serial", f"file:{uart}", "-machine", "esp32s3", "-m", "8M",
               "-global", "driver=ssi_psram,property=is_octal,value=true",
               "-global", f"driver=esp32s3.peripherals,property=pcm-in,value={pcm_input}",
               "-global", f"driver=esp32s3.peripherals,property=pcm-out,value={pcm_output}",
               "-drive", f"file={flash},if=mtd,format=raw,snapshot=on",
               "-qmp", f"unix:{qmp_path},server=on,wait=off"]
    if args.efuse:
        command += ["-drive", f"file={args.efuse.resolve()},if=none,id=efuse,format=raw,snapshot=on",
                    "-global", "driver=nvram.esp32s3.efuse,property=drive,value=efuse"]
    command += ["-nic", "user,model=open_eth"] if args.mode == "voice" else ["-nic", "none"]
    deadline = time.monotonic() + args.timeout
    qmp = None
    with (output / "qemu.log").open("w") as log:
        process = subprocess.Popen(command, stdout=log, stderr=subprocess.STDOUT,
                                   env=dict(os.environ, TMPDIR=str(temp)))
        try:
            def wait_for(predicate, label):
                while time.monotonic() < deadline:
                    if predicate():
                        return
                    if process.poll() is not None:
                        raise RuntimeError(f"QEMU exited: {process.returncode}; see {output}")
                    time.sleep(.05)
                raise TimeoutError(f"Timed out waiting for {label}; see {uart}")

            def text():
                return uart.read_text(errors="replace") if uart.exists() else ""

            def marker(value):
                def found():
                    content = text()
                    if "abort() was called" in content or "Guru Meditation Error" in content:
                        raise RuntimeError(f"Guest crashed; see {uart}")
                    return value in content
                wait_for(found, value)

            wait_for(qmp_path.exists, "QMP socket")
            qmp = Qmp(qmp_path)
            if args.mode == "probe":
                qmp.set("input-active", 1)
            qmp.command("cont")
            if args.mode == "probe":
                for cycle in range(2):
                    if cycle:
                        qmp.command("stop")
                        qmp.command("system_reset")
                        wait_for(lambda: qmp.get("rx-bytes") == 0, "peripheral reset")
                        qmp.set("input-active", 1)
                        qmp.command("cont")
                    wait_for(lambda: text().count("BUTTON_READY") == cycle + 1, "button ready")
                    qmp.set("gpio-inputs", 0xfffffffffffffffe)
                    wait_for(lambda: text().count("BUTTON_PRESSED") == cycle + 1, "button pressed")
                    qmp.set("gpio-inputs", 0xffffffffffffffff)
                    wait_for(lambda: text().count("PROBE_DONE") == cycle + 1, "probe complete")
                assert "AUDIO_CONTENT_PASS" in text(), "I2S input content mismatch"
                assert text().count("NVS_ROUNDTRIP_PASS") == 2, "Flash persistence failed"
                image = qmp.get("oled-pbm")
                pixels = list(map(int, image.split()[3:]))
                assert len(pixels) == 8192 and all(v == (i // 128) % 2 for i, v in enumerate(pixels)), "OLED pixel mismatch"
                assert qmp.get("led-rgb") == 0x123456, "WS2812 color mismatch"
            else:
                marker("activating -> idle")
                qmp.set("gpio-inputs", 0xfffffffffffffffe)
                marker("BOOT_DOWN")
                qmp.set("gpio-inputs", 0xffffffffffffffff)
                marker("connecting -> listening")
                qmp.set("input-active", 1)
                marker("Application: >> ")
                reply_offset = pcm_output.stat().st_size
                marker("Application: << ")
                marker("speaking -> listening")
                image = qmp.get("oled-pbm")
                assert "1" in image.split()[3:], "OLED is blank"
            (output / "oled.pbm").write_text(image)
            result = {"mode": args.mode, "rx_bytes": qmp.get("rx-bytes"),
                      "tx_bytes": qmp.get("tx-bytes"), "led_rgb": qmp.get("led-rgb")}
            if args.mode == "probe":
                result["boot_cycles"] = 2
            assert result["rx_bytes"] > 0 and result["tx_bytes"] > 0, "No I2S DMA traffic"
        finally:
            if qmp:
                qmp.close()
            process.terminate()
            try:
                process.wait(timeout=3)
            except subprocess.TimeoutExpired:
                process.kill()
                process.wait()
            qmp_path.unlink(missing_ok=True)
    samples = array.array("h")
    samples.frombytes(pcm_output.read_bytes())
    if sys.byteorder != "little":
        samples.byteswap()
    assert any(samples), "I2S speaker output is silent"
    if args.mode == "probe":
        assert all(x in (0, 0x2345) for x in samples), "I2S output content mismatch"
    else:
        reply_pcm = pcm_output.read_bytes()[reply_offset:]
        reply_samples = array.array("h")
        reply_samples.frombytes(reply_pcm)
        assert any(reply_samples), "No audible I2S output after ASR"
        result["tts_samples"] = len(reply_samples)
        with wave.open(str(output / "reply.wav"), "wb") as wav:
            wav.setparams((1, 2, 24000, 0, "NONE", "not compressed"))
            wav.writeframes(reply_pcm)
    with wave.open(str(output / "speaker.wav"), "wb") as wav:
        wav.setparams((1, 2, 24000, 0, "NONE", "not compressed"))
        wav.writeframes(pcm_output.read_bytes())
    result["speaker_samples"] = len(samples)
    (output / "result.json").write_text(json.dumps(result, indent=2) + "\n")
    print(json.dumps(result, ensure_ascii=False))
    print(f"Evidence: {output}")


if __name__ == "__main__":
    main()
