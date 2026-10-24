import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { createRoot } from "react-dom/client";
import { decodeSsd1306, hex2, MODULES, motion, PIN_LABEL, RELAY_PINS, stateLabel, stepLauncher, wheels } from "./protocol.ts";
import type { Bus, Launcher, Module, Wire } from "./protocol.ts";
import { Car3D } from "./car3d.tsx";
import "./style.css";

type Microphone = {
  stream: MediaStream;
  context: AudioContext;
  source: MediaStreamAudioSourceNode;
  node: AudioWorkletNode;
};
type Pins = { levels: bigint; known: bigint; input: bigint; pwm: Map<number, number>; i2c: [number, number] };
type Row = { id: number; time: number; bus: Bus; pins: string; text: string; raw?: string };
type TraceEvent =
  | { k: "gpio"; pin: number; v: number }
  | { k: "pwm"; pin: number; duty: number }
  | { k: "i2c"; addr: number; read: boolean; len: number; data: string };
type Stream = { samples: number; peak: number; rate: number };
type Command = { forward: number; turn: number; duration: number } | null;

const BUSES: [Bus, string][] = [["i2c", "I2C"], ["pwm", "PWM"], ["gpio", "GPIO"], ["i2s", "I2S"]];
const ROWS = 400, LOG_LINES = 800, ACTIVE_MS = 450;
const bit = (mask: bigint, pin: number) => (mask >> BigInt(pin) & 1n) === 1n;
const percent = (value: number) => `${Math.round(value * 100)}%`;
const dbfs = (peak: number) => peak > 0 ? `${Math.max(-90, 20 * Math.log10(peak)).toFixed(0)} dBFS` : "静音";

function App() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const speakerScope = useRef<HTMLCanvasElement>(null);
  const microphoneScope = useRef<HTMLCanvasElement>(null);
  const logView = useRef<HTMLDivElement>(null);
  const socket = useRef<WebSocket | null>(null);
  const microphone = useRef<Microphone | null>(null);
  const speaker = useRef<AudioContext | null>(null);
  const playHead = useRef(0);
  const active = useRef(new Map<number, number>());
  const nextRow = useRef(0);
  const simTime = useRef(0);
  const partialLine = useRef("");
  const streams = useRef({ speaker: { samples: 0, peak: 0, rate: 0 }, microphone: { samples: 0, peak: 0, rate: 16000 } });
  const paused = useRef(false);
  const [connected, setConnected] = useState(false);
  const [stat, setStat] = useState({ time: 0, speed: null as number | null, insns: 0 });
  const [hint, setHint] = useState("授权麦克风后说“你好小智”。建议使用耳机。");
  const [recording, setRecording] = useState(false);
  const [busy, setBusy] = useState(false);
  const [led, setLed] = useState("rgb(0,0,0)");
  const [pins, setPins] = useState<Pins>({ levels: 0n, known: 0n, input: 1n, pwm: new Map(), i2c: [0, 0] });
  const [rows, setRows] = useState<Row[]>([]);
  const [shown, setShown] = useState(new Set<Bus>(["i2c", "pwm", "gpio", "i2s"]));
  const [pause, setPause] = useState(false);
  const [logLines, setLogLines] = useState<string[]>([]);
  const [logFilter, setLogFilter] = useState("");
  const [device, setDevice] = useState("未知");
  const [command, setCommand] = useState<Command>(null);
  const [launcherCommand, setLauncherCommand] = useState<string | null>(null);
  const [launcher, setLauncher] = useState<Launcher>({ energy: 0, shots: 0, lastShot: null });
  const charge = useRef({ time: 0, charging: false });
  const [uartBytes, setUartBytes] = useState(0);
  const [audio, setAudio] = useState({ speaker: { rate: 0, peak: 0 }, microphone: { rate: 0, peak: 0 } });
  const [now, setNow] = useState(performance.now());

  const touch = (...list: number[]) => { const t = performance.now(); for (const pin of list) active.current.set(pin, t); };
  function addRows(list: Omit<Row, "id" | "time">[]) {
    if (!list.length || paused.current) return;
    const time = simTime.current;
    const added = list.map(row => ({ ...row, id: nextRow.current++, time }));
    setRows(previous => [...added.reverse(), ...previous].slice(0, ROWS));
  }

  async function stopMicrophone() {
    const current = microphone.current;
    microphone.current = null;
    if (current) {
      current.stream.getTracks().forEach(track => track.stop());
      current.source.disconnect(); current.node.disconnect();
      await current.context.close();
    }
    setRecording(false);
  }

  function binary(buffer: ArrayBuffer) {
    const data = new DataView(buffer);
    if (data.getUint8(0) === 1 && canvas.current) {
      const width = data.getUint16(1, true), height = data.getUint16(3, true);
      canvas.current.width = width; canvas.current.height = height;
      const pixels = canvas.current.getContext("2d")!;
      const frame = pixels.createImageData(width, height);
      for (let i = 0; i < width * height; i++) {
        const color = data.getUint16(5 + i * 2, true), at = i * 4;
        frame.data[at] = (color >> 11) * 255 / 31;
        frame.data[at + 1] = ((color >> 5) & 63) * 255 / 63;
        frame.data[at + 2] = (color & 31) * 255 / 31;
        frame.data[at + 3] = 255;
      }
      pixels.putImageData(frame, 0, 0);
    } else if (data.getUint8(0) === 2) {
      const rate = data.getUint32(1, true), count = (buffer.byteLength - 5) / 2;
      const samples = new Float32Array(count);
      for (let i = 0; i < count; i++) samples[i] = data.getInt16(5 + i * 2, true) / 32768;
      record(streams.current.speaker, samples, rate, speakerScope.current, "--i2s");
      touch(7, 15, 16);
      const context = speaker.current;
      if (!context) return;
      const audio = context.createBuffer(1, count, rate);
      audio.getChannelData(0).set(samples);
      const source = context.createBufferSource();
      source.buffer = audio; source.connect(context.destination);
      playHead.current = Math.max(playHead.current, context.currentTime + 0.06);
      source.start(playHead.current); playHead.current += audio.duration;
    }
  }

  function serial(text: string) {
    touch(43);
    setUartBytes(n => n + text.length);
    const lines = (partialLine.current + text.replace(/\x1b\[[0-9;]*m/g, "").replace(/\r/g, "")).split("\n");
    partialLine.current = lines.pop() ?? "";
    for (const line of lines) {
      const state = line.match(/State: (\S+) -> (\S+)/);
      if (state) setDevice(state[2]);
      const drive = line.match(/Chassis drive: forward=(-?\d+) turn=(-?\d+) duration_ms=(\d+)/);
      if (drive) setCommand({ forward: +drive[1], turn: +drive[2], duration: +drive[3] });
      if (line.includes("Chassis stopped")) setCommand(null);
      const launch = line.match(/Launcher charge: duration_ms=(\d+) fire_after=(\d)/);
      if (launch) setLauncherCommand(+launch[1] ? `充能 ${launch[1]} ms${+launch[2] ? " 后发射" : ""}` : "stop");
      if (line.includes("Launcher charge stopped")) setLauncherCommand("充能到时，自动断电");
      if (line.includes("Launcher fired")) setLauncherCommand("fire");
      if (line.includes("Launcher fire rejected")) setLauncherCommand("fire 被拒绝：充能中");
    }
    if (lines.length) setLogLines(previous => [...previous, ...lines].slice(-LOG_LINES));
  }

  function trace(message: { time: number; levels: string; known: string; pwm: [number, number][]; i2c: [number, number]; dropped: number; events: TraceEvent[] }) {
    simTime.current = message.time;
    // CH1 as it stood during this interval charges first; a CH2 pull-in reported in the same batch fires after.
    const fired = message.events.some(event => event.k === "gpio" && event.pin === 18 && !event.v);
    const dt = Math.max(0, message.time - charge.current.time);
    setLauncher(state => stepLauncher(state, dt, charge.current.charging, fired));
    const levels = BigInt(`0x${message.levels}`), known17 = (BigInt(`0x${message.known}`) >> 17n & 1n) === 1n;
    charge.current = { time: message.time, charging: known17 && (levels >> 17n & 1n) === 0n };
    setPins(previous => ({
      ...previous, levels: BigInt(`0x${message.levels}`), known: BigInt(`0x${message.known}`),
      pwm: new Map(message.pwm), i2c: message.i2c,
    }));
    const list: Omit<Row, "id" | "time">[] = [];
    for (const event of message.events) {
      if (event.k === "i2c") {
        const bytes = event.data.match(/../g)?.map(byte => parseInt(byte, 16)) ?? [];
        touch(41, 42);
        list.push({ bus: "i2c", pins: `SDA41 SCL42 · 0x${hex2(event.addr)} ${event.read ? "读" : "写"}`,
          text: event.addr === 0x3c && !event.read ? decodeSsd1306(bytes, event.len) : `${event.len} 字节`,
          raw: bytes.map(hex2).join(" ") + (event.len > bytes.length ? " …" : "") });
      } else if (event.k === "pwm") {
        touch(event.pin);
        list.push({ bus: "pwm", pins: `GPIO${event.pin} ${PIN_LABEL.get(event.pin) ?? ""}`,
          text: event.duty < 0 ? "释放 MCPWM，改为普通 GPIO" : `MCPWM 1 kHz · 占空比 ${(event.duty / 10).toFixed(1)}%` });
      } else {
        touch(event.pin);
        const relay = RELAY_PINS.has(event.pin) ? (event.v ? " · 断开" : " · 吸合") : "";
        list.push({ bus: "gpio", pins: `GPIO${event.pin} ${PIN_LABEL.get(event.pin) ?? ""}`, text: `${event.v ? "高电平 H" : "低电平 L"}${relay}` });
      }
    }
    if (message.dropped) list.push({ bus: "i2c", pins: "—", text: `本周期另有 ${message.dropped} 个事件未列出` });
    addRows(list);
  }

  useEffect(() => {
    let disposed = false, retry: ReturnType<typeof setTimeout>;
    function stopAudio() {
      void stopMicrophone(); void speaker.current?.close(); speaker.current = null;
    }
    function connect() {
      const connection = new WebSocket(`ws://${location.host}/ws`);
      connection.binaryType = "arraybuffer"; socket.current = connection;
      connection.onopen = () => setConnected(true);
      connection.onmessage = event => {
        if (event.data instanceof ArrayBuffer) { binary(event.data); return; }
        const message = JSON.parse(event.data);
        if (message.t === "serial" && message.src === "uart0") serial(message.data);
        else if (message.t === "pao") trace(message);
        else if (message.t === "ring") { setLed(`rgb(${message.leds[0].join(",")})`); }
        else if (message.t === "stat") {
          setStat({ time: message.time, speed: message.speed, insns: message.insns });
          const input = BigInt(`0x${message.gpio_in}`);
          setPins(previous => previous.input === input ? previous : { ...previous, input });
        } else if (message.t === "microphone-error") {
          void stopMicrophone(); setHint(message.message);
        }
      };
      connection.onclose = () => {
        if (disposed) return;
        void stopMicrophone(); setConnected(false);
        retry = setTimeout(connect, 1000);
      };
    }
    connect();
    window.addEventListener("pagehide", stopAudio);
    // Audio arrives in small chunks; summarise both I2S streams twice a second.
    const summary = setInterval(() => {
      const { speaker: out, microphone: input } = streams.current;
      const list: Omit<Row, "id" | "time">[] = [];
      for (const [stream, pinsText, name] of [[out, "DIN7 BCLK15 LRC16", "→ 功放"], [input, "WS4 SCK5 SD6", "← 麦克风"]] as const) {
        if (!stream.samples) continue;
        list.push({ bus: "i2s", pins: pinsText, text: `${name} ${stream.rate} Hz · ${stream.samples} 个采样 · 峰值 ${dbfs(stream.peak)}` });
      }
      setAudio({ speaker: { rate: out.samples ? out.rate : 0, peak: out.peak }, microphone: { rate: input.samples ? input.rate : 0, peak: input.peak } });
      out.samples = out.peak = input.samples = input.peak = 0;
      addRows(list);
    }, 500);
    const ticker = setInterval(() => setNow(performance.now()), 150);
    return () => {
      disposed = true; clearTimeout(retry); socket.current?.close(); clearInterval(summary); clearInterval(ticker);
      window.removeEventListener("pagehide", stopAudio); stopAudio();
    };
  }, []);

  useEffect(() => {
    const view = logView.current;
    if (view && !logFilter) view.scrollTop = view.scrollHeight;
  }, [logLines, logFilter]);

  async function toggleMicrophone() {
    if (microphone.current) {
      await stopMicrophone(); setHint("麦克风已关闭"); return;
    }
    const connection = socket.current;
    setBusy(true);
    let stream: MediaStream | undefined, context: AudioContext | undefined;
    try {
      if (!connection || connection.readyState !== WebSocket.OPEN) throw Error("模拟器未连接");
      speaker.current ??= new AudioContext();
      await speaker.current.resume();
      stream = await navigator.mediaDevices.getUserMedia({audio: {channelCount: 1, echoCancellation: true}});
      context = new AudioContext({sampleRate: 16000});
      if (context.sampleRate !== 16000) throw Error("浏览器未提供 16 kHz 采样率");
      await context.audioWorklet.addModule(new URL("./pao-microphone.js", import.meta.url));
      const source = context.createMediaStreamSource(stream);
      const node = new AudioWorkletNode(context, "pao-microphone");
      node.port.onmessage = event => {
        if (connection.readyState !== WebSocket.OPEN) return;
        connection.send(event.data);
        // [5][port][PCM16] at the 1/16 slot gain of pao-microphone.js.
        const data = new DataView(event.data as ArrayBuffer), samples = new Float32Array((data.byteLength - 2) / 2);
        for (let i = 0; i < samples.length; i++) samples[i] = data.getInt16(2 + i * 2, true) / 2048;
        record(streams.current.microphone, samples, 16000, microphoneScope.current, "--i2s-in");
        touch(4, 5, 6);
      };
      source.connect(node); node.connect(context.destination); await context.resume();
      if (connection !== socket.current || connection.readyState !== WebSocket.OPEN) {
        throw Error("模拟器连接已断开");
      }
      microphone.current = {stream, context, source, node};
      setRecording(true); setHint("正在收音，说“你好小智”");
    } catch (error) {
      stream?.getTracks().forEach(track => track.stop());
      if (context) await context.close();
      setHint(error instanceof Error ? error.message : String(error));
    } finally { setBusy(false); }
  }

  function pressBoot() {
    const connection = socket.current;
    if (connection?.readyState !== WebSocket.OPEN) return;
    connection.send(JSON.stringify({t: "btn", pin: 0, v: 1}));
    touch(0);
    addRows([{ bus: "gpio", pins: "GPIO0 BOOT 按键", text: "网页按下 100 ms → 低电平 L" }]);
    setTimeout(() => {
      if (connection.readyState === WebSocket.OPEN) connection.send(JSON.stringify({t: "btn", pin: 0, v: 0}));
    }, 100);
  }

  const high = (pin: number) => bit(pins.levels, pin);
  const known = (pin: number) => bit(pins.known, pin);
  const { left, right } = wheels(pins.pwm, high);
  const charging = known(17) && !high(17), firing = known(18) && !high(18);
  const isActive = (pin: number) => now - (active.current.get(pin) ?? -1e9) < ACTIVE_MS;

  function value(wire: Wire): string {
    const { pin, bus } = wire;
    if (bus === "pwm") return pins.pwm.has(pin) ? `${(pins.pwm.get(pin)! / 10).toFixed(0)}%` : known(pin) ? (high(pin) ? "H" : "L") : "—";
    if (bus === "i2c") return pin === 41 ? `${pins.i2c[0]} 次` : `${(pins.i2c[1] / 1024).toFixed(1)} KB`;
    if (bus === "i2s") {
      const rate = pin >= 7 ? audio.speaker.rate : audio.microphone.rate;
      return rate ? `${rate / 1000} kHz` : "空闲";
    }
    if (bus === "uart") return `${(uartBytes / 1024).toFixed(1)} KB`;
    if (pin === 0) return bit(pins.input, 0) ? "H 松开" : "L 按下";
    if (!known(pin)) return "—";
    return RELAY_PINS.has(pin) ? (high(pin) ? "H 断开" : "L 吸合") : high(pin) ? "H" : "L";
  }

  const visible = rows.filter(row => shown.has(row.bus));
  const filteredLog = logFilter ? logLines.filter(line => line.toLowerCase().includes(logFilter.toLowerCase())) : logLines;

  return <>
    <header className="top">
      <div className="brand">
        <h1>PAO 模拟器</h1>
        <span className="sub">ESP32-S3 · 正式固件 · 引脚级仿真</span>
      </div>
      <div className="chips" role="status">
        <span className={`chip ${connected ? "ok" : "bad"}`}>{connected ? "已连接" : "未连接"}</span>
        <span className="chip">设备 <b>{device === "未知" ? device : stateLabel(device)}</b></span>
        <span className="chip">仿真 <b>{stat.time.toFixed(2)} s</b></span>
        <span className="chip">速度 <b>{stat.speed == null ? "—" : `${stat.speed.toFixed(2)}×`}</b></span>
        <span className="chip">指令 <b>{(stat.insns / 1e6).toFixed(0)} M</b></span>
      </div>
      <div className="actions">
        <button className={recording ? "primary on" : "primary"} disabled={!connected || busy} onClick={() => void toggleMicrophone()}>
          {recording ? "关闭麦克风" : "启用麦克风和扬声器"}
        </button>
        <button disabled={!connected} onClick={pressBoot}>BOOT</button>
        {/* 固件内置遥控页，由 run-esp32sim.py 的 --hostfwd 转发到本机 8081。 */}
        <a className="button" href="http://127.0.0.1:8081/" target="_blank" rel="noreferrer">遥控</a>
      </div>
    </header>
    <p className="hint" role="status">{hint}</p>

    <main className="grid">
      <section className="panel device">
        <h2>设备</h2>
        <div className="screen">
          <canvas ref={canvas} width={128} height={64} aria-label="OLED 显示屏" />
          <div className="screen-meta">
            <span>SSD1306 128×64</span>
            <span className="led-row"><span className={`led ${led === "rgb(0,0,0)" ? "" : "lit"}`} style={{ "--led": led } as CSSProperties} aria-label={led === "rgb(0,0,0)" ? "状态灯 灭" : "状态灯 亮"} /> GPIO48</span>
          </div>
        </div>
        <Car3D left={left} right={right} charging={charging} firing={firing} energy={launcher.energy} shots={launcher.shots} />
        <dl className="facts">
          <dt>底盘</dt><dd>{motion(left, right)} · 左 {percent(left)} · 右 {percent(right)}</dd>
          <dt>固件指令</dt><dd>{command ? `drive forward=${command.forward} turn=${command.turn} · ${command.duration} ms` : "无进行中的运动"}</dd>
          <dt>发射器</dt><dd>{firing ? "发射中（CH2 吸合）" : charging ? "充能中（CH1 吸合）" : known(17) ? "断电" : "未初始化"} · 电量 {percent(launcher.energy)}</dd>
          <dt>发射记录</dt><dd>{launcher.shots ? `共 ${launcher.shots} 发 · 上一发能量 ${percent(launcher.lastShot ?? 0)}${launcher.lastShot ? "" : "（空发）"}` : "尚未发射"}</dd>
          <dt>发射器指令</dt><dd>{launcherCommand ?? "无"}</dd>
        </dl>
      </section>

      <section className="panel wiring">
        <h2>接线与信号 <span className="legend">{BUSES.concat([["uart", "UART"]]).map(([bus, name]) => <span key={bus} className={`key bus-${bus}`}>{name}</span>)}</span></h2>
        <Wiring value={value} isActive={isActive} />
      </section>

      <section className="panel events">
        <h2>
          总线通信
          <span className="tools">
            {BUSES.map(([bus, name]) => <label key={bus} className={`toggle bus-${bus}`}>
              <input type="checkbox" checked={shown.has(bus)} onChange={() => setShown(previous => {
                const next = new Set(previous); if (next.has(bus)) next.delete(bus); else next.add(bus); return next;
              })} />{name}
            </label>)}
            <button className="small" onClick={() => { paused.current = !pause; setPause(!pause); }}>{pause ? "继续" : "暂停"}</button>
            <button className="small" onClick={() => setRows([])}>清空</button>
          </span>
        </h2>
        <div className="table" role="log" aria-label="总线事件">
          <div className="thead"><span>时间</span><span>总线</span><span>引脚 / 地址</span><span>内容</span></div>
          {visible.length === 0 && <p className="empty">等待通信…</p>}
          {visible.map(row => <div className="tr" key={row.id}>
            <span className="time">{row.time.toFixed(3)}</span>
            <span className={`tag bus-${row.bus}`}>{row.bus.toUpperCase()}</span>
            <span className="pins">{row.pins}</span>
            <span className="text">{row.text}{row.raw && <code>{row.raw}</code>}</span>
          </div>)}
        </div>
      </section>

      <section className="panel audio">
        <h2>I2S 音频</h2>
        <figure>
          <figcaption><span>I2S0 → 功放</span><span>{audio.speaker.rate ? `${audio.speaker.rate} Hz · ${dbfs(audio.speaker.peak)}` : "空闲"}</span></figcaption>
          <canvas ref={speakerScope} width={600} height={110} aria-label="扬声器波形" />
        </figure>
        <figure>
          <figcaption><span>麦克风 → I2S1</span><span>{audio.microphone.rate ? `${audio.microphone.rate} Hz · ${dbfs(audio.microphone.peak)}` : recording ? "等待采样" : "麦克风未启用"}</span></figcaption>
          <canvas ref={microphoneScope} width={600} height={110} aria-label="麦克风波形" />
        </figure>
      </section>

      <section className="panel log">
        <h2>
          UART0 串口日志 <span className="muted">GPIO43 TX · {logLines.length} 行</span>
          <span className="tools">
            <input type="search" placeholder="过滤日志" value={logFilter} onChange={event => setLogFilter(event.target.value)} aria-label="过滤日志" />
          </span>
        </h2>
        <div className="console" ref={logView} aria-label="UART0 串口日志">
          {filteredLog.map((line, i) => <div key={i} className={`line level-${line[0]}`}>{line}</div>)}
        </div>
      </section>
    </main>
  </>;
}

/** Keep the stream statistics and redraw its oscilloscope with the newest chunk. */
function record(stream: Stream, samples: Float32Array, rate: number, scope: HTMLCanvasElement | null, color: string) {
  stream.samples += samples.length; stream.rate = rate;
  for (const sample of samples) stream.peak = Math.max(stream.peak, Math.abs(sample));
  if (!scope) return;
  const context = scope.getContext("2d")!, { width, height } = scope;
  context.clearRect(0, 0, width, height);
  context.strokeStyle = getComputedStyle(scope).getPropertyValue("--grid");
  context.beginPath(); context.moveTo(0, height / 2); context.lineTo(width, height / 2); context.stroke();
  context.strokeStyle = getComputedStyle(scope).getPropertyValue(color);
  context.lineWidth = 1.5;
  context.beginPath();
  const step = samples.length / width;
  for (let x = 0; x < width; x++) {
    const y = height / 2 - samples[Math.floor(x * step)] * (height / 2 - 4);
    if (x) context.lineTo(x, y); else context.moveTo(x, y);
  }
  context.stroke();
}

function Wiring({ value, isActive }: { value: (wire: Wire) => string; isActive: (pin: number) => boolean }) {
  const row = 26, gap = 16, top = 34, chip = { x: 330, width: 240 };
  const layout = (side: Module["side"]) => {
    let y = top;
    return MODULES.filter(m => m.side === side).map(module => {
      const y0 = y; y += module.wires.length * row + gap;
      return { module, y0 };
    });
  };
  const sides = { left: layout("left"), right: layout("right") };
  const bottom = Math.max(...[...sides.left, ...sides.right].map(({ module, y0 }) => y0 + module.wires.length * row)) + 14;
  return <svg viewBox={`0 0 900 ${bottom + 10}`} className="wiring-svg" role="img" aria-label="ESP32-S3 与外设的接线和实时信号">
    <rect x={chip.x} y={12} width={chip.width} height={bottom - 12} rx={10} className="chip-body" />
    <text x={chip.x + chip.width / 2} y={bottom / 2} className="chip-name">ESP32-S3</text>
    <text x={chip.x + chip.width / 2} y={bottom / 2 + 18} className="chip-sub">16 MB Flash · 8 MB PSRAM</text>
    {(["left", "right"] as const).flatMap(side => sides[side].map(({ module, y0 }) => {
      const boxX = side === "left" ? 8 : 732, boxW = 160, height = module.wires.length * row;
      const busy = module.wires.some(w => isActive(w.pin));
      return <g key={module.id}>
        <rect x={boxX} y={y0 - 4} width={boxW} height={height + 4} rx={7} className={`module ${busy ? "busy" : ""}`} />
        {/* Leave the box edge facing the chip to the signal names. */}
        <text x={side === "left" ? boxX + 10 : boxX + boxW - 10} y={y0 + 13} className={`module-name ${side}`}>{module.name}</text>
        <text x={side === "left" ? boxX + 10 : boxX + boxW - 10} y={y0 + 27} className={`module-part ${side}`}>{module.part}</text>
        {module.wires.map((w, i) => {
          const y = y0 + i * row + row / 2;
          const moduleEdge = side === "left" ? boxX + boxW : boxX, chipEdge = side === "left" ? chip.x : chip.x + chip.width;
          const on = isActive(w.pin);
          const mid = (moduleEdge + chipEdge) / 2;
          return <g key={w.pin} className={`wire-group bus-${w.bus} ${on ? "on" : ""}`}>
            <line x1={chipEdge} y1={y} x2={moduleEdge} y2={y} className={`wire ${w.dir}`} />
            <circle cx={chipEdge} cy={y} r={3} className="pad" />
            <circle cx={moduleEdge} cy={y} r={3} className="pad" />
            <text x={side === "left" ? moduleEdge - 6 : moduleEdge + 6} y={y + 4} className={`signal ${side}`}>{w.signal}</text>
            <text x={side === "left" ? chipEdge + 8 : chipEdge - 8} y={y + 4} className={`gpio ${side}`}>GPIO{w.pin}</text>
            <text x={mid} y={y - 5} className="value">{value(w)}</text>
          </g>;
        })}
      </g>;
    }))}
  </svg>;
}

createRoot(document.getElementById("root")!).render(<App />);
