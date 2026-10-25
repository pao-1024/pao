#!/usr/bin/env node
// Run against a booted PAO simulator. Its WebSocket carries decoded MCPWM outputs
// from the production firmware; each phase is separated by a simulator restart.
import assert from 'node:assert/strict';

const phase = process.argv[2];
if (!['exercise', 'restart-zero', 'restart-final'].includes(phase)) {
  console.error('Usage: node chassis-acceptance.mjs exercise|restart-zero|restart-final');
  process.exit(2);
}

const control = 'http://127.0.0.1:8081';
const traces = [];
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const closeTo = (value, expected, tolerance = 0.07) =>
  assert.ok(Math.abs(value - expected) <= tolerance,
    `Expected ${value.toFixed(3)} near ${expected.toFixed(3)}`);
const stopped = trace => Math.abs(trace.left) < 0.01 && Math.abs(trace.right) < 0.01;
const latest = () => traces.at(-1);

async function waitFor(predicate, description, timeoutMs = 90000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const trace = latest();
    if (trace && predicate(trace)) return trace;
    await sleep(20);
  }
  throw Error(`Timed out waiting for ${description}; latest=${JSON.stringify(latest())}`);
}

async function waitSim(seconds) {
  const start = latest().time;
  return waitFor(trace => trace.time >= start + seconds, `${seconds}s of simulator time`);
}

async function request(path, params, method = 'POST', expectedStatus = 200) {
  const query = new URLSearchParams(params ?? {}).toString();
  const url = control + path + (query ? `?${query}` : '');
  const response = await fetch(url, { method, signal: AbortSignal.timeout(30000) });
  if (response.status !== expectedStatus) {
    assert.fail(`${url}: expected ${expectedStatus}, got ${response.status}: ${await response.text()}`);
  }
  return response;
}

async function config() {
  return (await request('/api/motion-config', null, 'GET')).json();
}

async function action(name, duration_ms = 3000) {
  await request('/api/chassis', { action: name, duration_ms });
}

async function saveConfig(settings) {
  await request('/api/motion-config', settings);
  const loaded = await config();
  assert.equal(loaded.ramp_time_ms, settings.ramp_time_ms);
  closeTo(loaded.left_scale, settings.left_scale, 0.00001);
  closeTo(loaded.right_scale, settings.right_scale, 0.00001);
  if (settings.move_output !== undefined) assert.equal(loaded.move_output, settings.move_output);
  if (settings.rotate_output !== undefined) assert.equal(loaded.rotate_output, settings.rotate_output);
}

async function connect() {
  const socket = new WebSocket('ws://127.0.0.1:8080/ws');
  await new Promise((resolve, reject) => {
    socket.onopen = resolve;
    socket.onerror = () => reject(Error('Simulator WebSocket failed to open'));
  });
  socket.onmessage = event => {
    if (typeof event.data !== 'string') return;
    const message = JSON.parse(event.data);
    if (message.t !== 'pao') return;
    const pins = new Map(message.pwm);
    const level = BigInt(`0x${message.levels}`);
    const duty = pin => (pins.get(pin) ?? (level & (1n << BigInt(pin)) ? 1000 : 0)) / 1000;
    traces.push({ time: message.time, left: duty(14) - duty(13),
      right: duty(11) - duty(12) });
  };
  await waitFor(() => traces.length > 0, 'first PWM trace');
  return socket;
}

async function exercise() {
  assert.deepEqual(await config(), { ramp_time_ms: 1000, left_scale: 1, right_scale: 1,
    move_output: 80, rotate_output: 80 });
  assert.ok(stopped(latest()), 'Motor output must be zero at first boot');
  console.log('PASS: first boot defaults and stopped motors');

  await saveConfig({ ramp_time_ms: 1000, left_scale: 1, right_scale: 1,
    move_output: 60, rotate_output: 60 });
  const started = latest().time;
  await action('forward');
  await waitSim(0.30);
  let ramp = traces.filter(trace => trace.time > started + 0.05);
  assert.ok(ramp.some(trace => trace.left > 0.05 && trace.left < 0.5));
  assert.ok(ramp.every(trace => trace.left >= -0.01 && trace.right >= -0.01));
  const beforeRepeat = latest().right;
  await action('forward');
  await waitSim(0.45);
  assert.ok(latest().right >= beforeRepeat - 0.02, 'Repeat command reset the ramp');
  closeTo(latest().left, 0.6);
  closeTo(latest().right, 0.6);
  console.log('PASS: forward ramp and renewal without reset');

  await saveConfig({ ramp_time_ms: 1000, left_scale: 0.5, right_scale: 1 });
  await waitSim(0.65);
  closeTo(latest().left, 0.3);
  closeTo(latest().right, 0.6);
  await action('backward');
  await waitFor(trace => trace.left < -0.15 && trace.right < -0.3, 'reverse after zero');
  console.log('PASS: live wheel calibration and reverse through zero');

  await action('turn_left');
  await waitFor(trace => trace.left < -0.15 && trace.right > 0.3, 'counterclockwise rotation');
  await action('turn_right');
  await waitFor(trace => trace.left > 0.15 && trace.right < -0.3, 'clockwise rotation');
  console.log('PASS: rotation signs and motion replacement');

  await action('stop');
  await waitSim(0.10);
  assert.ok(Math.abs(latest().right) > 0.05 && Math.abs(latest().right) < 0.6,
    'Zero command must start with a smooth descent');
  await waitFor(stopped, 'soft stop output');
  console.log('PASS: soft stop');

  await action('forward');
  await waitFor(trace => trace.right > 0.2, 'motion before emergency stop');
  await action('emergency_stop');
  await waitFor(stopped, 'immediate stop output');
  console.log('PASS: immediate stop');

  await saveConfig({ ramp_time_ms: 1000, left_scale: 1, right_scale: 1 });
  await request('/api/move_forward', { distance_cm: 20 });
  await waitFor(trace => trace.left > 0.1 && trace.right > 0.1, 'distance move through new chassis');
  await action('emergency_stop');
  await waitFor(stopped, 'distance move cancellation');
  const distance = await (await request('/api/distance', null, 'GET')).json();
  assert.equal(distance.motion_status, 'cancelled');
  console.log('PASS: distance move uses new chassis and stop cancels it');

  await saveConfig({ ramp_time_ms: 0, left_scale: 0, right_scale: 1, move_output: 50 });
  await action('forward', 500);
  await waitFor(trace => trace.right > 0.45, 'zero-ramp motion');
  closeTo(latest().left, 0, 0.01);
  closeTo(latest().right, 0.5, 0.02);
  await waitSim(0.60);
  assert.ok(stopped(latest()), 'Timed motion did not stop');
  console.log('PASS: zero ramp, zero left gain, and timed stop');

  for (const invalid of [
    { ramp_time_ms: 3001, left_scale: 0, right_scale: 1 },
    { ramp_time_ms: 0, left_scale: 'nan', right_scale: 1 },
    { ramp_time_ms: 0, left_scale: 0 },
  ]) await request('/api/motion-config', invalid, 'POST', 400);
  assert.deepEqual(await config(), { ramp_time_ms: 0, left_scale: 0, right_scale: 1,
    move_output: 50, rotate_output: 60 });
  await request('/api/drive', { forward: 20, turn: 20 }, 'POST', 404);
  console.log('PASS: invalid values do not alter config; old drive route is absent');
}

async function restartZero() {
  assert.deepEqual(await config(), { ramp_time_ms: 0, left_scale: 0, right_scale: 1,
    move_output: 50, rotate_output: 60 });
  assert.ok(stopped(latest()), 'Motors started after NVS recovery');
  console.log('PASS: restart restored valid zero values and stopped motors');
  await saveConfig({ ramp_time_ms: 1200, left_scale: 0.75, right_scale: 0.9,
    move_output: 100, rotate_output: 100 });
}

async function restartFinal() {
  const saved = await config();
  assert.equal(saved.ramp_time_ms, 1200);
  closeTo(saved.left_scale, 0.75, 0.00001);
  closeTo(saved.right_scale, 0.9, 0.00001);
  assert.equal(saved.move_output, 100);
  assert.equal(saved.rotate_output, 100);
  assert.ok(stopped(latest()), 'Motors started after persisted config load');
  await action('forward', 2500);
  await waitSim(1.30);
  closeTo(latest().left, 0.75);
  closeTo(latest().right, 0.9);
  await action('emergency_stop');
  await waitFor(stopped, 'final stop');
  console.log('PASS: restart restored nonzero settings and applied them to real PWM');
}

let socket;
try {
  socket = await connect();
  if (phase === 'exercise') await exercise();
  if (phase === 'restart-zero') await restartZero();
  if (phase === 'restart-final') await restartFinal();
} finally {
  socket?.close();
}
