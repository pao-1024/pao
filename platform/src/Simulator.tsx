import { useEffect, useState } from "react";

export function Simulator() {
  const [open, setOpen] = useState(false);
  const [connected, setConnected] = useState(false);
  useEffect(() => {
    if (!open) return;
    const socket = new WebSocket("ws://127.0.0.1:8080/ws");
    // Only an emulator protocol message confirms a live device, not an HTTP page load.
    socket.onmessage = (e) => {
      if (typeof e.data === "string") {
        try {
          const message = JSON.parse(e.data);
          if (["pao", "serial", "stat"].includes(message.t)) setConnected(true);
        } catch {
          setConnected(false);
        }
      }
    };
    socket.onclose = () => setConnected(false);
    socket.onerror = () => setConnected(false);
    return () => socket.close();
  }, [open]);
  return (
    <section className="simulation-page">
      <div className="section-heading">
        <div>
          <span className="eyebrow">VIRTUAL PROTOTYPING / 真实运行时</span>
          <h1>让固件在虚拟设备上运行。</h1>
        </div>
        <span className={`badge ${connected ? "live" : ""}`}>
          {connected ? "收到模拟器数据" : "运行时未连接"}
        </span>
      </div>
      <div className="notice">
        当前连接独立的 PAO 参考板型：ESP32-S3、INMP441、SSD1306 128×64、MAX98357
        与 MX1508。自由组装的画布、引脚和固件草稿不会自动下发给该板型。
      </div>
      <div className="runtime-setup">
        <div>
          <h3>启动本地 esp32sim</h3>
          <p>
            在本 worktree 根目录执行。运行需要 ESP-IDF ROM、已构建固件及 Rust
            工具链。
          </p>
          <pre>task firmware:build{"\n"}task simulator:run</pre>
        </div>
        <div>
          <p>
            复用仓库真实模拟器页面，包含 OLED、I²S 音频、总线追踪与 UART 日志。
          </p>
          <button
            className="primary"
            onClick={() => {
              setConnected(false);
              setOpen((v) => !v);
            }}
          >
            {open ? "断开工作台视图" : "连接本地模拟器"}
          </button>{" "}
          <a href="http://127.0.0.1:8080/" target="_blank" rel="noreferrer">
            独立窗口 ↗
          </a>
        </div>
      </div>
      {open ? (
        <iframe
          title="esp32sim PAO 真实仿真"
          src="http://127.0.0.1:8080/"
          allow="microphone; autoplay"
          className="sim-frame"
        />
      ) : (
        <div className="runtime-empty">
          <span className="runtime-chip">ESP32-S3</span>
          <h2>等待真实设备数据</h2>
          <p>这里没有预设动画或模拟成功状态。启动运行时后连接。</p>
        </div>
      )}
      <p className="caption">
        自由组合板型与固件生成、自动化软件在环（SIL）、硬件在环（HIL）均在规划中。仿真不替代功耗、电气、射频与实物验证。
      </p>
    </section>
  );
}
