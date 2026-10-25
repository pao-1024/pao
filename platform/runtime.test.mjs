import test from "node:test";
import assert from "node:assert/strict";
import { allowedRequest } from "./runtime.ts";
import { readFileSync } from "node:fs";
import vm from "node:vm";

test("runtime actions reject cross-origin requests, DNS rebinding and missing action header", () => {
  const request = { method: "POST", headers: { host: "127.0.0.1:4173", origin: "http://127.0.0.1:4173", "x-pao-studio": "1" } };
  assert.equal(allowedRequest(request), true);
  assert.equal(allowedRequest({ ...request, headers: { ...request.headers, origin: "https://evil.example" } }), false);
  assert.equal(allowedRequest({ ...request, headers: { ...request.headers, host: "evil.example:4173" } }), false);
  assert.equal(allowedRequest({ ...request, headers: { host: request.headers.host, origin: request.headers.origin } }), false);
  assert.equal(allowedRequest({ method: "GET", headers: { host: "127.0.0.1:4173" } }), true);
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
