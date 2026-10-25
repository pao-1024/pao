import { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  pinSets,
  connectionError,
  referenceConnections,
  autoConnect,
  autoRoute,
  missingPins,
  pinLabel,
  boardIssues,
  electricalReport,
} from "./circuit.ts";
import { catalog, partFor, starter, defaultBoard, completeProject, moduleImage } from "./catalog.ts";
import type { Module, ModuleType, Connection, Trace } from "./catalog.ts";
import { hardwareSource } from "./hardware.ts";
import { Assembly } from "./Assembly.tsx";
import { PCB } from "./PCB.tsx";
import { Simulator } from "./Simulator.tsx";
import { firmwareProject, defaultApplication } from "./firmware.ts";
import type { Application } from "./firmware.ts";
import firmwareMain from "../firmware/main/main.cpp?raw";
import "./style.css";

const pages = [
  ["projects", "01", "平台"],
  ["assembly", "02", "组装"],
  ["code", "03", "硬件代码"],
  ["pcb", "04", "PCB"],
  ["simulation", "05", "仿真"],
  ["delivery", "06", "交付"],
] as const;
type Page = (typeof pages)[number][0];
function download(name: string, body: string, type = "text/plain") {
  const url = URL.createObjectURL(new Blob([body], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function route(): Page {
  const hash = location.hash.slice(1);
  return pages.some((p) => p[0] === hash) ? (hash as Page) : "assembly";
}

function App() {
  const [page, setPage] = useState<Page>(route);
  const [name, setName] = useState("桌面语音终端 / 模块设计");
  const [nodes, setNodes] = useState<Module[]>(starter);
  const [connections, setConnections] = useState<Connection[]>(() =>
    referenceConnections(starter),
  );
  const [traces, setTraces] = useState<Trace[]>([]);
  const [application, setApplication] = useState<Application | null>(null);
  const activeApplication = application ?? defaultApplication(nodes);
  const [routing, setRouting] = useState(false);
  const [routeRequest, setRouteRequest] = useState(0);
  const [routeWidth, setRouteWidth] = useState(0.4);
  const [board, setBoard] = useState(defaultBoard);
  const [selected, setSelected] = useState<number | null>(1);
  const [selectedWire, setSelectedWire] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [connectionIssue, setConnectionIssue] = useState("");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("全部");
  const [message, setMessage] = useState("添加模块后自动接线并尝试双面布线；未完成项会明确列出。");
  let firmware = "", firmwareError = "";
  try { firmware = firmwareProject({ nodes, connections, application: activeApplication }).header; }
  catch (error) { firmwareError = String(error); }
  const [tab, setTab] = useState<"source" | "schematic" | "firmware">("source");
  const [result, setResult] = useState<{ svg: string; json: unknown } | null>(
    null,
  );
  const [building, setBuilding] = useState(false);
  const [buildError, setBuildError] = useState("");
  const serial = useRef(Math.max(...starter.map((n) => n.id)));
  const newProject = useRef<HTMLDialogElement>(null);
  const worker = useRef<Worker | null>(null);
  const timeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const source = hardwareSource(nodes, connections);
  const unconnected = missingPins(nodes, connections);
  const part = nodes.find((n) => n.id === selected);
  const wire = connections.find((c) => c.id === selectedWire);
  const electrical = electricalReport(nodes, connections);
  const autoIssues = electrical.issues;
  const geometry = JSON.stringify(nodes.map(({ id, type, placement }) => ({ id, type, placement })));
  const manualRoutes = JSON.stringify(traces.filter((t) => !t.automatic));
  useEffect(() => {
    const manual: Trace[] = JSON.parse(manualRoutes);
    setTraces(manual);
    if (electricalReport(nodes, connections).issues.length) { setRouting(false); return; }
    setRouting(true);
    let disposed = false;
    const router = new Worker(new URL("./routing.worker.ts", import.meta.url), { type: "module" });
    const timer = setTimeout(() => { router.terminate(); setRouting(false); setMessage("自动布线超过 45 秒，已停止；请减少模块或调整布局。"); }, 45000);
    router.onmessage = (event: MessageEvent<{ result?: ReturnType<typeof autoRoute>; error?: string }>) => {
      if (disposed) return;
      clearTimeout(timer); router.terminate(); setRouting(false);
      if (event.data.error) setMessage(`布线失败：${event.data.error}`);
      else if (event.data.result) {
        const result = event.data.result;
        setTraces(result.traces);
        setMessage(result.issues.length ? result.issues.join("；") : `自动布线完成：${result.traces.length} 根已布，${result.failed.length} 根待调整布局。`);
      }
    };
    router.onerror = (event) => { clearTimeout(timer); router.terminate(); setRouting(false); setMessage(`布线失败：${event.message}`); };
    router.postMessage({ nodes, connections, traces: manual, board, width: routeWidth });
    return () => { disposed = true; clearTimeout(timer); router.terminate(); };
  }, [geometry, connections, board, manualRoutes, routeRequest, routeWidth]);
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [page]);
  useEffect(() => {
    const change = () => setPage(route());
    window.addEventListener("hashchange", change);
    const cancel = (e: KeyboardEvent) => {
      if (e.key === "Escape") { setPending(null); setConnectionIssue(""); }
    };
    window.addEventListener("keydown", cancel);
    return () => {
      window.removeEventListener("hashchange", change);
      window.removeEventListener("keydown", cancel);
    };
  }, []);
  useEffect(() => {
    worker.current?.terminate();
    clearTimeout(timeout.current);
    setResult(null);
    setBuilding(false);
    setBuildError("");
    return () => {
      worker.current?.terminate();
      clearTimeout(timeout.current);
    };
  }, [source]);
  function add(type: ModuleType, x = 510, y = 80) {
    if (nodes.length >= 20) {
      setMessage("本地工作台最多放置 20 个模块。");
      return;
    }
    const n = {
      id: ++serial.current,
      type,
      x: Math.max(20, Math.min(1140, x)),
      y: Math.max(30, Math.min(1800, y)),
    };
    const nextNodes = completeProject([...nodes, n]);
    if (nextNodes.length > 20) { setMessage("补齐电源和负载后超出 20 个模块，请减少模块。"); return; }
    automate(nextNodes);
    setSelected(n.id);
    setSelectedWire(null);
  }
  function automate(nextNodes = nodes) {
    const completed = completeProject(nextNodes);
    if (completed.length > 20) { setMessage("补齐必要器件后超过模块上限。"); return; }
    serial.current = Math.max(serial.current, ...completed.map((n) => n.id));
    const connected = autoConnect(completed, connections);
    setNodes(completed);
    setConnections(connected.connections);
    setPending(null);
    setConnectionIssue("");
    setMessage(connected.issues.length ? `电气检查有 ${connected.issues.length} 项待解决，暂停自动布线：${connected.issues.join("；")}` : `自动接线完成：${connected.connections.length} 根连接，正在自动布线。`);
  }
  function removeWire(id: string) {
    setConnections(connections.filter((c) => c.id !== id));
    setTraces(traces.filter((t) => t.connection !== id));
    setSelectedWire(null);
    setMessage("已删除连接及其 PCB 走线。");
  }
  function shareAudioClock(shared: boolean) {
    try {
      const { mic, amp } = firmwareProject({ nodes, connections, application: activeApplication }).spec;
      if (!mic || !amp) throw Error("共享时钟需要麦克风和功放");
      const esp = nodes.find((n) => n.type === "esp")!;
      const gpio = (pin: number) => `${esp.id}:${pinSets.esp.find((p) => p.name === `GPIO${pin}`)!.id}`;
      const next = connections.map((c) => {
        for (const [pin, name] of [["BCLK", shared ? amp.bclk : 5], ["WS", shared ? amp.ws : 4]] as const) {
          const target = `${mic.id}:${pin}`;
          if (c.a === target) return { ...c, b: gpio(name) };
          if (c.b === target) return { ...c, a: gpio(name) };
        }
        return c;
      });
      firmwareProject({ nodes, connections: next, application: activeApplication });
      setConnections(next);
      setMessage(shared ? "麦克风与功放已共享 BCLK / WS；请重新编译当前设计。" : "麦克风已恢复独立 GPIO5 / GPIO4 时钟；请重新编译。");
    } catch (error) { setMessage(String(error)); }
  }
  function removeModule(id: number) {
    const removed = new Set(
      connections
        .filter((c) => c.a.startsWith(`${id}:`) || c.b.startsWith(`${id}:`))
        .map((c) => c.id),
    );
    setNodes(nodes.filter((n) => n.id !== id));
    setConnections(connections.filter((c) => !removed.has(c.id)));
    setTraces(traces.filter((t) => !removed.has(t.connection)));
    setPending(null);
    setSelected(null);
    setSelectedWire(null);
    setMessage("已移除模块、关联连接与 PCB 走线。");
  }
  function pin(key: string) {
    setConnectionIssue("");
    if (!pending) {
      setPending(key);
      setMessage(`起点 ${pinLabel(nodes, key)}，请选择终点。`);
      return;
    }
    const error = connectionError(nodes, connections, pending, key);
    if (error) {
      setConnectionIssue(error);
      setMessage(error);
      return;
    }
    setConnections([
      ...connections,
      { id: crypto.randomUUID(), a: pending, b: key },
    ]);
    setPending(null);
    setMessage("已建立连接；基础校验不代替完整电气检查。");
  }
  function compile() {
    if (!nodes.length) {
      setBuildError("请先添加模块。");
      return;
    }
    if (electrical.issues.length) { setBuildError(`电气检查未通过：${electrical.issues.join("；")}`); return; }
    worker.current?.terminate();
    clearTimeout(timeout.current);
    setBuilding(true);
    setBuildError("");
    setResult(null);
    const w = new Worker(new URL("./hardware.worker.ts", import.meta.url), {
      type: "module",
    });
    worker.current = w;
    const finish = () => {
      clearTimeout(timeout.current);
      w.terminate();
      setBuilding(false);
    };
    w.onmessage = (e) => {
      if (e.data.error) setBuildError(e.data.error);
      else {
        setResult(e.data.result);
        setTab("schematic");
      }
      finish();
    };
    w.onerror = (e) => {
      setBuildError(e.message || "硬件引擎加载失败");
      finish();
    };
    timeout.current = setTimeout(() => {
      setBuildError("生成超过 60 秒，已停止。请减少模块或检查连接后重试。");
      finish();
    }, 60000);
    w.postMessage({ nodes, connections });
  }
  function exportProject() {
    download(
      "pao-project.json",
      JSON.stringify(
        {
          version: 2,
          name,
          nodes,
          connections,
          board,
          traces,
          electrical,
          application: activeApplication,
          firmware: { header: firmware, main: firmwareMain },
          notice:
            "模块接口设计与载板草稿；不是可制造 PCB。应用固件按当前接线和业务参数生成，运行状态以仿真页面为准。",
        },
        null,
        2,
      ),
      "application/json",
    );
  }
  const matches = catalog.filter(
    (c) =>
      (category === "全部" || c.category === category) &&
      (c.name + c.model + c.maker + c.bus)
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  return (
    <div className="studio">
      <aside className="rail">
        <a href="#projects" className="wordmark" aria-label="PAO Studio 平台">
          pao<span>STUDIO</span>
        </a>
        <nav>
          {pages.map(([id, no, label]) => (
            <a
              key={id}
              href={`#${id}`}
              className={page === id ? "active" : ""}
              aria-current={page === id ? "page" : undefined}
            >
              <small>{no}</small>
              {label}
            </a>
          ))}
        </nav>
        <a
          className="roadmap-link"
          href="https://github.com/pao-1024/pao/issues/29"
          target="_blank"
          rel="noreferrer"
        >
          平台路线 ↗
        </a>
        <span className="local-label">
          LOCAL
          <br />
          WORKBENCH
        </span>
      </aside>
      <div className="shell">
        <header className="topbar">
          <div>
            <span className="eyebrow">HARDWARE AS CODE / 本地工作台</span>
            <label className="project-name">
              <span className="sr-only">项目名称</span>
              <input
                value={name}
                maxLength={60}
                onChange={(e) => setName(e.target.value)}
                onBlur={() => {
                  if (!name.trim()) setName("未命名项目");
                }}
              />
            </label>
          </div>
          <div className="actions">
            <span className="session-label">仅当前会话 · 刷新前请导出</span>
            <button onClick={() => newProject.current?.showModal()}>
              新建项目
            </button>
            <button onClick={exportProject}>导出项目 ↓</button>
            <a className="button primary" href="#code">
              生成硬件设计 →
            </a>
          </div>
        </header>
        <main>
          {page === "projects" && (
            <>
              <section className="hero">
                <div>
                  <span className="eyebrow">
                    AGENT-DRIVEN HARDWARE / 平台方向
                  </span>
                  <h1>
                    把硬件做成模块。
                    <br />
                    让创意成为可运行的设计。
                  </h1>
                  <p>
                    像组合软件模块一样组合真实器件。以代码描述连接，用虚拟原型验证行为，逐步由
                    Agent 协同生成与迭代软硬件方案。
                  </p>
                  <a className="button primary" href="#assembly">
                    进入模块工作台 →
                  </a>
                  <span className="hero-note">
                    Agent 自动设计与验证闭环尚在规划中
                  </span>
                </div>
                <img src="/modules/esp.png" alt="Espressif ESP32-S3 开发板" />
              </section>
              <div className="status-grid">
                <article>
                  <span className="badge live">已实现 / 工作台</span>
                  <h2>器件、连接、代码</h2>
                  <p>
                    官方器件图形、具名端子、自动接线与双面避障布线、tscircuit
                    原理图生成、载板草稿与数据导出。
                  </p>
                </article>
                <article>
                  <span className="badge">已实现 / 软件在环</span>
                  <h2>接线、固件、运行</h2>
                  <p>
                    按当前接线生成实时对讲、声音告警或诊断固件并编译，使用真实浏览器麦克风，在匹配的 esp32sim 板型上运行；支持共享 I²S 时钟。
                  </p>
                </article>
                <article>
                  <span className="badge planned">规划中 / Agent</span>
                  <h2>从需求到验证</h2>
                  <p>
                    Agent 从自然语言生成更多业务应用、根据运行证据迭代、硬件在环（HIL）与制造资料检查。
                  </p>
                </article>
              </div>
              <section className="panel value">
                <span className="eyebrow">LESS WAITING. MORE BUILDING.</span>
                <h2>把能提前发现的问题，留在打板之前。</h2>
                <p>
                  面向独立开发者与小型硬件团队，减少等待实物、软硬件配置不一致和反复打板的成本。小车是参考产品，不是平台的边界。仿真通过不等于可以生产。
                </p>
              </section>
            </>
          )}
          {page === "assembly" && (
            <>
              <div className="section-heading">
                <div>
                  <span className="eyebrow">
                    COMPOSABLE HARDWARE / 可组合器件
                  </span>
                  <h1>从真实器件开始设计。</h1>
                </div>
                <div className="actions">
                  <span className="badge live">可用 · 自动接线</span>
                  <button className="primary" onClick={() => automate()}>
                    自动接线并布线
                  </button>
                  <button
                    onClick={() => {
                      setPending(null);
                      setMessage(
                        electrical.issues.length ? electrical.issues.join("；") : "模块电气规则通过：供电、公共地、负载、复位及总线角色已检查。",
                      );
                    }}
                  >
                    检查连接
                  </button>
                  <button disabled={!pending} onClick={() => { setPending(null); setConnectionIssue(""); }}>
                    取消接线
                  </button>
                </div>
              </div>
              <div className="notice">
                {connectionIssue && <p role="alert">拒绝连接：{connectionIssue}</p>}
                添加模块自动补齐电源和匹配负载，连接复位、使能与总线；电气检查通过后才开始 PCB 布线。
                <p role="status">{autoIssues.length ? `电气待解决：${autoIssues.join("；")}` : "模块电气规则通过"}</p>
                {electrical.budgets.map((b) => <p key={b.source}>{pinLabel(nodes, b.source)} · {b.voltage}V · 预算 {b.demandMa} / {b.capacityMa}mA</p>)}
                <details><summary>接线与固件初始化条件</summary><ul>{electrical.requirements.map((r) => <li key={r}>{r}</li>)}</ul></details>
                <p>{routing ? "正在后台自动布线，可继续操作模块。" : `PCB 已布 ${traces.length} / ${connections.length} 根。未布通的网络在 PCB 页列出。`}</p>
              </div>
              <div className="workbench">
                <aside className="library">
                  <div className="section-title">
                    <h2>器件库</h2>
                    <span>{catalog.length} MODULES</span>
                  </div>
                  <input
                    aria-label="搜索器件"
                    placeholder="名称、接口、厂商…"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                  <div className="filters">
                    {["全部", "主控", "显示", "音频", "执行器", "电源", "负载"].map((c) => (
                      <button
                        key={c}
                        aria-pressed={category === c}
                        className={category === c ? "active" : ""}
                        onClick={() => setCategory(c)}
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                  <div className="module-list">
                    {matches.map((c) => (
                      <button
                        key={c.type}
                        className="module-card"
                        draggable
                        onDragStart={(e) =>
                          e.dataTransfer.setData("pao/module", c.type)
                        }
                        onClick={() =>
                          add(c.type, 510, 100 + (nodes.length % 3) * 180)
                        }
                        aria-label={`添加 ${c.name}`}
                      >
                        <div className="module-image">
                          <img
                            src={moduleImage(c.type)}
                            alt={c.model}
                            draggable={false}
                          />
                          <span>＋</span>
                        </div>
                        <small>
                          {c.maker} / {c.category}
                        </small>
                        <h3>{c.name}</h3>
                        <p>{c.model}</p>
                        <span className="module-interface">{c.bus}</span>
                      </button>
                    ))}
                  </div>
                  {!matches.length && <p className="empty">没有匹配器件。</p>}
                  <p className="caption">
                    图像来自 Espressif、Adafruit 与 Pololu 官方资料。
                    <a href="/modules/SOURCES.md" target="_blank">
                      来源与许可 ↗
                    </a>
                  </p>
                </aside>
                <Assembly
                  nodes={nodes}
                  connections={connections}
                  selected={selected}
                  pending={pending}
                  onSelect={(id) => {
                    setSelected(id);
                    setSelectedWire(null);
                  }}
                  onMove={(id, x, y) =>
                    setNodes((prev) =>
                      prev.map((n) => (n.id === id ? { ...n, x, y } : n)),
                    )
                  }
                  onPin={pin}
                  onWire={setSelectedWire}
                  onAdd={add}
                />
                <aside className="inspector">
                  {wire ? (
                    <>
                      <span className="eyebrow">CONNECTION / 当前连线</span>
                      <h2>{pinLabel(nodes, wire.a)}</h2>
                      <p>↓ {pinLabel(nodes, wire.b)}</p>
                      <button
                        className="danger"
                        onClick={() => removeWire(wire.id)}
                      >
                        删除此连接
                      </button>
                    </>
                  ) : part ? (
                    <>
                      <span className="eyebrow">MODULE / U{part.id}</span>
                      <img
                        className="inspector-image"
                        src={moduleImage(part.type)}
                        alt={partFor(part.type).name}
                      />
                      <h2>{partFor(part.type).name}</h2>
                      <p>{partFor(part.type).model}</p>
                      <div className="spec">
                        <span>电压</span>
                        <span>{partFor(part.type).voltage}</span>
                        <span>接口</span>
                        <span>{partFor(part.type).bus}</span>
                        <span>端子</span>
                        <span>{pinSets[part.type].length} 个可见端子</span>
                      </div>
                      <a
                        href={partFor(part.type).source}
                        target="_blank"
                        rel="noreferrer"
                      >
                        官方接线与引脚资料 ↗
                      </a>
                      <p className="notice">{partFor(part.type).note}</p>
                      <h3>精确放置 / 画布坐标</h3>
                      <div className="coordinates">
                        {(["x", "y"] as const).map((axis) => (
                          <label key={axis}>
                            {axis.toUpperCase()}
                            <input
                              type="number"
                              min={20}
                              max={axis === "x" ? 1140 : 1800}
                              value={Math.round(part[axis])}
                              onChange={(e) => {
                                const v = Number(e.target.value);
                                if (
                                  e.target.value !== "" &&
                                  v >= 20 &&
                                  v <= (axis === "x" ? 1140 : 1800)
                                )
                                  setNodes(
                                    nodes.map((n) =>
                                      n.id === part.id
                                        ? { ...n, [axis]: v }
                                        : n,
                                    ),
                                  );
                              }}
                            />
                          </label>
                        ))}
                      </div>
                      <button
                        className="danger"
                        onClick={() => removeModule(part.id)}
                      >
                        移除模块与相关连线
                      </button>
                    </>
                  ) : (
                    <p>选择器件查看型号、端子与官方资料。</p>
                  )}
                  <div className="inspector-plan">
                    <span className="badge planned">规划中</span>
                    <h3>Agent 协同设计</h3>
                    <p>
                      根据需求选择模块、配置驱动、读取编译与仿真结果并迭代。当前由你完成组装。
                    </p>
                  </div>
                </aside>
              </div>
              <section className="panel connection-table">
                <div className="section-title">
                  <h2>接线清单</h2>
                  <span>
                    {connections.length} 根连线 · {unconnected.length}{" "}
                    个必接端子待接
                  </span>
                  <button
                    onClick={() =>
                      download(
                        "wiring.csv",
                        "\uFEFF起点,终点\n" +
                          connections
                            .map((c) =>
                              [pinLabel(nodes, c.a), pinLabel(nodes, c.b)].join(
                                ",",
                              ),
                            )
                            .join("\n"),
                        "text/csv",
                      )
                    }
                  >
                    导出 CSV
                  </button>
                </div>
                <p className="caption">
                  模块电气检查覆盖供电范围与预算、公共地、差分负载、复位、使能及总线角色；实物仍需按导出的初始化条件核对驱动与波形。
                </p>
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>起点 / 排针</th>
                        <th>终点 / 丝印</th>
                        <th>操作</th>
                      </tr>
                    </thead>
                    <tbody>
                      {connections.map((c) => (
                        <tr key={c.id}>
                          <td>{pinLabel(nodes, c.a)}</td>
                          <td>{pinLabel(nodes, c.b)}</td>
                          <td>
                            <button onClick={() => removeWire(c.id)}>
                              移除
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            </>
          )}
          {page === "code" && (
            <>
              <div className="section-heading">
                <div>
                  <span className="eyebrow">HARDWARE AS CODE / tscircuit</span>
                  <h1>同一份连接，生成真实原理图。</h1>
                </div>
                <button
                  className="primary"
                  disabled={building || !nodes.length}
                  onClick={compile}
                >
                  {building ? "tscircuit 生成中…" : "生成原理图"}
                </button>
              </div>
              <p className="notice">
                已接入 tscircuit 引擎，浏览器本地生成 Circuit JSON 与
                SVG。当前生成模块接口原理图，不含厂商内部电路或经过核实的 PCB
                封装。
              </p>
              <div className="code-tabs">
                {(["source", "schematic", "firmware"] as const).map((t) => (
                  <button
                    key={t}
                    className={tab === t ? "active" : ""}
                    onClick={() => setTab(t)}
                  >
                    {t === "source"
                      ? "design.tsx"
                      : t === "schematic"
                        ? "原理图 / SVG"
                        : "生成固件"}
                  </button>
                ))}
              </div>
              {buildError && (
                <pre role="alert" className="error">
                  {buildError}
                </pre>
              )}
              {tab === "source" && (
                <textarea
                  className="source"
                  aria-label="tscircuit 设计源码"
                  readOnly
                  value={source}
                />
              )}
              {tab === "firmware" && (
                <>
                  <p className="notice">
                    wiring.h 随当前接线与业务参数生成，和实时对讲、声音告警或模块诊断程序一起编译；在仿真页配置应用并启动匹配板型。
                  </p>
                  <details><summary>当前设计的 GPIO / 电气配置</summary><pre className="runtime-log">{JSON.stringify(electrical, null, 2)}</pre></details>
                  <button onClick={() => download("electrical-contract.json", JSON.stringify(electrical, null, 2), "application/json")}>导出 GPIO 与初始化条件</button>
                  <button disabled={!!firmwareError} onClick={async () => {
                    try {
                      const response = await fetch("/api/runtime/source", { method: "POST",
                        headers: { "X-Pao-Studio": "1", "Content-Type": "application/json" }, body: JSON.stringify({ nodes, connections, application: activeApplication }) });
                      const result = await response.json();
                      if (!response.ok) throw Error(result.error);
                      download("esp-idf-project.json", JSON.stringify(result.files, null, 2), "application/json");
                    } catch (error) { setBuildError(`固件源码导出失败：${error}`); }
                  }}>导出完整 ESP-IDF 源文件 JSON</button>
                  <textarea
                    className="source"
                    aria-label="生成的固件配置与程序"
                    readOnly
                    value={firmwareError || `${firmware}\n// main/main.cpp\n${firmwareMain}`}
                  />
                </>
              )}
              {tab === "schematic" &&
                (result ? (
                  <img
                    className="schematic"
                    src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(result.svg)}`}
                    alt="由当前设计通过 tscircuit 生成的原理图"
                  />
                ) : (
                  <div className="runtime-empty">
                    <h2>{building ? "正在生成原理图" : "尚未生成当前设计"}</h2>
                    <p>点击“生成原理图”。连接变化后旧结果会自动失效。</p>
                  </div>
                ))}
              <div className="actions exports">
                <button onClick={() => download("design.tsx", source)}>
                  下载 TSX
                </button>
                <button disabled={!!firmwareError} onClick={() => download("wiring.h", firmware)}>
                  下载固件引脚配置
                </button>
                <button
                  disabled={!result}
                  onClick={() =>
                    result &&
                    download("schematic.svg", result.svg, "image/svg+xml")
                  }
                >
                  下载原理图 SVG
                </button>
                <button
                  disabled={!result}
                  onClick={() =>
                    result &&
                    download(
                      "circuit.json",
                      JSON.stringify(result.json, null, 2),
                      "application/json",
                    )
                  }
                >
                  下载 Circuit JSON
                </button>
              </div>
            </>
          )}
          {page === "pcb" && (
            <>
              <div className="section-heading">
                <div>
                  <span className="eyebrow">PCB / 载板设计草稿</span>
                  <h1>从连接关系，到板上布局。</h1>
                </div>
                <span className="badge">可用 · 约束布线与几何检查</span>
              </div>
              <PCB
                nodes={nodes}
                connections={connections}
                traces={traces}
                board={board}
                onNodes={setNodes}
                onTraces={setTraces}
                onBoard={setBoard}
                routing={routing}
                onAutoRoute={(width) => { setRouteWidth(width); setRouteRequest((v) => v + 1); }}
              />
            </>
          )}
          {page === "simulation" && <Simulator nodes={nodes} connections={connections} application={activeApplication} onApplication={setApplication} onSharedI2s={shareAudioClock} />}
          {page === "delivery" && (
            <>
              <div className="section-heading">
                <div>
                  <span className="eyebrow">DESIGN HANDOFF / 设计交付</span>
                  <h1>带着证据交付，而不是一张效果图。</h1>
                </div>
                <button className="primary" onClick={exportProject}>
                  导出项目草稿
                </button>
              </div>
              <div className="status-grid">
                <article>
                  <span className="badge live">可导出</span>
                  <h2>设计资料</h2>
                  <p>
                    {nodes.length} 个模块 · {connections.length}{" "}
                    根线。JSON、接线 CSV、TSX、已生成的 Circuit JSON 与 SVG。
                  </p>
                </article>
                <article>
                  <span className="badge">待验证</span>
                  <h2>实物与电气</h2>
                  <p>
                    {autoIssues.length} 项模块电气问题，{unconnected.length} 个必接端子待接，
                    {boardIssues(nodes, connections, traces, board).length}{" "}
                    项布局与铜线几何问题。基础检查不代表完整 ERC / DRC。
                  </p>
                </article>
                <article>
                  <span className="badge planned">规划中</span>
                  <h2>制造输出</h2>
                  <p>
                    核实封装、布线规则、供电与机械约束，经过实际打样验证后，再提供
                    Gerber 与制造交付。
                  </p>
                </article>
              </div>
              <section className="panel">
                <h2>模块清单 / BOM 草稿</h2>
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>器件</th>
                        <th>厂商型号</th>
                        <th>数量</th>
                        <th>资料</th>
                      </tr>
                    </thead>
                    <tbody>
                      {catalog
                        .filter((c) => nodes.some((n) => n.type === c.type))
                        .map((c) => (
                          <tr key={c.type}>
                            <td>{c.name}</td>
                            <td>{c.model}</td>
                            <td>
                              {nodes.filter((n) => n.type === c.type).length}
                            </td>
                            <td>
                              <a
                                href={c.source}
                                target="_blank"
                                rel="noreferrer"
                              >
                                官方资料 ↗
                              </a>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
                <button
                  onClick={() =>
                    download(
                      "bom.csv",
                      "\uFEFF厂商,型号,数量\n" +
                        catalog
                          .filter((c) => nodes.some((n) => n.type === c.type))
                          .map((c) =>
                            [
                              c.maker,
                              c.model,
                              nodes.filter((n) => n.type === c.type).length,
                            ].join(","),
                          )
                          .join("\n"),
                      "text/csv",
                    )
                  }
                >
                  导出 BOM 草稿
                </button>
                <p>当前设计未运行固件、未完成实物验证，也没有生产就绪结论。</p>
              </section>
            </>
          )}
        </main>
        <footer>
          <span role="status">{message}</span>
          <a href="#projects">已实现与规划 →</a>
        </footer>
      </div>
      <dialog ref={newProject}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const title = String(
              new FormData(e.currentTarget).get("name") || "",
            ).trim();
            if (!title) return;
            setName(title);
            setNodes([]);
            setApplication(null);
            setConnections([]);
            setTraces([]);
            setBoard(defaultBoard);
            setPending(null);
            setSelected(null);
            setSelectedWire(null);
            setMessage("空白项目已创建，请从器件库添加模块。");
            newProject.current?.close();
            location.hash = "assembly";
          }}
        >
          <span className="eyebrow">NEW PROJECT</span>
          <h2>开始一个新设计</h2>
          <p>此操作替换当前会话，请先导出需要保留的项目。</p>
          <label>
            新项目名称
            <input
              name="name"
              required
              maxLength={60}
              pattern=".*\S.*"
              placeholder="例如：环境监测终端"
            />
          </label>
          <div className="actions">
            <button type="button" onClick={() => newProject.current?.close()}>
              取消
            </button>
            <button className="primary" type="submit">
              创建空白项目
            </button>
          </div>
        </form>
      </dialog>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
