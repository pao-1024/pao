import type { Module, Connection, Point, Trace } from "./catalog.ts";
import { partFor } from "./catalog.ts";
import { boardIssues, boardRules, electricalReport, copperSegments, pointDistance, copperComponent, rectDistance } from "./circuit.ts";
import { placedFootprints, boardOutline, antennaSlots } from "./footprints.ts";

type Board = { width: number; height: number };
export function manufacturingDrc(nodes: Module[], connections: Connection[], traces: Trace[], board: Board) {
  const issues = [...electricalReport(nodes, connections).issues, ...boardIssues(nodes, connections, traces, board)];
  for (const c of connections) {
    const count = traces.filter((t) => t.connection === c.id).length;
    if (count !== 1) issues.push(`${c.id}：${count ? "重复铜线" : "网络未布通"}`);
    if (!copperComponent(c.a, connections, traces).has(c.b)) issues.push(`${c.id}：实际铜线未连通目标焊盘`);
  }
  if (traces.length !== connections.length) issues.push("铜线数量与连接数量不一致");
  return { passed: issues.length === 0, issues: [...new Set(issues)], rules: boardRules,
    process: { layers: 2, material: "FR-4", thicknessMm: 1.6, copperOz: 1, finish: "HASL lead-free", mask: "green", assembly: "THT / hand solder" },
    checks: ["电气逻辑与供电负载", "全网络连接及重复铜线", "模块外形与占位", "天线开槽及声孔/USB禁布", "铜线/焊盘净距", "铜到板边及非金属化孔净距", "钻孔尺寸及孔间距", "通孔环宽", "阻焊扩展及阻焊桥"] };
}

export function manufacturingFiles(nodes: Module[], connections: Connection[], traces: Trace[], board: Board): Record<string, string> {
  const drc = manufacturingDrc(nodes, connections, traces, board);
  if (!drc.passed) throw Error(`制造 DRC 未通过：${drc.issues.join("；")}`);
  const fs = placedFootprints(nodes), pads = [...fs.flatMap((f) => f.pads), ...traces.flatMap((t) => (t.vias || []).map((v) => ({ ...v, diameter: boardRules.viaDiameter, drill: boardRules.viaDrill })))], holes = fs.flatMap((f) => f.holes);
  const outline = boardOutline(nodes, board);
  const lines = (p: Point[]) => p.slice(1).map((b, i) => [p[i], b] as const);
  const xy = (p: Point) => `X${Math.round(p.x * 1e6)}Y${Math.round((board.height - p.y) * 1e6)}`;
  const num = (v: number) => v.toFixed(6);
  function gerber(fn: string, strokes: { a: Point; b: Point; width: number }[], flashes: { at: Point; diameter: number }[]) {
    const sizes = [...new Set([...strokes.map((s) => s.width), ...flashes.map((f) => f.diameter)])].sort((a, b) => a - b);
    const tool = (d: number) => `D${10 + sizes.indexOf(d)}*`;
    return [`G04 PAO Studio - millimetres - bottom left origin*`, `%TF.FileFunction,${fn}*%`, `%TF.FilePolarity,${fn.startsWith("Soldermask") ? "Negative" : "Positive"}*%`, "%FSLAX46Y46*%", "%MOMM*%", "%LPD*%",
      ...sizes.map((d, i) => `%ADD${10 + i}C,${num(d)}*%`), "G01*",
      ...strokes.flatMap((s) => [tool(s.width), `${xy(s.a)}D02*`, `${xy(s.b)}D01*`]),
      ...flashes.flatMap((f) => [tool(f.diameter), `${xy(f.at)}D03*`]), "M02*", ""].join("\n");
  }
  const files: Record<string, string> = {};
  for (const [layer, ext, fn] of [["F.Cu", "gtl", "Copper,L1,Top"], ["B.Cu", "gbl", "Copper,L2,Bot"]]) {
    const strokes = traces.flatMap((t) => copperSegments(nodes, connections.find((c) => c.id === t.connection)!, t).filter((s) => s.layer === layer).map(({ a, b }) => ({ a, b, width: t.width })));
    files[`pao.${ext}`] = gerber(fn, strokes, pads.map((p) => ({ at: p, diameter: p.diameter })));
  }
  for (const [ext, fn] of [["gts", "Soldermask,Top"], ["gbs", "Soldermask,Bot"]])
    files[`pao.${ext}`] = gerber(fn, [], pads.map((p) => ({ at: p, diameter: p.diameter + 2 * boardRules.maskExpansion })));
  files["pao.gm1"] = gerber("Profile,NP", lines(outline).map(([a, b]) => ({ a, b, width: 0.05 })), []);

  // Silk has actual strokes, not comments pretending to be text; omit any stroke crossing a mask opening or hole.
  const glyphs: Record<string, number[]> = { "0": [0, 1, 2, 3, 4, 5], "1": [1, 2], "2": [0, 1, 6, 4, 3], "3": [0, 1, 6, 2, 3], "4": [5, 6, 1, 2], "5": [0, 5, 6, 2, 3], "6": [0, 5, 6, 4, 2, 3], "7": [0, 1, 2], "8": [0, 1, 2, 3, 4, 5, 6], "9": [0, 1, 2, 3, 5, 6], U: [1, 2, 3, 4, 5] };
  const segs = [[[0, 0], [1, 0]], [[1, 0], [1, 1]], [[1, 1], [1, 2]], [[1, 2], [0, 2]], [[0, 2], [0, 1]], [[0, 1], [0, 0]], [[0, 1], [1, 1]]];
  const silk = fs.flatMap((f) => {
    const r = f.body;
    return [...lines([{ x: r.x, y: r.y }, { x: r.x + r.width, y: r.y }, { x: r.x + r.width, y: r.y + r.height }, { x: r.x, y: r.y + r.height }, { x: r.x, y: r.y }]),
      ...`U${f.id}`.split("").flatMap((ch, i) => (glyphs[ch] || []).map((s) => segs[s].map(([x, y]) => ({ x: r.x + 3 + i * 1.5 + x, y: r.y + 5 + y })) as [Point, Point]))];
  }).filter(([a, b]) => [a, b].every((p) => p.x > 0.5 && p.y > 0.5 && p.x < board.width - 0.5 && p.y < board.height - 0.5) &&
    !antennaSlots(nodes).some((r) => rectDistance(a, b, r) < 0.225) &&
    !pads.some((p) => pointDistance(p, a, b) < p.diameter / 2 + boardRules.maskExpansion + 0.225) && !holes.some((h) => pointDistance(h, a, b) < h.drill / 2 + 0.225));
  files["pao.gto"] = gerber("Legend,Top", silk.map(([a, b]) => ({ a, b, width: 0.15 })), []);
  function drill(points: (Point & { drill: number })[], plated: boolean) {
    const sizes = [...new Set(points.map((p) => p.drill))].sort((a, b) => a - b);
    return ["M48", `;TYPE=${plated ? "PLATED" : "NON_PLATED"}`, ";FILE_FORMAT=4:6", "METRIC,TZ", "G90", ...sizes.map((d, i) => `T${i + 1}C${num(d)}`), "%", "G05",
      ...sizes.flatMap((d, i) => [`T${i + 1}`, ...points.filter((p) => p.drill === d).map((p) => `X${num(p.x)}Y${num(board.height - p.y)}`)]), "M30", ""].join("\n");
  }
  files["pao-PTH.drl"] = drill(pads, true);
  files["pao-NPTH.drl"] = drill(holes, false);
  files["drc.json"] = JSON.stringify(drc, null, 2);
  files["footprints.json"] = JSON.stringify(fs, null, 2);
  files["pcb.json"] = JSON.stringify({ board, nodes, connections, traces }, null, 2);
  const quote = (s: string) => `"${s.replaceAll('"', '""')}"`;
  files["assembly-bom.csv"] = ["Reference,Device,PCB_footprint,Assembly,Source", ...fs.map((f) => [`U${f.id}`, partFor(f.type).model, f.name, f.assembly, f.source].map(quote).join(","))].join("\n");
  const esc = (s: string) => s.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll('"', "&quot;");
  files["assembly.svg"] = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-4 -4 ${board.width + 8} ${board.height + 8}" width="${board.width}mm" height="${board.height}mm"><rect x="-4" y="-4" width="${board.width + 8}" height="${board.height + 8}" fill="white"/><polyline points="${outline.map((p) => `${p.x},${p.y}`).join(" ")}" stroke="black" fill="none" stroke-width="0.15"/>${fs.map((f) => `<g><rect x="${f.body.x}" y="${f.body.y}" width="${f.body.width}" height="${f.body.height}" fill="none" stroke="#555" stroke-width="0.15"/><text x="${f.body.x + 1}" y="${f.body.y + 4}" font-size="2">U${f.id} ${f.type}</text>${f.pads.map((p) => `<circle cx="${p.x}" cy="${p.y}" r="${p.diameter / 2}" fill="none" stroke="black" stroke-width="0.15"/><text x="${p.x + 1}" y="${p.y - 1}" font-size="1.2">${esc(p.pin)}</text>`).join("")}${f.holes.map((h) => `<circle cx="${h.x}" cy="${h.y}" r="${h.drill / 2}" fill="none" stroke="black" stroke-width="0.15"/>`).join("")}</g>`).join("")}</svg>`;
  files["FABRICATION.txt"] = `PAO Studio / two-layer module PCB\nBoard bounding box: ${board.width} x ${board.height} mm; use closed GM1 profile with antenna edge slot.\nFR-4 1.6mm / 1oz copper / green solder mask / lead-free HASL / white top legend.\nCoordinates: Gerber and Excellon use mm, bottom-left origin; bottom layers are NOT mirrored.\nPTH finished holes 1.0/1.3mm; NPTH finished holes 2.7mm. Hole sizes are finished dimensions.\nNo solder paste: this board is assembled by hand using through-hole modules and connectors.\nInspect assembly.svg and assembly-bom.csv for part revision, sockets, standoffs and polarity.\nGerber files describe the host PCB, not the internal circuitry of purchased modules.\nOnly export with drc.json passed=true; check final factory CAM preview before ordering.\nAdafruit mechanical data: designed by Limor Fried/Ladyada for Adafruit Industries, CC BY-SA. Source URLs and pinned revisions in footprints.json.\nKiCad connector geometry: KiCad libraries CC-BY-SA-4.0 with library exception.\n`;
  return files;
}

// ZIP STORE is supported in browsers without native zip APIs and preserves text bytes exactly.
export function manufacturingZip(files: Record<string, string>): Uint8Array {
  const chunks: Uint8Array[] = [], central: Uint8Array[] = []; let offset = 0;
  const make = (size: number) => { const data = new Uint8Array(size); return { data, view: new DataView(data.buffer) }; };
  for (const [name, text] of Object.entries(files)) {
    const path = new TextEncoder().encode(name), body = new TextEncoder().encode(text);
    let crc = 0xffffffff;
    for (const byte of body) { crc ^= byte; for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0); }
    crc = (crc ^ 0xffffffff) >>> 0;
    const h = make(30 + path.length); h.view.setUint32(0, 0x04034b50, true); h.view.setUint16(4, 20, true); h.view.setUint16(6, 0x800, true); h.view.setUint16(12, 33, true);
    h.view.setUint32(14, crc, true); h.view.setUint32(18, body.length, true); h.view.setUint32(22, body.length, true); h.view.setUint16(26, path.length, true); h.data.set(path, 30);
    const c = make(46 + path.length); c.view.setUint32(0, 0x02014b50, true); c.view.setUint16(4, 20, true); c.view.setUint16(6, 20, true); c.view.setUint16(8, 0x800, true); c.view.setUint16(14, 33, true);
    c.view.setUint32(16, crc, true); c.view.setUint32(20, body.length, true); c.view.setUint32(24, body.length, true); c.view.setUint16(28, path.length, true); c.view.setUint32(42, offset, true); c.data.set(path, 46);
    chunks.push(h.data, body); central.push(c.data); offset += h.data.length + body.length;
  }
  const size = central.reduce((n, c) => n + c.length, 0), end = make(22);
  end.view.setUint32(0, 0x06054b50, true); end.view.setUint16(8, central.length, true); end.view.setUint16(10, central.length, true); end.view.setUint32(12, size, true); end.view.setUint32(16, offset, true);
  const zip = new Uint8Array(offset + size + 22); let at = 0;
  for (const chunk of [...chunks, ...central, end.data]) { zip.set(chunk, at); at += chunk.length; }
  return zip;
}
