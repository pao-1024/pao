import { spawn, type ChildProcess } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { createHash } from "node:crypto";
import { firmwareProject } from "./src/firmware.ts";
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
  let project: { id: string; key: string; spec: ReturnType<typeof firmwareProject>["spec"]; ready: boolean } | null = null;
  const append = (data: unknown) => { log = (log + String(data)).slice(-48000); };
  function stop() {
    if (!child?.pid) return;
    state = "stopping";
    // Interrupt the entire task tree, allowing the emulator to persist flash.
    try { process.kill(-child.pid, "SIGINT"); }
    catch (error) { append(`\n${error}\n`); }
  }
  function run(action: "prepare" | "start" | "build" | "project", directory?: string) {
    log = "";
    state = action === "prepare" || action === "build" ? "preparing" : "starting";
    mkdirSync(resolve(root, "tmp/temp"), { recursive: true });
    child = spawn(action === "prepare" ? "task" : action === "build" ? "bash" : "python3",
      action === "prepare" ? ["simulator:prepare"] : action === "build" ? ["platform/build-project.sh", directory!] :
        action === "project" ? ["simulator/run-project.py", directory!] : ["simulator/run-esp32sim.py"], {
        cwd: root, detached: true, stdio: ["ignore", "pipe", "pipe"],
        env: { ...process.env, TMPDIR: resolve(root, "tmp/temp"),
          PYTHONPYCACHEPREFIX: resolve(root, "tmp/pycache"), PYTHONUNBUFFERED: "1" },
      });
    child.stdout?.on("data", append);
    child.stderr?.on("data", append);
    child.on("error", (error) => { append(error); state = "failed"; });
    child.on("close", (code, signal) => {
      if (action === "build" && project) {
        project.ready = code === 0 && state !== "stopping";
        if (project.ready) writeFileSync(resolve(directory!, "ready.json"), JSON.stringify({ key: project.key }));
      }
      state = state === "stopping" ? "idle" : code === 0 ? "idle" : "failed";
      append(`\n进程结束：${code ?? signal}\n`);
      child = undefined;
    });
  }
  function generate(value: unknown) {
    const generated = firmwareProject(value);
    const files: Record<string, string> = {};
    for (const name of ["CMakeLists.txt", "sdkconfig.defaults", "main/CMakeLists.txt", "main/main.cpp"])
      files[name] = readFileSync(resolve(root, "platform/firmware", name), "utf8");
    files["main/wiring.h"] = generated.header;
    files["main/motor.cc"] = readFileSync(resolve(root, "firmware/components/pao/motor.cc"), "utf8");
    files["main/motor.h"] = readFileSync(resolve(root, "firmware/components/pao/include/motor.h"), "utf8");
    files["board.json"] = JSON.stringify(generated.spec, null, 2);
    const key = JSON.stringify(generated.design);
    const id = createHash("sha256").update(JSON.stringify(files)).update(key).digest("hex");
    return { files, key, id, spec: generated.spec };
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
      return send(200, { state, log, active: !!child, artifacts: artifacts(), project });
    if (req.method !== "POST") return send(405, { error: "Method not allowed" });
    if (req.url === "/api/runtime/stop") { stop(); return send(200, { state }); }
    if (!["/api/runtime/prepare", "/api/runtime/start", "/api/runtime/build", "/api/runtime/project", "/api/runtime/source"].includes(req.url))
      return send(404, { error: "Unknown runtime action" });
    if ((child && req.url !== "/api/runtime/source") || busy) return send(409, { error: "已有构建或运行任务，请先停止或等待结束" });
    busy = true;
    try {
      let generated: ReturnType<typeof generate> | undefined;
      if (["/api/runtime/build", "/api/runtime/project", "/api/runtime/source"].includes(req.url)) {
        let body = "";
        for await (const chunk of req) {
          body += chunk.toString();
          if (body.length > 64000) return send(413, { error: "设计请求超过 64 KB" });
        }
        try { generated = generate(JSON.parse(body)); }
        catch (error) { return send(422, { error: String(error) }); }
        if (req.url === "/api/runtime/source") return send(200, generated);
      }
      if (await occupied(8080) || await occupied(8081))
        return send(409, { error: "8080 / 8081 已被其他服务占用；请先关闭该服务，工作台不会接管或终止它" });
      if (generated) {
        const directory = resolve(root, "tmp/studio", generated.id);
        if (req.url === "/api/runtime/build") {
          mkdirSync(resolve(directory, "main"), { recursive: true });
          rmSync(resolve(directory, "ready.json"), { force: true });
          for (const [name, contents] of Object.entries(generated.files)) writeFileSync(resolve(directory, name), contents);
          project = { id: generated.id, key: generated.key, spec: generated.spec, ready: false };
          run("build", directory);
        } else {
          if (!existsSync(resolve(directory, "ready.json")) || !existsSync(resolve(directory, "build/studio.elf")))
            return send(409, { error: "当前接线尚未成功编译，请重新生成并编译" });
          if (!artifacts().emulator) return send(409, { error: "缺少模拟器，请先准备环境" });
          project = { id: generated.id, key: generated.key, spec: generated.spec, ready: true };
          run("project", directory);
        }
      } else { project = null; run(req.url.endsWith("prepare") ? "prepare" : "start"); }
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
