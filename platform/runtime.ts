import { spawn, type ChildProcess } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { createHash } from "node:crypto";
import { firmwareProject } from "./src/firmware.ts";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createConnection } from "node:net";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { Plugin } from "vite";
import { agentModel, agentProvider, generateApplication, iterateApplication, verifyApplication, type AgentProgress } from "./agent.ts";
import { agentApi } from "./src/agent-spec.ts";

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
  let agent: (AgentProgress & { designKey: string }) | null = null;
  let agentController: AbortController | undefined;
  let stopTimer: ReturnType<typeof setTimeout> | undefined;
  let project: { id: string; key: string; spec: ReturnType<typeof firmwareProject>["spec"]; ready: boolean } | null = null;
  const append = (data: unknown) => { log = (log + String(data)).slice(-48000); };
  function stop() {
    if (!child?.pid) return;
    const current = child;
    state = "stopping";
    // Interrupt the entire task tree, allowing the emulator to persist flash.
    try { process.kill(-child.pid, "SIGINT"); }
    catch (error) { append(`\n${error}\n`); }
    stopTimer ??= setTimeout(() => {
      if (child === current && current.pid) {
        try { process.kill(-current.pid, "SIGKILL"); } catch (error) { append(`\n${error}\n`); }
      }
    }, 3000);
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
    const timeout = action === "build" ? setTimeout(() => { append("\n编译超过 5 分钟，已停止\n"); stop(); }, 300000) : undefined;
    return new Promise<boolean>((done) => child!.on("close", (code, signal) => {
      clearTimeout(timeout);
      clearTimeout(stopTimer); stopTimer = undefined;
      if (action === "build" && project) {
        project.ready = code === 0 && state !== "stopping";
        if (project.ready) writeFileSync(resolve(directory!, "ready.json"), JSON.stringify({ key: project.key }));
      }
      state = state === "stopping" ? "idle" : code === 0 ? "idle" : "failed";
      append(`\n进程结束：${code ?? signal}\n`);
      child = undefined;
      done(code === 0 && state !== "failed");
    }));
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
    if (generated.design.application.kind === "agent")
      files["main/agent-app.h"] = `// Business API:\n${agentApi.split("\n").map((s) => `// ${s}`).join("\n")}\n${generated.design.application.source}\n`;
    const key = JSON.stringify(generated.design);
    const id = createHash("sha256").update(JSON.stringify(files)).update(key).digest("hex");
    return { files, key, id, spec: generated.spec };
  }
  function writeProject(generated: ReturnType<typeof generate>) {
    const directory = resolve(root, "tmp/studio", generated.id);
    mkdirSync(resolve(directory, "main"), { recursive: true });
    rmSync(resolve(directory, "ready.json"), { force: true });
    for (const [name, contents] of Object.entries(generated.files)) writeFileSync(resolve(directory, name), contents);
    project = { id: generated.id, key: generated.key, spec: generated.spec, ready: false };
    return directory;
  }
  async function stopAndWait() {
    const current = child;
    if (!current) return;
    const ended = new Promise<void>((done) => current.once("close", () => done()));
    stop();
    await ended;
  }
  async function startAgent(value: { nodes: unknown; connections: unknown; prompt: string }) {
    const controller = new AbortController(); agentController = controller;
    const design = firmwareProject({ ...value, application: { kind: "diagnostic" } }).design;
    const designKey = JSON.stringify({ nodes: design.nodes, connections: design.connections });
    const directory = resolve(root, "tmp/agent", createHash("sha256").update(value.prompt + Date.now()).digest("hex"));
    const update = (progress: AgentProgress) => { agent = { ...progress, designKey }; };
    update({ phase: "generating", attempt: 1, log: "" });
    try {
      mkdirSync(directory, { recursive: true });
      await iterateApplication({ prompt: value.prompt, signal: controller.signal, update,
        generate: (feedback) => generateApplication(directory, value.prompt, firmwareProject(design).spec, feedback, controller.signal),
        build: async (application) => {
          controller.signal.throwIfAborted();
          const target = writeProject(generate({ ...design, application }));
          if (!await run("build", target)) throw Error(`编译失败：${log}`);
        },
        verify: async (application) => {
          controller.signal.throwIfAborted();
          const generated = generate({ ...design, application });
          const target = resolve(root, "tmp/studio", generated.id);
          void run("project", target);
          try { return await verifyApplication(generated.spec, application, controller.signal); }
          catch (error) { throw Error(`${error}\n模拟器日志：${log.slice(-10000)}`); }
          finally { await stopAndWait(); }
        },
      });
    } catch (error) {
      if (agent) agent = { ...agent, phase: controller.signal.aborted ? "cancelled" : "failed", error: String(error) };
    } finally { await stopAndWait(); agentController = undefined; }
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
      return send(200, { state, log, active: !!child || !!agentController, artifacts: artifacts(), project, agent, agentModel, agentProvider });
    if (req.method !== "POST") return send(405, { error: "Method not allowed" });
    if (req.url === "/api/runtime/stop") { agentController?.abort(); stop(); return send(200, { state }); }
    if (!["/api/runtime/prepare", "/api/runtime/start", "/api/runtime/build", "/api/runtime/project", "/api/runtime/source", "/api/runtime/agent"].includes(req.url))
      return send(404, { error: "Unknown runtime action" });
    if (((child || agentController) && req.url !== "/api/runtime/source") || busy) return send(409, { error: "已有构建或运行任务，请先停止或等待结束" });
    busy = true;
    try {
      let generated: ReturnType<typeof generate> | undefined;
      let agentRequest: { nodes: unknown; connections: unknown; prompt: string } | undefined;
      if (["/api/runtime/build", "/api/runtime/project", "/api/runtime/source", "/api/runtime/agent"].includes(req.url)) {
        let body = "";
        for await (const chunk of req) {
          body += chunk.toString();
          if (body.length > 64000) return send(413, { error: "设计请求超过 64 KB" });
        }
        try {
          const value = JSON.parse(body);
          if (req.url === "/api/runtime/agent") {
            if (typeof value.prompt !== "string" || !value.prompt.trim() || value.prompt.length > 4000) throw Error("请输入 1–4000 字的业务需求");
            generated = generate({ ...value, application: { kind: "diagnostic" } });
            agentRequest = { nodes: value.nodes, connections: value.connections, prompt: value.prompt };
          } else generated = generate(value);
        }
        catch (error) { return send(422, { error: String(error) }); }
        if (req.url === "/api/runtime/source") return send(200, generated);
      }
      if (await occupied(8080) || await occupied(8081))
        return send(409, { error: "8080 / 8081 已被其他服务占用；请先关闭该服务，工作台不会接管或终止它" });
      if (agentRequest) {
        if (!artifacts().emulator || !existsSync(resolve(root, "tmp/esp-idf/export.sh"))) return send(409, { error: "请先准备本地仿真环境" });
        void startAgent(agentRequest);
        return send(202, { state: "generating" });
      }
      if (generated) {
        const directory = resolve(root, "tmp/studio", generated.id);
        if (req.url === "/api/runtime/build") {
          writeProject(generated);
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
      const shutdown = () => { agentController?.abort(); stop(); };
      process.once("exit", shutdown);
      server.httpServer?.once("close", () => { process.removeListener("exit", shutdown); shutdown(); });
    },
    configurePreviewServer(server) {
      server.middlewares.use(handle);
      const shutdown = () => { agentController?.abort(); stop(); };
      process.once("exit", shutdown);
      server.httpServer.once("close", () => { process.removeListener("exit", shutdown); shutdown(); });
    },
  };
}
