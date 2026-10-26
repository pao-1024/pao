import { useEffect, useState } from "react";
import {
  pinSets,
  endpoint,
  padPoint,
  placement,
  pinLabel,
  traceIssues,
  suggestTrace,
  corner,
  electricalReport,
  requiredTraceWidth,
  copperSegments,
  boardRules,
} from "./circuit.ts";
import type { Module, Connection, Trace } from "./catalog.ts";
import { placedFootprints, boardOutline } from "./footprints.ts";
import { manufacturingDrc, manufacturingFiles, manufacturingZip } from "./manufacturing.ts";

export function PCB({
  nodes,
  connections,
  traces,
  board,
  onNodes,
  onTraces,
  onBoard,
  routing,
  onAutoRoute,
}: {
  nodes: Module[];
  connections: Connection[];
  traces: Trace[];
  board: { width: number; height: number };
  onNodes: (nodes: Module[]) => void;
  onTraces: (traces: Trace[]) => void;
  onBoard: (board: { width: number; height: number }) => void;
  routing: boolean;
  onAutoRoute: (width: number) => void;
}) {
  const [wire, setWire] = useState(connections[0]?.id || "");
  const [layer, setLayer] = useState<Trace["layer"]>("F.Cu");
  const [width, setWidth] = useState(0.4);
  const [draft, setDraft] = useState<Trace | null>(null);
  useEffect(() => {
    const cancel = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDraft(null);
    };
    window.addEventListener("keydown", cancel);
    return () => window.removeEventListener("keydown", cancel);
  }, []);
  const [hint, setHint] = useState(
    "自动处理全部网络并尝试双面避障；已有合规人工走线会保留，自动走线重新规划。",
  );
  const selected = connections.find((c) => c.id === wire);
  const drc = manufacturingDrc(nodes, connections, traces, board);
  const issues = drc.issues;
  const footprints = placedFootprints(nodes);
  const electrical = electricalReport(nodes, connections);
  return (
    <div className="pcb-layout">
      <aside className="panel tools">
        <span className="eyebrow">MODULE PCB / 模块安装板</span>
        <h2>真实封装与板框</h2>
        <label>
          板宽 / mm
          <input
            type="number"
            min="60"
            max="200"
            value={board.width}
            onChange={(e) => {
              const v = Number(e.target.value);
              if (v >= 60 && v <= 200) {
                onBoard({ ...board, width: v });
                setDraft(null);
              }
            }}
          />
        </label>
        <label>
          板高 / mm
          <input
            type="number"
            min="60"
            max="160"
            value={board.height}
            onChange={(e) => {
              const v = Number(e.target.value);
              if (v >= 60 && v <= 160) {
                onBoard({ ...board, height: v });
                setDraft(null);
              }
            }}
          />
        </label>
        {nodes.map((n, i) => {
          const p = placement(n, i);
          return (
            <fieldset key={n.id}>
              <legend>
                U{n.id} / {n.type}
              </legend>
              <p><a href={footprints[i].source} target="_blank" rel="noreferrer">{footprints[i].name}</a></p>
              <small>{footprints[i].assembly}</small>
              {(["x", "y"] as const).map((axis) => (
                <label key={axis}>
                  {axis.toUpperCase()} / mm
                  <input
                    type="number"
                    min="0"
                    max={axis === "x" ? board.width : board.height}
                    value={p[axis]}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      if (
                        e.target.value === "" ||
                        !Number.isFinite(v) ||
                        v < 0 ||
                        v > (axis === "x" ? board.width : board.height)
                      )
                        return;
                      onNodes(
                        nodes.map((m) =>
                          m.id === n.id
                            ? { ...m, placement: { ...p, [axis]: v } }
                            : m,
                        ),
                      );
                      setDraft(null);
                    }}
                  />
                </label>
              ))}
            </fieldset>
          );
        })}
      </aside>
      <section className="pcb-board">
        <div className="bench-toolbar">
          <span>
            PCB / {board.width} × {board.height} mm
          </span>
          <span>
            {traces.length} 已布 / {connections.length - traces.length} 待布
          </span>
        </div>
        <div className="pcb-scroll">
          <svg
            id="pcb-board"
            xmlns="http://www.w3.org/2000/svg"
            viewBox={`-8 -8 ${board.width + 16} ${board.height + 16}`}
            width={(board.width + 16) * 7}
            height={(board.height + 16) * 7}
            aria-label="PCB 布线画布"
            onClick={(e) => {
              if (!draft) return;
              const svg = e.currentTarget;
              const matrix = svg.getScreenCTM();
              if (!matrix) return;
              const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(
                matrix.inverse(),
              );
              if (
                p.x >= 0 &&
                p.y >= 0 &&
                p.x <= board.width &&
                p.y <= board.height
              )
                setDraft({
                  ...draft,
                  points: [
                    ...draft.points,
                    { x: Math.round(p.x), y: Math.round(p.y) },
                  ],
                });
            }}
          >
            <defs>
              <pattern
                id="pcb-grid"
                width="2.54"
                height="2.54"
                patternUnits="userSpaceOnUse"
              >
                <circle cx="0" cy="0" r=".09" fill="#819c91" />
              </pattern>
            </defs>
            <polygon
              points={boardOutline(nodes, board).map((p) => `${p.x},${p.y}`).join(" ")}
              fill="#204a40"
              stroke="#bda66c"
              strokeWidth=".3"
            />
            <polygon
              points={boardOutline(nodes, board).map((p) => `${p.x},${p.y}`).join(" ")}
              fill="url(#pcb-grid)"
            />
            {footprints.map((f) => <g key={`body-${f.id}`}>
              <rect {...f.body} fill="none" stroke="#c5d9ca" strokeWidth=".15" strokeDasharray="1 .5" />
              <text x={f.body.x + 1} y={f.body.y + 4} fontSize="2" fill="#e5eee8">U{f.id} / {f.type}</text>
              {f.keepouts.map((r) => <g key={r.name}><rect x={r.x} y={r.y} width={r.width} height={r.height} fill="#e18a5e" fillOpacity=".25" stroke="#efc48b" strokeWidth=".15" /><title>{r.name}</title></g>)}
              {f.holes.map((h, i) => <g key={i}><circle cx={h.x} cy={h.y} r={h.drill / 2 + .5} fill="none" stroke="#ccd6d0" strokeWidth=".1" /><circle cx={h.x} cy={h.y} r={h.drill / 2} fill="#101e1a" /><title>NPTH Ø{h.drill} mm / M2.5 绝缘支柱</title></g>)}
              {f.pads.filter((p) => p.pin.startsWith("NC:")).map((p) => <g key={p.pin}><circle cx={p.x} cy={p.y} r={p.diameter / 2} fill="#d5bd77"/><circle cx={p.x} cy={p.y} r={p.drill / 2} fill="#204a40"/><title>{p.pin} / 不接线</title></g>)}
            </g>)}
            {connections.map((c) => {
              const a = padPoint(nodes, c.a),
                b = padPoint(nodes, c.b),
                t = traces.find((t) => t.connection === c.id);
              const invalid = t && traceIssues(nodes, connections, traces, board, t).length > 0;
              return t ? (
                <g key={c.id}>{copperSegments(nodes, c, t).map((s, i) => <line key={i} x1={s.a.x} y1={s.a.y} x2={s.b.x} y2={s.b.y} stroke={invalid ? "#ff405c" : s.layer === "F.Cu" ? "#eb8a69" : "#78b7e0"} strokeWidth={t.width} strokeLinecap="round" strokeDasharray={invalid ? ".8 .4" : undefined} />)}
                  {(t.vias || []).map((v, i) => <g key={`via${i}`}><circle cx={v.x} cy={v.y} r={boardRules.viaDiameter / 2} fill="#d5bd77"/><circle cx={v.x} cy={v.y} r={boardRules.viaDrill / 2} fill="#204a40"/><title>换层过孔 / 1.2mm 焊盘 / 0.6mm 钻孔</title></g>)}
                </g>
              ) : (
                <line
                  key={c.id}
                  x1={a.x}
                  y1={a.y}
                  x2={b.x}
                  y2={b.y}
                  stroke={wire === c.id ? "#ffe4a0" : "#9cac91"}
                  strokeDasharray="1 1"
                  strokeWidth=".15"
                />
              );
            })}
            {draft && selected && (
              <polyline
                points={[padPoint(nodes, selected.a), ...draft.points]
                  .flatMap((p, i, points) => i ? corner(points[i - 1], p).slice(1) : [p])
                  .map((p) => `${p.x},${p.y}`)
                  .join(" ")}
                fill="none"
                stroke="#ffe4a0"
                strokeWidth={draft.width}
              />
            )}
            {nodes.map((n) => (
              <g key={n.id}>
                {pinSets[n.type].map((p) => {
                  const key = endpoint(n.id, p.id),
                    pt = padPoint(nodes, key);
                  const physical = footprints.find((f) => f.id === n.id)!.pads.find((pad) => pad.pin === p.id)!;
                  const finish = () => {
                    if (!draft || !selected) return;
                    if (key !== selected.b) {
                      setHint("请点击当前连接的目标焊盘。");
                      return;
                    }
                    const errors = traceIssues(nodes, connections, traces, board, draft);
                    if (errors.length) {
                      setHint(`拒绝保存：${errors.join("；")}`);
                      return;
                    }
                    onTraces([
                      ...traces.filter((t) => t.connection !== wire),
                      draft,
                    ]);
                    setDraft(null);
                    setHint("已保存：通过线宽、板边、异网焊盘、同层铜线间距与转角检查。");
                  };
                  return (
                    <g key={key}>
                      <g
                        role="button"
                        tabIndex={0}
                        aria-label={`PCB ${pinLabel(nodes, key)}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          finish();
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") finish();
                        }}
                      >
                        <title>{pinLabel(nodes, key)}</title>
                        <circle
                          cx={pt.x}
                          cy={pt.y}
                          r="1.1"
                          fill="transparent"
                        />
                        <circle cx={pt.x} cy={pt.y} r={physical.diameter / 2} fill="#d5bd77" />
                        <circle cx={pt.x} cy={pt.y} r={physical.drill / 2} fill="#204a40" />
                      </g>
                      <text
                        x={pt.x + 1}
                        y={pt.y - 0.7}
                        fontSize="1"
                        fill="#cee0d2"
                        pointerEvents="none"
                      >
                        {p.name}
                      </text>
                    </g>
                  );
                })}
              </g>
            ))}
            <text x="3" y={board.height - 3} fontSize="1.8" fill="#b3cebd">
              PAO STUDIO / 2 LAYER / FR-4 1.6mm / 1oz
            </text>
          </svg>
        </div>
        <p role="status">
          {draft && selected && `布线中 → ${pinLabel(nodes, selected.b)}。`}{hint}
        </p>
      </section>
      <aside className="panel tools">
        <span className="eyebrow">ROUTING / 布线</span>
        <h2>连接决定走线</h2>
        {electrical.issues.length > 0 && <p role="alert">电气检查未通过，暂停布线：{electrical.issues.join("；")}</p>}
        <button className="primary" disabled={routing || !connections.length || electrical.issues.length > 0} onClick={() => {
          onAutoRoute(width);
          setDraft(null);
          setHint("正在重新规划全部自动走线，未布通时请调整布局或约束。");
        }}>{routing ? "自动布线中…" : "自动布线全部网络"}</button>
        {connections.some((c) => !traces.some((t) => t.connection === c.id)) &&
          <details><summary>未布通网络 / {connections.length - traces.length}</summary>
            <ul>{connections.filter((c) => !traces.some((t) => t.connection === c.id)).map((c) =>
              <li key={c.id}>{pinLabel(nodes, c.a)} → {pinLabel(nodes, c.b)}</li>)}</ul>
          </details>}
        <details><summary>高级 / 手工调整铜线</summary>
        <label>
          目标连接
          <select
            value={wire}
            onChange={(e) => {
              setWire(e.target.value);
              setDraft(null);
            }}
          >
            {connections.map((c) => (
              <option key={c.id} value={c.id}>
                {pinLabel(nodes, c.a)} → {pinLabel(nodes, c.b)}
              </option>
            ))}
          </select>
        </label>
        <label>
          铜层
          <select
            value={layer}
            onChange={(e) => setLayer(e.target.value as Trace["layer"])}
          >
            <option>F.Cu</option>
            <option>B.Cu</option>
          </select>
        </label>
        <label>
          线宽 / mm
          <input
            type="number"
            min="0.2"
            max="2"
            step=".1"
            value={width}
            onChange={(e) => {
              const v = Number(e.target.value);
              if (v >= 0.2 && v <= 2) setWidth(v);
            }}
          />
        </label>
        <button
          disabled={routing || !selected || electrical.issues.length > 0}
          onClick={() => {
            const result = suggestTrace(nodes, connections, traces, board, { connection: wire, layer, width: Math.max(width, requiredTraceWidth(nodes, connections, selected!)), points: [] });
            if (!result) {
              setHint("未找到满足间距的短路径。请调整布局、切换铜层或手动添加路径点；没有保存违规走线。");
              return;
            }
            onTraces([...traces.filter((t) => t.connection !== wire), result]);
            setDraft(null);
            setHint("已生成并检查避障路径；虚线是待布网络，不是铜线。");
          }}
        >尝试避障布线</button>
        <button
          disabled={routing || !selected || electrical.issues.length > 0}
          onClick={() =>
            setDraft({ connection: wire, layer, width: Math.max(width, requiredTraceWidth(nodes, connections, selected!)), points: [] })
          }
        >
          开始 / 重画连线
        </button>
        <div className="actions">
          <button
            disabled={!draft}
            onClick={() =>
              setDraft((d) =>
                d ? { ...d, points: d.points.slice(0, -1) } : null,
              )
            }
          >
            撤销拐点
          </button>
          <button disabled={!draft} onClick={() => setDraft(null)}>
            取消
          </button>
        </div>
        <button
          onClick={() => {
            onTraces(traces.filter((t) => t.connection !== wire));
            setDraft(null);
          }}
        >
          删除所选走线
        </button>
        </details>
        <h3>制造 DRC / {drc.passed ? "通过" : `${issues.length} 项阻止导出`}</h3>
        <p>双层 FR-4 / 1.6mm / 1oz。铜间距 0.25mm，铜到板边及 NPTH 0.5mm，环宽 ≥0.25mm，孔间距 ≥0.25mm，阻焊扩展 0.05mm / 最小阻焊桥 0.1mm。换层过孔 Ø1.2 / 钻孔 Ø0.6mm。</p>
        {issues.length ? <details open><summary>检查结果</summary><ul>{issues.map((s) => <li key={s}>{s}</li>)}</ul></details> : <p role="status">全部网络已连通，封装、铜线、钻孔与阻焊规则通过，可以导出制造文件。</p>}
        <button className="primary" disabled={routing || !drc.passed} onClick={() => {
          try {
            const bytes = manufacturingZip(manufacturingFiles(nodes, connections, traces, board));
            const url = URL.createObjectURL(new Blob([bytes.buffer as ArrayBuffer], { type: "application/zip" }));
            const a = document.createElement("a"); a.href = url; a.download = "pao-pcb-fabrication.zip"; a.click();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
            setHint("已导出 Gerber / PTH / NPTH / 装配图 / BOM / DRC。下单前核对工厂 CAM 预览和模块版本。");
          } catch (error) { setHint(String(error)); }
        }}>导出 Gerber 制造包 ZIP</button>
        <div className="notice">
          使用固定官方版本的真实模块安装封装；电源、扬声器与电机通过 5.08mm 端子外接。制造包可用于裸板打样，按 BOM 采购模块与排针后手工装配。模块须与版本及安装方向一致；实物功能、温升与射频性能仍需样板验证。
        </div>
        <button
          onClick={() => {
            const svg = document.getElementById("pcb-board");
            if (svg) {
              const blob = new Blob(
                [new XMLSerializer().serializeToString(svg)],
                { type: "image/svg+xml" },
              );
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = "pao-pcb-layout.svg";
              a.click();
              setTimeout(() => URL.revokeObjectURL(url), 1000);
            }
          }}
        >
          导出布局 SVG
        </button>
      </aside>
    </div>
  );
}
