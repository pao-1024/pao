import assert from "node:assert/strict";
import { decodeSsd1306, FULL_CHARGE_S, motion, stepLauncher, wheels } from "./protocol.ts";

assert.equal(decodeSsd1306([0x00, 0xae, 0x20, 0x00, 0x21, 0, 127, 0xb3], 8),
  "AE 显示关 · 20 寻址模式 00 · 21 列地址 0–127 · B3 页 3");
assert.equal(decodeSsd1306([0x80, 0xa1, 0x00, 0xc8], 4), "A1 段重映射 开 · C8 COM 反向扫描");
assert.equal(decodeSsd1306([0x40, ...new Array(31).fill(0xff)], 129), "显存写入 128 字节");
assert.equal(decodeSsd1306([0xc0, 0x55, 0x00, 0xaf], 4), "AF 显示开 · 显存写入 1 字节");
assert.equal(decodeSsd1306([0x00, 0x8d], 40), "… 另有 38 字节");

const low = () => false;
assert.deepEqual(wheels(new Map([[11, 300], [14, 300]]), low), { right: 0.3, left: 0.3 });
assert.deepEqual(wheels(new Map([[12, 500], [14, 500]]), low), { right: -0.5, left: 0.5 });
assert.equal(motion(0.3, 0.3), "前进");
assert.equal(motion(0.5, -0.5), "原地右转");
assert.equal(motion(-0.2, -0.6), "后退并右转");
assert.equal(motion(0, 0), "停止");
let launcher = { energy: 0, shots: 0, lastShot: null as number | null };
launcher = stepLauncher(launcher, FULL_CHARGE_S / 2, false);
assert.equal(launcher.energy, 0.5);
launcher = stepLauncher(launcher, FULL_CHARGE_S, false);
assert.equal(launcher.energy, 1, "energy saturates when full");
launcher = stepLauncher(launcher, 0.05, true);
assert.deepEqual(launcher, { energy: 0, shots: 1, lastShot: 1 });
assert.equal(stepLauncher(launcher, FULL_CHARGE_S / 10, true).lastShot, 0.1, "a quick follow-up shot is weak");
console.log("PASS: SSD1306 decoding, chassis motion and launcher charge");
