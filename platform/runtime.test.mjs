import test from "node:test";
import assert from "node:assert/strict";
import { allowedRequest } from "./runtime.ts";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { iterateApplication, verifyApplication } from "./agent.ts";
import { validateAgent } from "./src/agent-spec.ts";
import { UnsupportedHardware } from "./src/hardware-plan.ts";

test("runtime actions reject cross-origin requests, DNS rebinding and missing action header", () => {
  const request = { method: "POST", headers: { host: "127.0.0.1:4173", origin: "http://127.0.0.1:4173", "x-pao-studio": "1" } };
  assert.equal(allowedRequest(request), true);
  assert.equal(allowedRequest({ ...request, headers: { ...request.headers, origin: "https://evil.example" } }), false);
  assert.equal(allowedRequest({ ...request, headers: { ...request.headers, host: "evil.example:4173" } }), false);
  assert.equal(allowedRequest({ ...request, headers: { host: request.headers.host, origin: request.headers.origin } }), false);
  assert.equal(allowedRequest({ method: "GET", headers: { host: "127.0.0.1:4173" } }), true);
});

const step = { name: "quiet", level: 0, durationMs: 500, alarm: false, volume: 0, toneHz: 0, motorA: 0, motorB: 0, label: "QUIET" };
const application = { kind: "agent", prompt: "quiet", summary: "quiet", source: 'StudioOutput studio_step(bool, int, int64_t) { return {0,0,0,0,false,"QUIET"}; }', scenarios: [step, { ...step, name: "loud", level: 9000 }] };

test("Agent repairs compilation and simulation errors without weakening acceptance", async () => {
  const feedback = [], progress = []; let builds = 0, checks = 0;
  const result = await iterateApplication({ prompt: "quiet", signal: new AbortController().signal, update: (s) => progress.push(s),
    generate: async (error) => { feedback.push(error); return { ...application, scenarios: feedback.length > 1 ? [{ ...step, label: "CHEAT" }, step] : application.scenarios }; },
    build: async () => { if (++builds === 1) throw Error("C++ missing symbol"); },
    verify: async (app) => { assert.deepEqual(app.scenarios, application.scenarios); if (++checks === 1) throw Error("PCM expected 2000 actual 0"); return "PCM verified"; },
  });
  assert.match(feedback[1], /C\+\+ missing symbol/); assert.match(feedback[2], /PCM expected/);
  assert.equal(builds, 3); assert.equal(checks, 2); assert.deepEqual(result.scenarios, application.scenarios);
  assert.equal(progress.at(-1).phase, "succeeded"); assert.match(progress.at(-1).log, /PCM verified/);
});

test("Agent stops at its repair budget and cancellation starts no further work", async () => {
  let calls = 0;
  await assert.rejects(iterateApplication({ prompt: "x", signal: new AbortController().signal, update: () => {},
    generate: async () => { calls++; throw Error("bad output"); }, build: async () => {}, verify: async () => "" }), /3 轮/);
  assert.equal(calls, 3);
  const controller = new AbortController(); calls = 0;
  await assert.rejects(iterateApplication({ prompt: "x", signal: controller.signal, update: () => {},
    generate: async () => { calls++; controller.abort(); throw Error("cancel"); }, build: async () => assert.fail(), verify: async () => assert.fail() }), /abort/i);
  assert.equal(calls, 1);
  calls = 0;
  await assert.rejects(iterateApplication({ prompt: "camera", signal: new AbortController().signal, update: () => {},
    generate: async () => { calls++; throw new UnsupportedHardware("没有摄像头"); }, build: async () => assert.fail(), verify: async () => assert.fail() }), /没有摄像头/);
  assert.equal(calls, 1);
});

test("Agent validates generated code and bounded scenario contracts", () => {
  assert.deepEqual(validateAgent(application), application);
  for (const value of [{ ...application, source: '#include "/etc/passwd"' }, { ...application, source: "void app_main() {}" },
    { ...application, scenarios: [] }, { ...application, scenarios: [step, { ...step, durationMs: -1 }] },
    { ...application, scenarios: [step, { ...step, motorA: 100 }] }, { ...application, scenarios: [step, { ...step, label: "中文" }] }])
    assert.throws(() => validateAgent(value));
});

test("SIL receives the initial snapshot delivered in the same turn as WebSocket open", async () => {
  const Original = globalThis.WebSocket;
  class SnapshotSocket {
    static OPEN = 1;
    readyState = 0; time = 0; running = false;
    constructor() {
      queueMicrotask(() => {
        this.readyState = 1; this.onopen();
        this.onmessage?.({ data: JSON.stringify({ t: "serial", src: "uart0", data: "STUDIO READY\n" }) });
      });
    }
    emit() {
      this.time += 100;
      this.onmessage({ data: JSON.stringify({ t: "serial", src: "uart0", data: `STUDIO AGENT time_ms=${this.time} running=${+this.running} level=0 alarm=0 volume=0 tone=0 motor_a=0 motor_b=0 label=${this.running ? "RUN" : "PAUSED"}\n` }) });
    }
    send(text) { this.running = JSON.parse(text).line === "app-run"; this.emit(); this.timer ??= setInterval(() => this.emit(), 5); }
    close() { clearInterval(this.timer); this.readyState = 3; }
  }
  globalThis.WebSocket = SnapshotSocket;
  try {
    const result = await verifyApplication({ mic: null, amp: null, motor: null, oled: null },
      { ...application, scenarios: [{ ...step, label: "RUN" }, { ...step, label: "RUN" }] }, AbortSignal.timeout(1000));
    assert.match(result, /暂停归零/);
  } finally { globalThis.WebSocket = Original; }
});

test("browser microphone resamples across blocks and packs the selected physical channel", () => {
  for (const sampleRate of [44100, 48000, 96000]) {
    const packets = [];
    let Processor;
    vm.runInNewContext(readFileSync(new URL("./public/studio-microphone.js", import.meta.url), "utf8"), {
      sampleRate,
      AudioWorkletProcessor: class { constructor() { this.port = { postMessage: (packet) => packets.push(packet) }; } },
      registerProcessor: (_name, processor) => { Processor = processor; },
    });
    const mic = new Processor({ processorOptions: { channel: 1 } });
    assert.equal(mic.process([]), true);
    for (let i = 0; i < 200; i++) mic.process([[new Float32Array(128).fill(2)]]);
    const expected = Math.floor((25600 - 1) * 48000 / sampleRate) + 1;
    assert.ok(Math.abs(packets.length * 1024 + mic.used - expected) <= 1);
    assert.ok(packets.length > 0);
    for (const packet of packets) {
      const bytes = new DataView(packet);
      assert.equal(bytes.byteLength, 2052);
      assert.deepEqual(Array.from(new Uint8Array(packet, 0, 4)), [6, 0, 1, 0]);
      for (let i = 4; i < packet.byteLength; i += 2) assert.equal(bytes.getInt16(i, true), 32767);
    }
  }
});
