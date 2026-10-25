import { spawn, type ChildProcess } from "node:child_process";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createConnection } from "node:net";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { Plugin } from "vite";

const root = fileURLToPath(new URL("../", import.meta.url));
export function allowedRequest(req: IncomingMessage) {
  const host = req.headers.host || "";
  if (!/^127\.0\.0\.1:\d+$/.test(host)) return false;
  return req.method === "GET" ||
    (req.headers.origin === `http://${host}` && req.headers["x-pao-studio"] === "1");
}

function occupied(port: number): Promise<boolean> {
  return new Promise((done) => {
    const socket = createConnection({ host: "127.0.0.1", port });
    socket.setTimeout(1000);
    socket.once("connect", () => { socket.destroy(); done(true); });
    socket.once("error", () => done(false));
    socket.once("timeout", () => { socket.destroy(); done(true); });
  });
}

export function runtimePlugin(): Plugin {
  let child: ChildProcess | undefined;
  let state = "idle", log = "", busy = false;
  const append = (data: unknown) => { log = (log + String(data)).slice(-48000); };
  function stop() {
    if (!child?.pid) return;
    state = "stopping";
    // Interrupt the entire task tree, allowing the emulator to persist flash.
    try { process.kill(-child.pid, "SIGINT"); }
    catch (error) { append(`\n${error}\n`); }
  }
  function run(action: "prepare" | "start") {
    log = "";
    state = action === "prepare" ? "preparing" : "starting";
    mkdirSync(resolve(root, "tmp/temp"), { recursive: true });
    child = spawn(action === "prepare" ? "task" : "python3",
      action === "prepare" ? ["simulator:prepare"] : ["simulator/run-esp32sim.py"], {
        cwd: root, detached: true, stdio: ["ignore", "pipe", "pipe"],
        env: { ...process.env, TMPDIR: resolve(root, "tmp/temp"),
          PYTHONPYCACHEPREFIX: resolve(root, "tmp/pycache"), PYTHONUNBUFFERED: "1" },
      });
    child.stdout?.on("data", append);
    child.stderr?.on("data", append);
    child.on("error", (error) => { append(error); state = "failed"; });
    child.on("close", (code, signal) => {
      state = state === "stopping" ? "idle" : code === 0 ? "idle" : "failed";
      append(`\n进程结束：${code ?? signal}\n`);
      child = undefined;
    });
  }
  function artifacts() {
    let firmware = false;
    try {
      const revision = JSON.parse(readFileSync(resolve(root, "tmp/base-revision.json"), "utf8"));
      if (/^[a-f0-9]{40}$/.test(revision.commit))
        firmware = existsSync(resolve(root, "tmp/build", revision.commit, "xiaozhi.elf"));
    } catch { /* A clean checkout has no firmware build yet. */ }
    return { firmware, emulator: existsSync(resolve(root, "tmp/esp32sim-build/release/pao-sim")),
      web: existsSync(resolve(root, "tmp/simulator-web/run.html")) };
  }
  async function handle(req: IncomingMessage, res: ServerResponse, next: () => void) {
    if (!req.url?.startsWith("/api/runtime")) return next();
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Cache-Control", "no-store");
    const send = (code: number, data: unknown) => { res.statusCode = code; res.end(JSON.stringify(data)); };
    if (!allowedRequest(req)) return send(403, { error: "Only same-origin local studio requests are accepted" });
    if (req.method === "GET" && req.url === "/api/runtime")
      return send(200, { state, log, active: !!child, artifacts: artifacts() });
    if (req.method !== "POST") return send(405, { error: "Method not allowed" });
    if (req.url === "/api/runtime/stop") { stop(); return send(200, { state }); }
    if (!["/api/runtime/prepare", "/api/runtime/start"].includes(req.url))
      return send(404, { error: "Unknown runtime action" });
    if (child || busy) return send(409, { error: "已有构建或运行任务，请先停止或等待结束" });
    busy = true;
    try {
      if (await occupied(8080) || await occupied(8081))
        return send(409, { error: "8080 / 8081 已被其他服务占用；请先关闭该服务，工作台不会接管或终止它" });
      run(req.url.endsWith("prepare") ? "prepare" : "start");
      send(202, { state });
    } catch (error) { send(500, { error: String(error) }); }
    finally { busy = false; }
  }
  return {
    name: "pao-local-runtime",
    configureServer(server) {
      server.middlewares.use(handle);
      process.once("exit", stop);
      server.httpServer?.once("close", () => { process.removeListener("exit", stop); stop(); });
    },
    configurePreviewServer(server) {
      server.middlewares.use(handle);
      process.once("exit", stop);
      server.httpServer.once("close", () => { process.removeListener("exit", stop); stop(); });
    },
  };
}
