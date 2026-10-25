import { useRef, useState } from "react";
import type { CSSProperties, PointerEvent } from "react";
import { pinSets, endpoint, netColor, resolvePin } from "./circuit.ts";
import { partFor } from "./catalog.ts";
import type { Module, Connection, ModuleType } from "./catalog.ts";

// Terminal strips are a logical breakout, not a claim about physical header order.
export function terminalPoint(n: Module, pinId: string) {
  const index = pinSets[n.type].findIndex((p) => p.id === pinId);
  const split = n.type === "esp" ? 22 : Math.ceil(pinSets[n.type].length / 2);
  return {
    x: n.x + (index < split ? 0 : 260),
    y: n.y + 58 + (index % split) * 22,
  };
}

export function Assembly({
  nodes,
  connections,
  selected,
  pending,
  onSelect,
  onMove,
  onPin,
  onWire,
  onAdd,
}: {
  nodes: Module[];
  connections: Connection[];
  selected: number | null;
  pending: string | null;
  onSelect: (id: number) => void;
  onMove: (id: number, x: number, y: number) => void;
  onPin: (key: string) => void;
  onWire: (id: string) => void;
  onAdd: (type: ModuleType, x: number, y: number) => void;
}) {
  const [zoom, setZoom] = useState(0.6);
  const drag = useRef<{
    id: number;
    x: number;
    y: number;
    originX: number;
    originY: number;
  } | null>(null);
  function move(e: PointerEvent) {
    if (!drag.current) return;
    const d = drag.current;
    onMove(
      d.id,
      Math.max(20, Math.min(1140, d.originX + (e.clientX - d.x) / zoom)),
      Math.max(30, Math.min(700, d.originY + (e.clientY - d.y) / zoom)),
    );
  }
  return (
    <section className="bench" aria-label="硬件组装工作台">
      <div className="bench-toolbar">
        <span>ASSEMBLY / 模块组装</span>
        <label>
          缩放{" "}
          <select
            aria-label="画布缩放"
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
          >
            <option value={0.6}>60%</option>
            <option value={0.8}>80%</option>
            <option value={1}>100%</option>
            <option value={1.2}>120%</option>
          </select>
        </label>
      </div>
      <div
        className="bench-scroll"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          const type = e.dataTransfer.getData("pao/module") as ModuleType;
          if (!["esp", "oled", "mic", "speaker", "motor"].includes(type))
            return;
          const r = e.currentTarget.getBoundingClientRect();
          onAdd(
            type,
            (e.clientX - r.left + e.currentTarget.scrollLeft) / zoom,
            (e.clientY - r.top + e.currentTarget.scrollTop) / zoom,
          );
        }}
      >
        <div style={{ width: 1440 * zoom, height: 1250 * zoom }}>
          <div className="circuit" style={{ transform: `scale(${zoom})` }}>
            <svg
              className="wiring"
              width="1440"
              height="1250"
              aria-label="引脚连线"
            >
              {connections.map((c) => {
                const a = resolvePin(nodes, c.a),
                  b = resolvePin(nodes, c.b);
                if (!a || !b) return null;
                const start = terminalPoint(a.node, a.pin.id),
                  end = terminalPoint(b.node, b.pin.id);
                return (
                  <path
                    key={c.id}
                    d={`M${start.x} ${start.y} C${(start.x + end.x) / 2} ${start.y} ${(start.x + end.x) / 2} ${end.y} ${end.x} ${end.y}`}
                    stroke={netColor(nodes, connections, c.a)}
                    onClick={() => onWire(c.id)}
                    role="button"
                    tabIndex={0}
                    aria-label={`选择连线 ${a.pin.name} 到 ${b.pin.name}`}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") onWire(c.id);
                    }}
                  >
                    <title>
                      {a.pin.name} → {b.pin.name}
                    </title>
                  </path>
                );
              })}
            </svg>
            {nodes.map((n) => {
              const part = partFor(n.type);
              const split =
                n.type === "esp" ? 22 : Math.ceil(pinSets[n.type].length / 2);
              return (
                <div
                  key={n.id}
                  className={`hardware-node ${selected === n.id ? "selected" : ""} ${n.type}`}
                  style={{
                    left: n.x,
                    top: n.y,
                    width: 260,
                    height: Math.max(230, 70 + split * 22),
                  }}
                >
                  <button
                    className="module-handle"
                    onClick={() => onSelect(n.id)}
                    onPointerDown={(e) => {
                      if (e.button !== 0) return;
                      onSelect(n.id);
                      drag.current = {
                        id: n.id,
                        x: e.clientX,
                        y: e.clientY,
                        originX: n.x,
                        originY: n.y,
                      };
                      e.currentTarget.setPointerCapture(e.pointerId);
                    }}
                    onPointerMove={move}
                    onPointerUp={() => (drag.current = null)}
                    onPointerCancel={() => (drag.current = null)}
                    aria-label={`移动 ${part.name} #${n.id}`}
                  >
                    <span>U{n.id}</span> {part.name}
                    <small>⠿</small>
                  </button>
                  <img
                    className="physical-part"
                    src={`/modules/${part.image}`}
                    alt={`${part.maker} ${part.model} 实物外观`}
                    draggable={false}
                  />
                  {pinSets[n.type].map((p, i) => {
                    const key = endpoint(n.id, p.id);
                    const used = connections.some(
                      (c) => c.a === key || c.b === key,
                    );
                    return (
                      <button
                        key={p.id}
                        className={`terminal ${i >= split ? "right" : ""} ${pending === key ? "pending" : ""} ${used ? "connected" : ""}`}
                        style={
                          {
                            top: 47 + (i % split) * 22,
                            "--wire": netColor(nodes, connections, key),
                          } as CSSProperties
                        }
                        disabled={p.blocked}
                        aria-label={`U${n.id} ${p.name} ${p.id}`}
                        title={`${p.name} / ${p.id}${p.blocked ? " · 当前板型保留" : ""}`}
                        onClick={() => onPin(key)}
                      >
                        <i />
                        {p.name}
                        {n.type === "esp" && <small>{p.id}</small>}
                      </button>
                    );
                  })}
                  <span className="node-caption">
                    {part.maker} / {part.bus}
                  </span>
                </div>
              );
            })}
            {!nodes.length && (
              <div className="empty-canvas">
                <h2>从一个真实器件开始。</h2>
                <p>点击左侧模块，或拖到这里。</p>
              </div>
            )}
          </div>
        </div>
      </div>
      <div className="bench-status">
        {pending
          ? `已选 ${pending} · 点击目标端子，Esc 取消`
          : "添加模块自动接线 · 点击端子可调整 · 端子面板为逻辑引出，不代表实物针序"}
      </div>
    </section>
  );
}
