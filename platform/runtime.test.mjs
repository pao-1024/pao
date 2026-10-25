import test from "node:test";
import assert from "node:assert/strict";
import { allowedRequest } from "./runtime.ts";

test("runtime actions reject cross-origin requests, DNS rebinding and missing action header", () => {
  const request = { method: "POST", headers: { host: "127.0.0.1:4173", origin: "http://127.0.0.1:4173", "x-pao-studio": "1" } };
  assert.equal(allowedRequest(request), true);
  assert.equal(allowedRequest({ ...request, headers: { ...request.headers, origin: "https://evil.example" } }), false);
  assert.equal(allowedRequest({ ...request, headers: { ...request.headers, host: "evil.example:4173" } }), false);
  assert.equal(allowedRequest({ ...request, headers: { host: request.headers.host, origin: request.headers.origin } }), false);
  assert.equal(allowedRequest({ method: "GET", headers: { host: "127.0.0.1:4173" } }), true);
});
