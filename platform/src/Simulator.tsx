import { useEffect, useState } from "react";

type Runtime = {
  state: string; log: string; active: boolean;
  artifacts: { firmware: boolean; emulator: boolean; web: boolean };
};
const labels: Record<string, string> = {
  idle: "已停止", preparing: "正在准备环境与构建", starting: "模拟器进程已启动",
  stopping: "正在停止并保存 Flash", failed: "执行失败",
};

export function Simulator() {
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
