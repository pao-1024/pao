import { useEffect, useRef, useState } from "react";
import { firmwareProject } from "./firmware.ts";
import type { Application } from "./firmware.ts";
import type { Module, Connection } from "./catalog.ts";
import type { AgentApplication } from "./agent-spec.ts";
import type { HardwareResult } from "./hardware-plan.ts";
import { partFor, moduleImage } from "./catalog.ts";

type Runtime = {
  state: string; log: string; active: boolean;
  artifacts: { firmware: boolean; emulator: boolean; web: boolean };
  project: { id: string; key: string; ready: boolean } | null;
  agent?: { phase: string; attempt: number; log: string; designKey: string; id: string; originKey?: string; hardware?: HardwareResult; error?: string; application?: AgentApplication };
  agentModel?: string; agentProvider?: string;
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
  const running = runtime?.active && runtime.state === "starting" && !runtime.project;
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
      {runtime?.active && runtime.project && <p role="status">当前正在运行自由组合应用，请停止任务后再启动 PAO 参考板。</p>}
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

type ProjectProps = { nodes: Module[]; connections: Connection[]; application: Application; onApplication: (app: Application) => void; onSharedI2s: (shared: boolean) => void; workspaceKey: string; appliedDesignId: string; onDesign: (hardware: HardwareResult, app: AgentApplication, id: string) => void };
export function Simulator(props: ProjectProps) {
  const [reference, setReference] = useState(false);
  return <><div className="actions">
    <button aria-pressed={!reference} onClick={() => setReference(false)}>当前接线 / 生成固件</button>
    <button aria-pressed={reference} onClick={() => setReference(true)}>PAO 参考板 / 灵矽语音</button>
  </div>{reference ? <ReferenceSimulator /> : <ProjectSimulator {...props} />}</>;
}

function ProjectSimulator({ nodes, connections, application, onApplication, onSharedI2s, workspaceKey, appliedDesignId, onDesign }: ProjectProps) {
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
  const microphone = useRef<{ stream?: MediaStream; context?: AudioContext; node?: AudioWorkletNode; source?: MediaStreamAudioSourceNode } | null>(null);
  const micGeneration = useRef(0);
  const [micStatus, setMicStatus] = useState("off");
  const [micSamples, setMicSamples] = useState(0);
  const uart = useRef("");
  const [firmwareReady, setFirmwareReady] = useState(false);
  const [prompt, setPrompt] = useState(application.kind === "agent" ? application.prompt : "声音超过 6000 时输出 880Hz 提示音，保持 400ms，屏幕显示 ALARM；安静时显示 LISTENING。");
  const editedPrompt = useRef(false);
  const [wholeDesign, setWholeDesign] = useState(true);
  const agent = runtime?.agent;
  const agentActive = !!runtime?.active && !!agent && !["succeeded", "failed", "cancelled"].includes(agent.phase);
  useEffect(() => {
    if (!editedPrompt.current && agent?.phase === "succeeded" && agent.application) setPrompt(agent.application.prompt);
  }, [agent?.phase, agent?.application?.prompt]);
  let generated: ReturnType<typeof firmwareProject> | undefined, invalid = "";
  try { generated = firmwareProject({ nodes, connections, application }); } catch (e) { invalid = String(e); }
  const key = generated ? JSON.stringify(generated.design) : "";
  const spec = generated?.spec;
  const designKey = generated ? JSON.stringify({ nodes: generated.design.nodes, connections: generated.design.connections }) : "";
  useEffect(() => {
    if (agent?.phase !== "succeeded" || !agent.application) return;
    if (agent.hardware) {
      if (agent.originKey === workspaceKey && appliedDesignId !== agent.id) onDesign(agent.hardware, agent.application, agent.id);
    } else if (agent.designKey === designKey && (application.kind !== "agent" || JSON.stringify(application) !== JSON.stringify(agent.application))) onApplication(agent.application);
  }, [agent, designKey, application, onApplication, workspaceKey, appliedDesignId, onDesign]);
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
    setConnected(false); setSerial(""); setFrames(0); setFirmwareReady(false); uart.current = "";
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
          if (message.t === "serial" && message.src === "uart0") {
            uart.current = (uart.current + message.data).slice(-48000); setSerial(uart.current);
            const bootAt = uart.current.lastIndexOf("STUDIO BOOT"), readyAt = uart.current.lastIndexOf("STUDIO READY");
            if (bootAt >= 0 || readyAt >= 0) setFirmwareReady(readyAt > bootAt);
            if (/stack overflow|Guru Meditation|Rebooting|abort\(\)/.test(uart.current.slice(Math.max(bootAt, readyAt)))) setFirmwareReady(false);
          }
          if (message.t === "microphone-error") setError(`音频输入被拒绝：${message.message}`);
          if (message.t === "pao") setPins({ levels: BigInt(`0x${message.levels}`), pwm: new Map(message.pwm), transactions: message.i2c[0] });
        } catch (e) { setError(`模拟器消息无效：${e}`); }
      };
      ws.onclose = () => { setConnected(false); stopMicrophone(); if (!disposed) timer = setTimeout(connect, 1000); };
      ws.onerror = () => ws.close();
    }
    connect();
    return () => { disposed = true; clearTimeout(timer); stopMicrophone(); ws?.close(); socket.current = null; void speaker.current?.close(); speaker.current = null; setListening(false); };
  }, [running, key]);
  async function action(name: "prepare" | "build" | "project" | "stop" | "agent" | "design") {
    setPending(true); setError("");
    try {
      const response = await fetch(`/api/runtime/${name}`, { method: "POST",
        headers: { "X-Pao-Studio": "1", "Content-Type": "application/json" },
        body: name === "design" ? JSON.stringify({ prompt, originKey: workspaceKey }) : ["build", "project", "agent"].includes(name) ? JSON.stringify({ nodes, connections, application, prompt }) : undefined });
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
  function stopMicrophone() {
    micGeneration.current++;
    const mic = microphone.current; microphone.current = null;
    if (mic?.node) { mic.node.port.onmessage = null; mic.node.disconnect(); }
    mic?.source?.disconnect();
    mic?.stream?.getTracks().forEach((track) => track.stop());
    if (mic?.context && mic.context.state !== "closed") void mic.context.close();
    setMicStatus("off");
  }
  async function startMicrophone() {
    if (!spec?.mic || socket.current?.readyState !== WebSocket.OPEN) return;
    stopMicrophone(); setError(""); setMicStatus("requesting"); setMicSamples(0);
    const generation = micGeneration.current;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: false, autoGainControl: false } });
      if (generation !== micGeneration.current) { stream.getTracks().forEach((track) => track.stop()); return; }
      const context = new AudioContext({ sampleRate: 48000 });
      const mic = { stream, context } as NonNullable<typeof microphone.current>;
      microphone.current = mic;
      await context.audioWorklet.addModule("/studio-microphone.js");
      if (generation !== micGeneration.current) return;
      mic.node = new AudioWorkletNode(context, "studio-microphone", { processorOptions: { channel: spec.mic.channel } });
      mic.source = context.createMediaStreamSource(stream);
      const mute = context.createGain(); mute.gain.value = 0;
      mic.source.connect(mic.node); mic.node.connect(mute); mute.connect(context.destination);
      mic.node.port.onmessage = ({ data }: MessageEvent<ArrayBuffer>) => {
        const ws = socket.current;
        if (ws?.readyState !== WebSocket.OPEN || ws.bufferedAmount > 64000) { setError("麦克风发送队列积压，已丢弃当前音频帧"); return; }
        ws.send(data); setMicSamples((n) => n + (data.byteLength - 4) / 2);
      };
      stream.getTracks().forEach((track) => { track.onended = () => stopMicrophone(); });
      await context.resume();
      if (generation === micGeneration.current) setMicStatus("on");
    } catch (e) {
      if (generation === micGeneration.current) { stopMicrophone(); setError(`麦克风未启用：${e}`); }
    }
  }
  const duty = (pin: number) => (pins.pwm.get(pin) ?? (pins.levels & (1n << BigInt(pin)) ? 1000 : 0)) / 10;
  const enabled = spec?.motor && !!(pins.levels & (1n << BigInt(spec.motor.enable)));
  const ready = connected && firmwareReady;
  const appState = Array.from(serial.matchAll(/STUDIO APP mode=(\d) running=(\d) level=(\d+) alarm=(\d)/g)).at(-1);
  const agentState = Array.from(serial.matchAll(/STUDIO AGENT time_ms=\d+ running=(\d) level=(\d+) alarm=(\d)/g)).at(-1);
  const businessState = application.kind === "agent" ? agentState : appState?.slice(1);
  return <section className="simulation-page">
    <div className="section-heading"><div><span className="eyebrow">{wholeDesign ? "REQUIREMENT → BOM → WIRING → PCB → FIRMWARE → SIL" : "WIRING → ESP-IDF → ESP32SIM"}</span>
      <h1>{wholeDesign ? "从需求到可运行的整机设计。" : "让当前接线真正运行。"}</h1></div><span className="badge">{ready ? "当前固件已就绪 / 正在仿真" : connected ? "模拟器已连接 / 等待固件就绪" : agentActive ? "Agent 任务执行中" : labels[runtime?.state || ""] || "连接管理服务"}</span></div>
    <div className="notice">{wholeDesign ? "从真实模块选型开始，自动补齐电源和负载、连接真实引脚、生成载板与原理图，再编译固件并在匹配板型中验收。每个阶段都通过后，才应用到工作台。" : "按当前接线与业务参数生成 ESP-IDF 固件，业务在真实固件中执行，页面展示实际外设与遥测结果。"}</div>
    <div className="runtime-setup"><div><h3>{wholeDesign ? "用自然语言设计设备" : "用自然语言开发业务"}</h3>
      <div className="actions"><button aria-pressed={wholeDesign} disabled={!!runtime?.active} onClick={() => setWholeDesign(true)}>从需求设计整机</button><button aria-pressed={!wholeDesign} disabled={!!runtime?.active} onClick={() => setWholeDesign(false)}>保留当前接线写业务</button></div>
      <p>模型：{runtime?.agentModel || "auto/deepseek-v4.1-flash"} · {runtime?.agentProvider || "magpie"}。需求和当前接线发送至本机 Codex CLI 配置的模型服务，录音不发送给模型。</p>
      <label>业务需求<textarea aria-label="Agent 业务需求" rows={4} maxLength={4000} value={prompt} onChange={(e) => { editedPrompt.current = true; setPrompt(e.target.value); }} style={{ width: "100%" }} /></label>
      <div className="actions"><button disabled={pending || !!runtime?.active || !prompt.trim()} onClick={() => void action(wholeDesign ? "design" : "agent")}>{wholeDesign ? "自动选型、接线、PCB 并验证" : "生成、编译并自动验证"}</button>
        <button disabled={!runtime?.active} onClick={() => void action("stop")}>停止 Agent / 运行任务</button></div>
      <p>{wholeDesign ? "从内置真实模块选型，补齐电源和负载、自动接线与生成载板，再编译仿真。通过后替换当前设计；执行中修改了工作区则保留修改。" : "保留当前引脚和驱动，生成业务 C++ 并编译仿真。"}失败最多修复三轮，首份有效业务验收步骤固定；测试 PCM 不会冒充真实麦克风。</p>
    </div><div><h3>Agent 执行结果</h3>
      {agent ? <><p role="status">{({ selecting: "选择硬件模块", wiring: "组装与电气接线", routing: "生成 PCB 铜线", schematic: "生成 tscircuit 原理图", generating: "生成业务源码", building: "编译固件", verifying: "仿真与场景验收", repairing: "反馈错误并修复", succeeded: "验收通过", failed: "执行失败", cancelled: "已停止" } as Record<string, string>)[agent.phase]} · 第 {agent.attempt} / 3 轮</p>
        {agent.hardware ? <><p>{agent.hardware.plan.title} · {agent.hardware.nodes.length} 个模块 / {agent.hardware.connections.length} 根接线 / {agent.hardware.traces.length} 根铜线 · {agent.hardware.board.width}×{agent.hardware.board.height}mm 载板草稿</p>
          <details><summary>选型理由与真实模块清单</summary>{agent.hardware.nodes.map((n) => <p key={n.id}><img src={moduleImage(n.type)} alt="" width={40} height={32} style={{ objectFit: "contain", verticalAlign: "middle" }} /> <a href={partFor(n.type).source} target="_blank" rel="noreferrer">{partFor(n.type).model}</a>：{agent.hardware!.plan.modules.find((m) => m.type === n.type)?.reason || "平台自动补齐必要电源或匹配负载"}</p>)}</details>
          {agent.phase === "succeeded" && appliedDesignId !== agent.id && agent.application && <><p role="alert">工作区已变化，完整结果尚未覆盖当前设计。</p><button onClick={() => onDesign(agent.hardware!, agent.application!, agent.id)}>应用已生成的完整设计</button></>}
          {appliedDesignId === agent.id && <p><a href="#assembly">查看真实模块与接线 →</a> · <a href="#code">原理图与硬件代码 →</a> · <a href="#pcb">已生成 PCB →</a></p>}
        </> : agent.originKey === undefined && agent.designKey !== designKey && <p role="alert">此结果属于其他接线，不能应用到当前设计。</p>}
        {agent.application && <><p>{agent.hardware?.plan.summary || agent.application.summary}</p><details><summary>生成源码与验收场景</summary><pre className="runtime-log">{agent.application.source}{"\n\n"}{JSON.stringify(agent.application.scenarios, null, 2)}</pre></details></>}
        {agent.error && <p role="alert">{agent.error}</p>}<pre className="runtime-log">{agent.log || "等待首轮执行结果"}</pre>
      </> : <p>尚未启动。需要本机安装并配置 Codex CLI，以及已准备好的仿真环境。</p>}
    </div></div>
    <div className="runtime-setup"><div><h3>业务应用</h3>
      <label>应用类型<select aria-label="业务应用类型" value={application.kind} onChange={(e) => { if (e.target.value !== "agent") onApplication(e.target.value === "intercom" ? { kind: "intercom", volume: 50 } : e.target.value === "sound-alarm" ? { kind: "sound-alarm", threshold: 5000, holdMs: 500, frequency: 880 } : { kind: "diagnostic" }); }}>
        <option value="intercom">实时对讲</option><option value="sound-alarm">声音告警</option><option value="diagnostic">模块诊断</option>{application.kind === "agent" && <option value="agent">Agent 生成的业务</option>}</select></label>
      {application.kind === "intercom" && <label>输出音量 / %<input aria-label="对讲输出音量" type="number" min={0} max={100} value={application.volume} onChange={(e) => onApplication({ ...application, volume: Number(e.target.value) })} /></label>}
      {application.kind === "sound-alarm" && <>{([['threshold', 'PCM 幅度阈值', 100, 30000], ['holdMs', '告警保持 / ms', 100, 10000], ['frequency', '提示音 / Hz', 100, 2000]] as const).map(([field, label, min, max]) =>
        <label key={field}>{label}<input aria-label={label} type="number" min={min} max={max} value={application[field]} onChange={(e) => onApplication({ ...application, [field]: Number(e.target.value) })} /></label>)}</>}
    </div><div><h3>I²S 时钟</h3><p>{spec?.mic && spec?.amp ? spec.sharedI2s ? "共享 BCLK / WS，同一控制器全双工" : "独立 BCLK / WS，两个主控通道" : spec?.mic || spec?.amp ? "单路 I²S 主控时钟" : "当前设计没有 I²S 模块"}</p>
      {spec?.mic && spec?.amp && <button disabled={!!runtime?.active} onClick={() => onSharedI2s(!spec.sharedI2s)}>{spec.sharedI2s ? "恢复独立时钟接线" : "自动改为共享时钟接线"}</button>}
      <p>应用参数或时钟接线改变后，需要重新编译；业务计算在 ESP32 固件中执行。</p></div></div>
    {invalid && <p role="alert">{invalid}</p>}
    {runtime?.project && !matching && !(agentActive && agent?.originKey !== undefined) && <p role="alert">当前工作区与已有固件不匹配；应用匹配的设计或重新编译后才能启动。</p>}
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
        <p>OLED 帧 {frames} · I²C 事务 {pins.transactions}</p>{application.kind === "diagnostic" && <button disabled={!connected} onClick={() => command("display")}>切换 OLED 图案</button>}</>}
      {spec?.mic && <><p>浏览器麦克风：{micStatus === "on" ? "正在采集" : micStatus === "requesting" ? "等待授权 / 准备采集" : "已关闭"} · 已发送 {micSamples} 个 48kHz 样本 · 固件采样峰值 {Math.max(0, ...Array.from(serial.matchAll(/rx_peak=(\d+)/g), (m) => Number(m[1])))}</p>
        <div className="actions"><button disabled={!ready || micStatus !== "off"} onClick={() => void startMicrophone()}>启用浏览器麦克风</button><button disabled={micStatus === "off"} onClick={stopMicrophone}>关闭麦克风</button></div></>}
      {application.kind !== "diagnostic" && <><p>固件业务状态：{businessState?.[1] === "1" ? "运行中" : "暂停"} · 当前幅度 {businessState?.[2] ?? 0} · {businessState?.[3] === "1" ? "告警触发" : "未告警"}</p><div className="actions"><button disabled={!ready} onClick={() => command("app-run")}>运行业务应用</button><button disabled={!ready} onClick={() => command("app-pause")}>暂停业务应用</button></div></>}
      {spec?.amp && <><p>I²S 输出：{audio.rate} Hz · {audio.samples} 样本 · 当前峰值 {audio.peak}</p>
        <div className="actions">{application.kind === "diagnostic" && <><button disabled={!connected} onClick={() => command("tone")}>播放 440Hz 测试音</button><button disabled={!connected} onClick={() => command("mute")}>静音</button></>}
          <button disabled={!ready || listening} onClick={async () => {
            try { speaker.current = new AudioContext(); await speaker.current.resume(); setListening(true); }
            catch (e) { setError(`扬声器未启用：${e}`); }
          }}>{listening ? "浏览器扬声器已启用" : "启用浏览器扬声器"}</button></div></>}
      {spec?.motor && <><p>DRV8833 SLP：{enabled ? "高 / 已使能" : "低 / 休眠"}</p>
        {spec.motor.loads.map((load, i) => <p key={load.id}>电机 #{load.id} / {i ? "B" : "A"}：桥臂占空比 {enabled ? Math.round((duty(spec.motor!.pins[i * 2]) - duty(spec.motor!.pins[i * 2 + 1])) * load.polarity) : 0}%（非实测转速）</p>)}
        {application.kind === "agent" ? <p>电机由业务函数控制；暂停业务应用会将两路输出归零。</p> : <div className="actions"><button disabled={!connected} onClick={() => command("motor 30 30")}>双路正转 30% / 1秒</button><button disabled={!connected} onClick={() => command("motor -30 -30")}>双路反转 30% / 1秒</button><button disabled={!connected} onClick={() => command("stop")}>停止电机</button></div>}</>}
      <button disabled={!connected} onClick={() => command("status")}>读取固件状态</button>
    </div><div><h3>UART / 真实固件输出</h3><pre className="runtime-log" aria-label="当前固件 UART">{serial.split("\n").filter((s) => /STUDIO|ERROR|abort|Rebooting|Guru Meditation/.test(s)).slice(-16).join("\n") || "等待当前 ELF 启动"}</pre>
      <details><summary>完整 UART / 最近 48 KB</summary><pre className="runtime-log">{serial}</pre></details></div></div>
    <details><summary>构建 / 运行日志</summary><pre className="runtime-log">{runtime?.log || "尚无任务输出"}</pre></details>
    <p className="caption">仿真覆盖数字接口与诊断行为；电源预算来自静态规则，声学、温升和机械负载仍需实物验证。</p>
  </section>;
}
