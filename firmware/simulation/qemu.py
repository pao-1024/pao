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
    parser.add_argument("mode", choices=("probe", "voice", "wake", "wake-negative"))
    parser.add_argument("--expected-asr", default="介绍你自己", help="Question text required after wakeup")
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
    if args.mode == "wake" and not args.expected_asr:
        parser.error("--expected-asr must be nonempty")
    if args.mode != "probe" and not args.pcm_input:
        parser.error("voice requires --pcm-input")
    qmp_path = ROOT / "tmp" / "qmp.sock"
    if qmp_path.exists():
        raise RuntimeError(f"QMP socket already exists: {qmp_path}; check for a running simulator")
    output = ROOT / "tmp" / ("qemu-" + args.mode)
    output.mkdir(parents=True, exist_ok=True)
    for name in ("result.json", "speaker.wav", "reply.wav", "oled.pbm", "oled.png", "indicator.svg", "motors.svg"):
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
    command += ["-nic", "user,model=open_eth"] if args.mode != "probe" else ["-nic", "none"]
    deadline = time.monotonic() + args.timeout
    qmp = None
    indicator_events = []
    motor_events = []
    pwm_events = []
    with (output / "qemu.log").open("w") as log:
        process = subprocess.Popen(command, stdout=log, stderr=subprocess.STDOUT,
                                   env=dict(os.environ, TMPDIR=str(temp)))
        try:
            def wait_for(predicate, label):
                while time.monotonic() < deadline:
                    if uart.exists():
                        content = uart.read_text(errors="replace")
                        if "Guru Meditation Error" in content or "abort() was called" in content:
                            raise RuntimeError(f"Guest crashed; see {uart}")
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
                assert qmp.get("gpio-outputs") == 0, "GPIO outputs were not reset"
            qmp.command("cont")
            if args.mode == "probe":
                for cycle in range(2):
                    if cycle:
                        qmp.command("stop")
                        qmp.command("system_reset")
                        wait_for(lambda: qmp.get("rx-bytes") == 0, "peripheral reset")
                        assert qmp.get("gpio-outputs") == 0, "GPIO outputs survived reset"
                        qmp.set("input-active", 1)
                        qmp.command("cont")
                    wait_for(lambda: text().count("BUTTON_READY") == cycle + 1, "button ready")
                    qmp.set("gpio-inputs", 0xfffffffffffffffe)
                    wait_for(lambda: text().count("BUTTON_PRESSED") == cycle + 1, "button pressed")
                    indicator_events.append({"cycle": cycle + 1, "on": True})
                    print(f"SIM_EVENT cycle={cycle + 1} indicator=ON", flush=True)
                    qmp.set("gpio-inputs", 0xffffffffffffffff)
                    wait_for(lambda: text().count("BUTTON_RELEASED") == cycle + 1, "button released")
                    indicator_events.append({"cycle": cycle + 1, "on": False})
                    print(f"SIM_EVENT cycle={cycle + 1} indicator=OFF", flush=True)
                    # MX1508 Rev1.3 truth table: IN1 is the low bit of each pair.
                    states = ("coast", "forward", "reverse", "brake")
                    for stage in range(16):
                        wait_for(lambda: text().count(f"MOTOR_STAGE value={stage};") == cycle + 1,
                                 f"motor input combination {stage}")
                        levels = (qmp.get("gpio-outputs") >> 11) & 15
                        assert levels == stage, f"Motor GPIO mismatch: {levels} != {stage}"
                        event = {"cycle": cycle + 1, "inputs": levels,
                                 "right": states[levels & 3], "left": states[(levels >> 2) & 3]}
                        motor_events.append(event)
                        print(f"MOTOR_EVENT {json.dumps(event)}", flush=True)
                        qmp.set("gpio-inputs", 0xfffffffffffffffe)
                        wait_for(lambda: text().count(f"MOTOR_ACK value={stage};") == cycle + 1,
                                 "motor stage acknowledgement")
                        qmp.set("gpio-inputs", 0xffffffffffffffff)
                    expected = ((0, 0), (.25, -.5), (-.75, .125), (1, -1), (-1, 1),
                                (1, -1), (0, 0), (.001, -.999), (0, 0),
                                (1, 1), (-1, -1), (1, -1), (.75, .25), (1, 0), (0, 0), (0, 0))
                    for stage, (right, left) in enumerate(expected):
                        wait_for(lambda: text().count(f"PWM_STAGE value={stage};") == cycle + 1,
                                 f"motor driver stage {stage}")
                        duty = json.loads(qmp.get("pin-duty"))[11:15]
                        assert all(v is not None for v in duty), f"Unsupported motor PWM: {duty}"
                        assert duty[0] * duty[1] == duty[2] * duty[3] == 0, f"Both directions active: {duty}"
                        actual = (duty[0] - duty[1], duty[2] - duty[3])
                        assert all(abs(a - b) < 1e-6 for a, b in zip(actual, (right, left))), (
                            f"Motor duty mismatch at {stage}: {actual} != {(right, left)}")
                        event = {"cycle": cycle + 1, "stage": stage, "right": actual[0], "left": actual[1]}
                        pwm_events.append(event)
                        print(f"PWM_EVENT {json.dumps(event)}", flush=True)
                        qmp.set("gpio-inputs", 0xfffffffffffffffe)
                        wait_for(lambda: text().count(f"PWM_ACK value={stage};") == cycle + 1,
                                 "PWM stage acknowledgement")
                        qmp.set("gpio-inputs", 0xffffffffffffffff)
                    wait_for(lambda: text().count("PROBE_DONE") == cycle + 1, "probe complete")
                    assert (qmp.get("gpio-outputs") >> 11) & 15 == 0, "Motor outputs not disabled"
                    assert json.loads(qmp.get("pin-duty"))[11:15] == [0] * 4, "Motor destructor left outputs active"
                assert "AUDIO_CONTENT_PASS" in text(), "I2S input content mismatch"
                assert text().count("FPU_WAKE_PRIMITIVES_PASS") == 2, "WakeNet floating-point regression"
                assert text().count("NVS_ROUNDTRIP_PASS") == 2, "Flash persistence failed"
                image = qmp.get("oled-pbm")
                pixels = list(map(int, image.split()[3:]))
                assert len(pixels) == 8192 and all(v == (i // 128) % 2 for i, v in enumerate(pixels)), "OLED pixel mismatch"
                assert qmp.get("led-rgb") == 0x123456, "WS2812 color mismatch"
            else:
                marker("pao: External PAO component initialized")
                marker("activating -> idle")
                if args.mode == "wake-negative":
                    qmp.set("input-active", 1)
                    start = qmp.get("rx-bytes")
                    wait_for(lambda: qmp.get("rx-bytes") - start >= 16_000 * 4 * 12,
                             "12 seconds of negative wake audio")
                    assert "Wake word detected:" not in text(), "False wakeup"
                    assert "idle -> connecting" not in text(), "Unexpected conversation"
                elif args.mode == "wake":
                    qmp.set("input-active", 1)
                    marker("Wake word detected:")
                    qmp.set("input-active", 0)
                else:
                    start = qmp.get("rx-bytes")
                    qmp.set("gpio-inputs", 0xfffffffffffffffe)
                    wait_for(lambda: qmp.get("rx-bytes") - start >= 6400,
                             "100 ms button hold while real I2S DMA runs")
                    qmp.set("gpio-inputs", 0xffffffffffffffff)
                if args.mode != "wake-negative":
                    marker("connecting -> listening")
                    if args.mode == "wake":
                        marker("speaking -> listening")
                    qmp.set("input-active", 1)
                    if args.mode == "wake":
                        wait_for(lambda: any("Application: >> " in line and args.expected_asr in line
                                             for line in text().splitlines()), "question ASR after wakeup")
                    else:
                        marker("Application: >> ")
                    offset = text().rfind("Application: >> ")
                    reply_offset = pcm_output.stat().st_size
                    wait_for(lambda: "Application: << " in text()[offset:], "assistant reply")
                    wait_for(lambda: "speaking -> listening" in text()[offset:], "reply playback")
            if args.mode == "probe":
                (output / "oled.pbm").write_text(image)
            result = {"mode": args.mode, "rx_bytes": qmp.get("rx-bytes"),
                      "tx_bytes": qmp.get("tx-bytes"), "led_rgb": qmp.get("led-rgb")}
            if args.mode == "probe":
                result["boot_cycles"] = 2
                result["virtual_indicator_events"] = indicator_events
                result["motor_events"] = motor_events
                result["pwm_events"] = pwm_events
            elif args.mode != "wake-negative":
                result["firmware_board"] = "pao"
                result["network_transport"] = "OpenETH"
                result["asr"] = next(line.split("Application: >> ", 1)[1] for line in
                                     reversed(text().splitlines()) if "Application: >> " in line)
                result["wakeword_detected"] = "Wake word detected:" in text()
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
        # This host-only indicator has no device register or actuator mapping.
        svg = ['<svg xmlns="http://www.w3.org/2000/svg" width="640" height="140" viewBox="0 0 640 140">',
               '<rect width="640" height="140" fill="#fff"/>']
        for index, event in enumerate(indicator_events):
            x = 80 + 160 * index
            color = "#16a34a" if event["on"] else "#9ca3af"
            state = "ON" if event["on"] else "OFF"
            svg.append(f'<circle cx="{x}" cy="45" r="22" fill="{color}"/>')
            svg.append(f'<text x="{x}" y="100" text-anchor="middle" font-family="sans-serif" font-size="16">'
                       f'Cycle {event["cycle"]}: {state}</text>')
        svg.append('</svg>')
        (output / "indicator.svg").write_text("\n".join(svg) + "\n")
        height = 90 + (len(motor_events) + len(pwm_events)) * 30
        svg = [f'<svg xmlns="http://www.w3.org/2000/svg" width="680" height="{height}" viewBox="0 0 680 {height}">',
               '<style>text {font:16px sans-serif}</style>',
               f'<rect width="680" height="{height}" fill="#fff"/>',
               '<text x="20" y="30">Boot / inputs</text><text x="250" y="30">Right motor</text>',
               '<text x="470" y="30">Left motor</text>']
        colors = {"coast": "#9ca3af", "forward": "#16a34a", "reverse": "#2563eb", "brake": "#d97706"}
        for index, event in enumerate(motor_events):
            y = 65 + index * 30
            svg.append(f'<text x="20" y="{y}">{event["cycle"]} / {event["inputs"]:04b}</text>')
            for x, side in ((250, "right"), (470, "left")):
                state = event[side]
                svg.append(f'<circle cx="{x}" cy="{y - 5}" r="8" fill="{colors[state]}"/>')
                svg.append(f'<text x="{x + 20}" y="{y}">{state}</text>')
        y = 65 + len(motor_events) * 30
        svg.append(f'<text x="20" y="{y}">Real Motor / Chassis: signed duty</text>')
        for index, event in enumerate(pwm_events):
            y = 95 + (len(motor_events) + index) * 30
            svg.append(f'<text x="20" y="{y}">{event["cycle"]} / PWM {event["stage"]}</text>')
            for x, side in ((250, "right"), (470, "left")):
                svg.append(f'<text x="{x}" y="{y}">{event[side]:+.1%}</text>')
        svg.append('</svg>')
        (output / "motors.svg").write_text("\n".join(svg) + "\n")
    elif args.mode != "wake-negative":
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
