import { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";

type Microphone = {
  stream: MediaStream;
  context: AudioContext;
  source: MediaStreamAudioSourceNode;
  node: AudioWorkletNode;
};

function App() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const consoleView = useRef<HTMLPreElement>(null);
  const socket = useRef<WebSocket | null>(null);
  const microphone = useRef<Microphone | null>(null);
  const speaker = useRef<AudioContext | null>(null);
  const playHead = useRef(0);
  const [connected, setConnected] = useState(false);
  const [status, setStatus] = useState("正在连接模拟器");
  const [hint, setHint] = useState("授权麦克风后说“你好小智”。建议使用耳机。");
  const [recording, setRecording] = useState(false);
  const [busy, setBusy] = useState(false);
  const [led, setLed] = useState("#333");
  const [log, setLog] = useState("");

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
    } else if (data.getUint8(0) === 2 && speaker.current) {
      const context = speaker.current;
      const rate = data.getUint32(1, true), count = (buffer.byteLength - 5) / 2;
      const audio = context.createBuffer(1, count, rate), channel = audio.getChannelData(0);
      for (let i = 0; i < count; i++) channel[i] = data.getInt16(5 + i * 2, true) / 32768;
      const source = context.createBufferSource();
      source.buffer = audio; source.connect(context.destination);
      playHead.current = Math.max(playHead.current, context.currentTime + 0.06);
      source.start(playHead.current); playHead.current += audio.duration;
    }
  }

  useEffect(() => {
    let disposed = false, retry: ReturnType<typeof setTimeout>;
    function stopAudio() {
      void stopMicrophone(); void speaker.current?.close(); speaker.current = null;
    }
    function connect() {
      const connection = new WebSocket(`ws://${location.host}/ws`);
      connection.binaryType = "arraybuffer"; socket.current = connection;
      connection.onopen = () => { setConnected(true); setStatus("模拟器已连接"); };
      connection.onmessage = event => {
        if (event.data instanceof ArrayBuffer) { binary(event.data); return; }
        const message = JSON.parse(event.data);
        if (message.t === "serial" && message.src === "uart0") {
          setLog(previous => (previous + message.data).slice(-60000));
        } else if (message.t === "ring") setLed(`rgb(${message.leds[0].join(",")})`);
        else if (message.t === "stat") setStatus(`模拟器已连接 · ${message.time.toFixed(2)} 秒`);
        else if (message.t === "microphone-error") {
          void stopMicrophone(); setHint(message.message);
        }
      };
      connection.onclose = () => {
        if (disposed) return;
        void stopMicrophone(); setConnected(false); setStatus("模拟器连接已断开");
        retry = setTimeout(connect, 1000);
      };
    }
    connect();
    window.addEventListener("pagehide", stopAudio);
    return () => {
      disposed = true; clearTimeout(retry); socket.current?.close();
      window.removeEventListener("pagehide", stopAudio); stopAudio();
    };
  }, []);

  useEffect(() => {
    if (consoleView.current) consoleView.current.scrollTop = consoleView.current.scrollHeight;
  }, [log]);

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
        if (connection.readyState === WebSocket.OPEN) connection.send(event.data);
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
    setTimeout(() => {
      if (connection.readyState === WebSocket.OPEN) connection.send(JSON.stringify({t: "btn", pin: 0, v: 0}));
    }, 100);
  }

  return <>
    <h1>PAO 语音模拟器</h1>
    <p role="status">{status}</p>
    <canvas ref={canvas} width={128} height={64} aria-label="OLED 显示屏" />
    <p><span id="led" style={{background: led}} aria-label="状态灯" /> GPIO48 状态灯</p>
    <button disabled={!connected || busy} onClick={() => void toggleMicrophone()}>
      {recording ? "关闭麦克风" : "启用麦克风和扬声器"}
    </button>
    <button disabled={!connected} onClick={pressBoot}>BOOT</button>
    <p role="status">{hint}</p>
    <pre ref={consoleView} aria-label="UART0 串口日志">{log}</pre>
  </>;
}

createRoot(document.getElementById("root")!).render(<App />);
