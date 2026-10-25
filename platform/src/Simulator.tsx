import { useEffect, useRef, useState } from "react";
import { firmwareProject } from "./firmware.ts";
import type { Module, Connection } from "./catalog.ts";

type Runtime = {
  state: string; log: string; active: boolean;
  artifacts: { firmware: boolean; emulator: boolean; web: boolean };
  project: { id: string; key: string; ready: boolean } | null;
};
const labels: Record<string, string> = {
  idle: "已停止", preparing: "正在准备环境与构建", starting: "模拟器进程已启动",
  stopping: "正在停止并保存 Flash", failed: "执行失败",
};

function ReferenceSimulator() {
  const [runtime, setRuntime] = useState<Runtime | null>(null);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [connected, setConnected] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    async function poll() {
      try {
        const response = await fetch("/api/runtime", { signal: controller.signal });
        if (!response.ok) throw Error(`运行时服务不可用 (${response.status})`);
        setRuntime(await response.json());
      } catch (e) {
        if (!controller.signal.aborted) setError(`无法读取本地运行时：${e}`);
      } finally {
        if (!controller.signal.aborted) timer = setTimeout(poll, 1000);
      }
    }
    void poll();
    return () => { controller.abort(); clearTimeout(timer); };
  }, []);
  const running = runtime?.active && runtime.state === "starting";
  useEffect(() => {
    setConnected(false);
    if (!running) return;
    let disposed = false;
    let socket: WebSocket;
    let timer: ReturnType<typeof setTimeout>;
    function connect() {
      socket = new WebSocket(`ws://${location.host}/runtime-ws`);
      socket.onmessage = (event) => {
        if (typeof event.data !== "string") return;
        try {
          if (["pao", "serial", "stat"].includes(JSON.parse(event.data).t)) setConnected(true);
        } catch { /* Binary/audio data is not a runtime health confirmation. */ }
      };
      socket.onclose = () => {
        setConnected(false);
        if (!disposed) timer = setTimeout(connect, 1000);
      };
      socket.onerror = () => socket.close();
    }
    connect();
    return () => { disposed = true; clearTimeout(timer); socket?.close(); };
  }, [running]);
  async function action(name: "prepare" | "start" | "stop") {
    setPending(true); setError("");
    try {
      const response = await fetch(`/api/runtime/${name}`, {
        method: "POST", headers: { "X-Pao-Studio": "1" },
      });
      const result = await response.json();
      if (!response.ok) throw Error(result.error);
      const status = await fetch("/api/runtime");
      if (!status.ok) throw Error(`状态读取失败 (${status.status})`);
      setRuntime(await status.json());
    } catch (e) { setError(String(e)); }
    finally { setPending(false); }
  }
  return (
    <section className="simulation-page">
      <div className="section-heading">
        <div><span className="eyebrow">SOFTWARE IN THE LOOP / 本地仿真实验室</span>
          <h1>构建固件，启动真实虚拟设备。</h1></div>
        <span className={`badge ${connected ? "live" : ""}`}>
          {connected ? "正在接收 esp32sim 数据" : labels[runtime?.state || ""] || "连接管理服务"}
        </span>
      </div>
      <div className="notice">
        当前运行 PAO 参考板：ESP32-S3、INMP441、SSD1306 128×64、MAX98357 与 MX1508。
        这是仓库固件的真实执行环境，不是当前自由组装画布的仿真；任意板型生成仍在规划中。
      </div>
      <div className="runtime-setup">
        <div>
          <h3>本地环境与构建</h3>
          <p>首次准备会下载 ESP-IDF 6.0.1 和工具链，构建固件、Rust 模拟器与外设界面。
            缓存全部保存在本工作目录 tmp/，不修改系统 SDK。需要 Git、Python 3.10+、Task、pnpm、Rust 和本机 C/C++ 构建工具。</p>
          <p>{runtime && Object.entries(runtime.artifacts).map(([name, ready]) =>
            `${name}：${ready ? "产物存在" : "待构建"}`).join(" / ")}</p>
          <div className="actions">
            <button disabled={pending || !runtime || runtime.active} onClick={() => void action("prepare")}>
              准备环境 / 重新构建
            </button>
            <button className="primary" disabled={pending || !runtime || runtime.active || !Object.values(runtime.artifacts).every(Boolean)}
              onClick={() => void action("start")}>启动仿真</button>
            <button disabled={pending || !runtime?.active || runtime.state === "stopping"}
              onClick={() => void action("stop")}>停止任务</button>
          </div>
        </div>
        <div><h3>可观察的运行过程</h3>
          <p>OLED、I²S 麦克风和扬声器、总线追踪、UART 与 3D 设备视图。
            只有收到模拟器协议消息后才显示连接成功；停止保留虚拟设备身份与 Flash。</p>
          {connected && <a href="http://127.0.0.1:8080/" target="_blank" rel="noreferrer">独立仿真窗口 ↗</a>}
        </div>
      </div>
      {error && <p role="alert" className="notice">{error}</p>}
      {connected ? <iframe title="esp32sim PAO 真实仿真" src="http://127.0.0.1:8080/"
        allow="microphone; autoplay" className="sim-frame" /> :
        <div className="runtime-empty"><span className="runtime-chip">ESP32-S3</span>
          <h2>{labels[runtime?.state || ""] || "等待本地运行时"}</h2>
          <p>首次点击准备环境，构建完成后启动仿真。失败原因显示在构建日志中。</p></div>}
      <details open><summary>构建 / 运行日志（最近 48 KB）</summary>
        <pre className="runtime-log">{runtime?.log || "尚无任务输出。"}</pre></details>
      <p className="caption">此运行环境仅限本机使用。模拟器不能替代功耗、电气、射频与实物验证。</p>
    </section>
  );
}

export function Simulator({ nodes, connections }: { nodes: Module[]; connections: Connection[] }) {
  const [reference, setReference] = useState(false);
  return <><div className="actions">
    <button aria-pressed={!reference} onClick={() => setReference(false)}>当前接线 / 生成固件</button>
    <button aria-pressed={reference} onClick={() => setReference(true)}>PAO 参考板 / 灵矽语音</button>
  </div>{reference ? <ReferenceSimulator /> : <ProjectSimulator nodes={nodes} connections={connections} />}</>;
}

function ProjectSimulator({ nodes, connections }: { nodes: Module[]; connections: Connection[] }) {
  const [runtime, setRuntime] = useState<Runtime | null>(null);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [connected, setConnected] = useState(false);
  const [serial, setSerial] = useState("");
  const [pins, setPins] = useState({ levels: 0n, pwm: new Map<number, number>(), transactions: 0 });
  const [audio, setAudio] = useState({ samples: 0, peak: 0, rate: 0 });
  const [frames, setFrames] = useState(0);
  const [listening, setListening] = useState(false);
  const socket = useRef<WebSocket | null>(null);
  const screen = useRef<HTMLCanvasElement>(null);
  const speaker = useRef<AudioContext | null>(null);
  const nextAudio = useRef(0);
  let generated: ReturnType<typeof firmwareProject> | undefined, invalid = "";
  try { generated = firmwareProject({ nodes, connections }); } catch (e) { invalid = String(e); }
  const key = generated ? JSON.stringify(generated.design) : "";
  const spec = generated?.spec;
  const matching = !!key && runtime?.project?.key === key;
  const running = matching && runtime?.active && runtime.state === "starting";
  useEffect(() => {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    async function poll() {
      try {
        const response = await fetch("/api/runtime", { signal: controller.signal });
        if (!response.ok) throw Error(`运行时服务不可用 (${response.status})`);
        setRuntime(await response.json());
      } catch (e) { if (!controller.signal.aborted) setError(String(e)); }
      finally { if (!controller.signal.aborted) timer = setTimeout(poll, 1000); }
    }
    void poll();
    return () => { controller.abort(); clearTimeout(timer); };
  }, []);
  useEffect(() => {
    setConnected(false); setSerial(""); setFrames(0);
    setAudio({ samples: 0, peak: 0, rate: 0 });
    setPins({ levels: 0n, pwm: new Map(), transactions: 0 });
    screen.current?.getContext("2d")?.clearRect(0, 0, 128, 32);
    if (!running) return;
    let disposed = false, timer: ReturnType<typeof setTimeout>, ws: WebSocket;
    function connect() {
      ws = new WebSocket(`ws://${location.host}/runtime-ws`);
      ws.binaryType = "arraybuffer"; socket.current = ws;
      ws.onmessage = ({ data }) => {
        if (data instanceof ArrayBuffer) {
          const view = new DataView(data);
          if (data.byteLength < 5) return;
          if (view.getUint8(0) === 1) {
            const w = view.getUint16(1, true), h = view.getUint16(3, true);
            if (w !== 128 || h !== 32 || data.byteLength !== 5 + w * h * 2) return;
            const ctx = screen.current?.getContext("2d");
            if (ctx) {
              const image = ctx.createImageData(w, h);
              for (let i = 0; i < w * h; i++) {
                const on = view.getUint16(5 + i * 2, true) !== 0;
                image.data.set(on ? [180, 240, 220, 255] : [5, 20, 16, 255], i * 4);
              }
              ctx.putImageData(image, 0, 0); setFrames((n) => n + 1);
            }
          } else if (view.getUint8(0) === 2 && (data.byteLength - 5) % 2 === 0) {
            const rate = view.getUint32(1, true), length = (data.byteLength - 5) / 2;
            if (rate < 8000 || rate > 96000 || length > 96000) return;
            let peak = 0;
            const samples = new Float32Array(length);
            for (let i = 0; i < length; i++) { const n = view.getInt16(5 + i * 2, true); samples[i] = n / 32768; peak = Math.max(peak, Math.abs(n)); }
            setAudio((a) => ({ samples: a.samples + length, peak, rate }));
            if (speaker.current?.state === "running" && length) {
              const context = speaker.current, buffer = context.createBuffer(1, length, rate);
              buffer.copyToChannel(samples, 0);
              const source = context.createBufferSource(); source.buffer = buffer; source.connect(context.destination);
              nextAudio.current = Math.max(context.currentTime + 0.02, nextAudio.current);
              if (nextAudio.current < context.currentTime + 1) { source.start(nextAudio.current); nextAudio.current += length / rate; }
            }
          }
          return;
        }
        try {
          const message = JSON.parse(data);
          if (message.t === "board" && message.name === "studio") setConnected(true);
          if (message.t === "serial" && message.src === "uart0") setSerial((s) => (s + message.data).slice(-48000));
          if (message.t === "pao") setPins({ levels: BigInt(`0x${message.levels}`), pwm: new Map(message.pwm), transactions: message.i2c[0] });
        } catch (e) { setError(`模拟器消息无效：${e}`); }
      };
      ws.onclose = () => { setConnected(false); if (!disposed) timer = setTimeout(connect, 1000); };
      ws.onerror = () => ws.close();
    }
    connect();
    return () => { disposed = true; clearTimeout(timer); ws?.close(); socket.current = null; void speaker.current?.close(); speaker.current = null; setListening(false); };
  }, [running, key]);
  async function action(name: "prepare" | "build" | "project" | "stop") {
    setPending(true); setError("");
    try {
      const response = await fetch(`/api/runtime/${name}`, { method: "POST",
        headers: { "X-Pao-Studio": "1", "Content-Type": "application/json" },
        body: ["build", "project"].includes(name) ? JSON.stringify({ nodes, connections }) : undefined });
      const result = await response.json();
      if (!response.ok) throw Error(result.error);
      const status = await fetch("/api/runtime");
      if (!status.ok) throw Error(`运行时服务不可用 (${status.status})`);
      setRuntime(await status.json());
    } catch (e) { setError(String(e)); }
    finally { setPending(false); }
  }
  function command(line: string) {
    if (socket.current?.readyState === WebSocket.OPEN) socket.current.send(JSON.stringify({ t: "serial", src: "uart0", line }));
  }
  const duty = (pin: number) => (pins.pwm.get(pin) ?? (pins.levels & (1n << BigInt(pin)) ? 1000 : 0)) / 10;
  const enabled = spec?.motor && !!(pins.levels & (1n << BigInt(spec.motor.enable)));
  const readyAt = serial.lastIndexOf("STUDIO READY");
  const ready = connected && readyAt > serial.lastIndexOf("STUDIO BOOT") &&
    !/stack overflow|Guru Meditation|Rebooting/.test(serial.slice(readyAt));
  return <section className="simulation-page">
    <div className="section-heading"><div><span className="eyebrow">WIRING → ESP-IDF → ESP32SIM</span>
      <h1>让当前接线真正运行。</h1></div><span className="badge">{ready ? "当前固件已就绪 / 正在仿真" : connected ? "模拟器已连接 / 等待固件就绪" : labels[runtime?.state || ""] || "连接管理服务"}</span></div>
    <div className="notice">从当前接线生成 ESP-IDF 6.0.1 模块诊断固件与虚拟板型，共用 GPIO、复位、声道和负载映射。
      生成程序提供显示测试、音频输入/输出和电机控制；业务应用和灵矽语音使用单独的 PAO 参考板入口。</div>
    {invalid && <p role="alert">{invalid}</p>}
    {runtime?.project && !matching && <p role="alert">接线已变化，现有固件不匹配。请停止旧任务并重新生成编译。</p>}
    <div className="runtime-setup"><div><h3>生成、编译与运行</h3>
      <p>首次准备下载本地 SDK 并构建模拟器。当前设计与构建缓存分别保存在 tmp/studio/，不同接线隔离 Flash。</p>
      <p>构建：{matching && runtime?.project?.ready ? `成功 · ${runtime.project.id.slice(0, 12)}` : "当前接线待编译"}</p>
      <div className="actions">
        <button disabled={pending || !runtime || runtime.active} onClick={() => void action("prepare")}>准备本地环境</button>
        <button disabled={pending || !runtime || runtime.active || !!invalid} onClick={() => void action("build")}>生成并编译当前接线</button>
        <button className="primary" disabled={pending || !!runtime?.active || !matching || !runtime?.project?.ready} onClick={() => void action("project")}>启动当前接线仿真</button>
        <button disabled={pending || !runtime?.active || runtime.state === "stopping"} onClick={() => void action("stop")}>停止任务</button>
      </div></div><div><h3>当前板型</h3><p>{nodes.length} 个模块 · {connections.length} 根接线</p>
        <details><summary>GPIO / 声道 / 负载配置</summary><pre className="runtime-log">{spec ? JSON.stringify(spec, null, 2) : "请修正接线"}</pre></details></div></div>
    {error && <p role="alert" className="notice">{error}</p>}
    <div className="runtime-setup"><div><h3>实际外设输出</h3>
      {spec?.oled && <><canvas ref={screen} width={128} height={32} aria-label="当前接线 OLED 128×32 实际显存" style={{ width: "100%", maxWidth: 512, imageRendering: "pixelated", background: "#051410" }} />
        <p>OLED 帧 {frames} · I²C 事务 {pins.transactions}</p><button disabled={!connected} onClick={() => command("display")}>切换 OLED 图案</button></>}
      {spec?.mic && <p>SPH0645 输入：启动注入两秒 1kHz 测试 PCM；记录中的最大采样峰值 {Math.max(0, ...Array.from(serial.matchAll(/rx_peak=(\d+)/g), (m) => Number(m[1])))}。按实际 GPIO 与 SEL 声道接收。</p>}
      {spec?.amp && <><p>I²S 输出：{audio.rate} Hz · {audio.samples} 样本 · 当前峰值 {audio.peak}</p>
        <div className="actions"><button disabled={!connected} onClick={() => command("tone")}>播放 440Hz 测试音</button><button disabled={!connected} onClick={() => command("mute")}>静音</button>
          <button disabled={!connected || listening} onClick={async () => { speaker.current = new AudioContext(); await speaker.current.resume(); setListening(true); }}>启用浏览器扬声器</button></div></>}
      {spec?.motor && <><p>DRV8833 SLP：{enabled ? "高 / 已使能" : "低 / 休眠"}</p>
        {spec.motor.loads.map((load, i) => <p key={load.id}>电机 #{load.id} / {i ? "B" : "A"}：桥臂占空比 {enabled ? Math.round((duty(spec.motor!.pins[i * 2]) - duty(spec.motor!.pins[i * 2 + 1])) * load.polarity) : 0}%（非实测转速）</p>)}
        <div className="actions"><button disabled={!connected} onClick={() => command("motor 30 30")}>双路正转 30% / 1秒</button><button disabled={!connected} onClick={() => command("motor -30 -30")}>双路反转 30% / 1秒</button><button disabled={!connected} onClick={() => command("stop")}>停止电机</button></div></>}
      <button disabled={!connected} onClick={() => command("status")}>读取固件状态</button>
    </div><div><h3>UART / 真实固件输出</h3><pre className="runtime-log" aria-label="当前固件 UART">{serial.split("\n").filter((s) => /STUDIO|ERROR|abort|Rebooting|Guru Meditation/.test(s)).slice(-16).join("\n") || "等待当前 ELF 启动"}</pre>
      <details><summary>完整 UART / 最近 48 KB</summary><pre className="runtime-log">{serial}</pre></details></div></div>
    <details><summary>构建 / 运行日志</summary><pre className="runtime-log">{runtime?.log || "尚无任务输出"}</pre></details>
    <p className="caption">仿真覆盖数字接口与诊断行为；电源预算来自静态规则，声学、温升和机械负载仍需实物验证。</p>
  </section>;
}
