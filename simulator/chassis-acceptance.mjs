#!/usr/bin/env node
// Run against a booted PAO simulator. Its WebSocket carries decoded MCPWM outputs
// from the production firmware; each phase is separated by a simulator restart.
import assert from 'node:assert/strict';
import { ControlClient } from './web/control.ts';

const phase = process.argv[2];
if (!['exercise', 'restart-zero', 'restart-final'].includes(phase)) {
  console.error('Usage: node chassis-acceptance.mjs exercise|restart-zero|restart-final');
  process.exit(2);
}

const control = new ControlClient('ws://127.0.0.1:8081/ws', 30000);
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

async function config() {
  return control.request('/api/motion-config');
}

async function action(name, duration_ms = 3000) {
  await control.request('/api/chassis', { action: name, duration_ms });
}

async function saveConfig(settings) {
  await control.request('/api/motion-config', settings);
  const loaded = await config();
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
  assert.deepEqual(await config(), { left_scale: 1, right_scale: 1,
    move_output: 80, rotate_output: 80 });
  assert.ok(stopped(latest()), 'Motor output must be zero at first boot');
  console.log('PASS: first boot defaults and stopped motors');

  await saveConfig({ left_scale: 1, right_scale: 1, move_output: 60, rotate_output: 80 });
  const started = latest().time;
  await action('forward');
  const first = await waitFor(trace => trace.time > started && !stopped(trace), 'forward output');
  closeTo(first.left, 0.6, 0.02);
  closeTo(first.right, 0.6, 0.02);
  await action('forward');
  await waitSim(0.20);
  const moving = traces.filter(trace => trace.time > first.time);
  assert.ok(moving.every(trace => Math.abs(trace.left - 0.6) < 0.02 &&
    Math.abs(trace.right - 0.6) < 0.02), 'Renewal changed the motor output');
  closeTo(latest().left, 0.6);
  closeTo(latest().right, 0.6);
  console.log('PASS: immediate forward output and uninterrupted renewal');

  await saveConfig({ left_scale: 0.5, right_scale: 1 });
  await waitSim(0.10);
  closeTo(latest().left, 0.3);
  closeTo(latest().right, 0.6);
  await action('backward');
  const reverse = await waitFor(trace => trace.left < 0 && trace.right < 0, 'reverse output');
  closeTo(reverse.left, -0.3, 0.02);
  closeTo(reverse.right, -0.6, 0.02);
  console.log('PASS: immediate wheel calibration and direction change');

  await action('turn_left');
  const left = await waitFor(trace => trace.left < 0 && trace.right > 0, 'counterclockwise rotation');
  closeTo(left.left, -0.4, 0.02);
  closeTo(left.right, 0.8, 0.02);
  await action('turn_right');
  const right = await waitFor(trace => trace.left > 0 && trace.right < 0, 'clockwise rotation');
  closeTo(right.left, 0.4, 0.02);
  closeTo(right.right, -0.8, 0.02);
  console.log('PASS: rotation signs and motion replacement');

  await action('stop');
  await waitSim(0.10);
  assert.ok(stopped(latest()), 'Stop command did not immediately clear the outputs');
  console.log('PASS: stop immediately clears both outputs');

  await action('forward');
  await waitFor(trace => trace.right > 0.2, 'motion before emergency stop');
  await action('emergency_stop');
  await waitFor(stopped, 'immediate stop output');
  console.log('PASS: immediate stop');

  await saveConfig({ left_scale: 1, right_scale: 1 });
  await control.request('/api/move_forward', { distance_cm: 20 });
  await waitFor(trace => trace.left > 0.1 && trace.right > 0.1, 'distance move through new chassis');
  await action('emergency_stop');
  await waitFor(stopped, 'distance move cancellation');
  const distance = await control.request('/api/distance');
  assert.equal(distance.motion_status, 'cancelled');
  console.log('PASS: distance move uses new chassis and stop cancels it');

  await saveConfig({ left_scale: 0, right_scale: 1, move_output: 50 });
  await action('forward', 500);
  await waitFor(trace => trace.right > 0.45, 'timed motion');
  closeTo(latest().left, 0, 0.01);
  closeTo(latest().right, 0.5, 0.02);
  await waitSim(0.60);
  assert.ok(stopped(latest()), 'Timed motion did not stop');
  console.log('PASS: zero left gain and timed stop');

  for (const invalid of [
    { left_scale: 1.01, right_scale: 1 },
    { left_scale: 'nan', right_scale: 1 },
    { left_scale: 0 },
    { left_scale: 0, right_scale: 1, move_output: 19 },
    { left_scale: 0, right_scale: 1, rotate_output: 101 },
  ]) await assert.rejects(control.request('/api/motion-config', invalid), /参数需为/);
  assert.deepEqual(await config(), { left_scale: 0, right_scale: 1,
    move_output: 50, rotate_output: 80 });
  await assert.rejects(control.request('/api/drive', { forward: 20, turn: 20 }), /未知控制指令/);
  await assert.rejects(control.request('/api/status'), /未知控制指令/);
  console.log('PASS: invalid values do not alter config; unused commands are absent');
}

async function restartZero() {
  assert.deepEqual(await config(), { left_scale: 0, right_scale: 1,
    move_output: 50, rotate_output: 80 });
  assert.ok(stopped(latest()), 'Motors started after NVS recovery');
  console.log('PASS: restart restored valid zero values and stopped motors');
  await saveConfig({ left_scale: 0.75, right_scale: 0.9,
    move_output: 100, rotate_output: 100 });
}

async function restartFinal() {
  const saved = await config();
  assert.deepEqual(Object.keys(saved).sort(), ['left_scale', 'move_output', 'right_scale', 'rotate_output']);
  closeTo(saved.left_scale, 0.75, 0.00001);
  closeTo(saved.right_scale, 0.9, 0.00001);
  assert.equal(saved.move_output, 100);
  assert.equal(saved.rotate_output, 100);
  assert.ok(stopped(latest()), 'Motors started after persisted config load');
  await action('forward', 2500);
  await waitSim(0.10);
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
  control.close();
  socket?.close();
}
