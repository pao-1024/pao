---
theme: default
title: PAO · 探索 Agent 时代的硬件开发新范式
info: 2026 1024 Hackathon · 万物皆代码，评估驱动硬件开发闭环
class: slide-light slide-cover
aspectRatio: 16/9
canvasWidth: 1280
fonts:
  sans: Noto Sans CJK SC
  mono: DejaVu Sans Mono
  local: sans
---

<div class="eyebrow">PAO / 2026 1024 HACKATHON</div>
<div class="hero-copy">
  <h1>探索 Agent 时代的<br><em>硬件开发新范式</em></h1>
  <p>用代码定义工程，用评估驱动迭代。<br>让 Agent 贯穿设计、编译、仿真与修复。</p>
  <p><b>PAO = PAO Aims Ordnance</b></p>
</div>
<div class="hero-art">
  <div class="hero-source"><span>&lt;Hardware /&gt;</span><span>firmware.bin</span><span>evaluate(result)</span></div>
  <img src="/reference/simulator-overview.png" alt="PAO 正式固件在 esp32sim 中运行的页面" />
  <div class="artifact-caption">PAO · 语音小车验证产品</div>
</div>
<div class="bottom-note">万物皆代码 / 评估驱动闭环 / 对固件透明的芯片级仿真</div>
<div class="page-number">01 / 16</div>

<!--
建议 25 秒。开场：我们的项目叫 PAO，就是“炮”，全称 PAO Aims Ordnance，Ordnance 是火炮。它是一台听语音、能开炮的小车。我们正在探索 Agent 时代的硬件开发新范式。用代码定义工程，用评估驱动迭代，让 Agent 贯穿设计、编译、仿真与修复。把电路、嵌入式软件与机械结构表达为可操作的工程，把验收标准变成可执行的评估函数，Agent 就能自己生成、运行、检查，再根据失败证据修复。PAO 是验证这套流程的产品，Studio 的平台化方向放在实机展示后介绍。
-->

---
class: slide-light slide-source
---

<div class="eyebrow">FOUNDATION / 三类核心设计</div>
<h1>万物皆代码，<br><em>驱动全流程 Agent 自动化。</em></h1>
<div class="source-columns">
  <div class="source-card"><span class="type-label">电路设计</span><h2>tscircuit</h2><p>定义器件、引脚与网络</p><code>TSX → SVG / Circuit JSON<br>评估：连通性测试 / 电气规则</code></div>
  <div class="source-card"><span class="type-label">嵌入式软件</span><h2>ESP-IDF + esp32sim</h2><p>在芯片模型中运行正式固件</p><code>固件源码 → firmware.bin<br>评估：业务状态 / 外设实际输出</code></div>
  <div class="source-card"><span class="type-label">机械结构设计</span><h2>Blender</h2><p>外壳、底盘、支架与装配</p><code>当前研发：Blender 工作流<br>评估：几何检查 / 刚体动力学</code></div>
</div>
<div class="takeaway">全代码化，让电路与机械结构也能按软件工程的方式管理。</div>
<div class="bottom-note">连这份演示稿也是代码：presentation/slides.md · Slidev / Markdown</div>
<div class="page-number">02 / 16</div>

<!--
建议 35 秒。硬件研发围绕三类核心设计：电路、嵌入式软件与机械结构。仿真、测试和评估是贯穿三者的反馈机制，不是额外的一类设计。
电路用 tscircuit 表达器件和网络，以连通性和电气规则检查；软件由 ESP-IDF 构建，在 esp32sim 中执行正式固件，以业务状态和外设输出评估；机械结构由 Agent 驱动 Blender 建模，以几何检查与刚体动力学评估。全代码化也让电路与机械结构沿用版本控制、PR 审查与自动检查，下一页展开。
来源：hardware/index.tsx；experimental/platform/README.md；simulator/README.md。
-->

---
class: slide-light slide-assets
---

<div class="eyebrow">HARDWARE ASSETS / 设计、实现与验收一起版本化</div>
<h1>硬件工程资产，<br><em>可追溯、可复用、可重建。</em></h1>
<div class="assets-body">
  <div class="asset-repository">
    <span class="detail-label">当前仓库里的硬件工程资产</span>
    <div><b>电路与图纸</b><code>hardware/index.tsx<br>hardware/schematic.svg</code></div>
    <div><b>固件与配置</b><code>firmware/boards/pao/<br>firmware/base.json</code></div>
    <div><b>仿真与依赖</b><code>simulator/pao-sim/src/<br>simulator/pao-sim/Cargo.lock</code></div>
    <div><b>测试与规则</b><code>hardware/test/connectivity.test.ts<br>experimental/platform/runtime.test.mjs</code></div>
  </div>
  <div class="asset-benefits">
    <div><h2>可追溯</h2><p>改动关联版本与审查记录。</p></div>
    <div><h2>可复用</h2><p>模块、驱动、模型与验收规则。</p></div>
    <div><h2>可重建</h2><p>保留源码、依赖与构建入口。</p></div>
  </div>
</div>
<div class="page-number">03 / 16</div>

<!--
建议 35 秒。把软件工程的版本管理延伸到硬件工程：电路设计、固件配置、仿真模型与验收规则一起版本化，每次迭代都留下差异和原因，模块与测试也能在后续项目中复用。页面列出当前仓库已跟踪的真实文件，依赖通过 firmware/base.json、Cargo.lock、pnpm-lock.yaml 和 esp32sim gitlink 固定。
可重建指保留重建依据与入口，不承诺逐字节可复现。Blender 资产可沿用同一方式，当前尚未在本仓库落地。
来源：hardware/、firmware/base.json、simulator/pao-sim/、experimental/platform/、.gitignore。
-->

---
class: slide-light slide-review
---

<div class="eyebrow">HARDWARE COLLABORATION / 软件协作方式用于硬件</div>
<h1>硬件变更进入 PR，<br><em>电路与固件一起审查。</em></h1>
<div class="review-graphic"><img src="/pr-review.svg" alt="硬件变更提交 PR，由工具检查和人工审查共同提供依据，再决定合并并保留版本记录" /></div>
<div class="review-evidence">
  <div class="review-diff"><span class="detail-label">真实变更 · 新增超声波接线</span><a href="https://github.com/pao-1024/pao/pull/36/files" target="_blank" rel="noopener noreferrer">PR #36 · 9966479 · Controller.tsx ↗</a><code>+ GPIO8: nets.ultrasonic.trig.selector,<br>+ GPIO9: nets.ultrasonic.echo.selector,</code><p>接线与驱动、图纸、测试同一 PR 审查。</p></div>
  <div class="review-ci"><span class="detail-label">Hardware CI · 已配置的自动检查</span><span class="review-source">hardware/Taskfile.yaml · task test</span><code>node --test test/connectivity.test.ts<br>cmp dist/index/schematic.svg schematic.svg</code><p>检查连接关系，确认图纸与提交版本一致。</p></div>
</div>
<div class="page-number">04 / 16</div>

<!--
建议 40 秒。这里的价值是把 Git、PR 和持续集成延伸到硬件工程：接线、图纸、驱动和验收规则在同一个 PR 中审查。Agent 提交变更，工具执行已有检查，人审设计意图、约束与证据，再决定是否合并。发生问题时可回溯工程版本。
左侧来自 PR #36 的提交 99664793053145a98f8d7cd5adfa66f77db139f9：Controller.tsx 新增 GPIO8 的 Trig 与 GPIO9 的 Echo，并同步硬件、固件、图纸与说明。右侧命令来自 hardware/Taskfile.yaml，Hardware workflow 在 pull_request 上按路径触发 task test。这里展示的是检查配置，不代表所有 CI 已通过，也不代表已设置强制合并门禁。
来源：.github/workflows/{hardware,firmware,simulator,platform}.yml；hardware/Taskfile.yaml；PR #36。
-->

---
class: slide-light slide-loop
---

<div class="eyebrow">EVALUATION / 评估函数</div>
<h1>评估函数，决定 Agent<br><em>能否自己完成闭环。</em></h1>
<div class="loop-graphic"><img src="/agent-loop.svg" alt="Agent 生成候选工程，经工具执行和评估后，成功保留产物，失败携带证据返回修复" /></div>
<div class="loop-rules"><div><b>知道何时完成</b><span>需求变成可执行的通过条件</span></div><div><b>知道哪里要改</b><span>返回具体偏差</span></div><div><b>知道修复是否有效</b><span>修改后重跑同一验收</span></div></div>
<div class="page-number">05 / 16</div>

<!--
建议 45 秒。代码生成之后，谁来判断它是否做对？评估函数把需求变成可执行条件，读取工程和运行结果，给出通过结论或具体偏差。Agent 才能知道什么时候停止、哪里需要修改，以及修改是否有效。
评估函数包括规则检查、单元测试、编译结果与仿真断言。不能只让生成模型自己说完成；规则与工具结果提供独立反馈。原型中的第一份有效验收场景由模型提出，之后修复时固定，当前最多三轮；仍需人核对场景是否充分表达需求。
接下来展开电路、固件运行和机械结构。来源：experimental/platform/agent.ts 的 iterateApplication 与 runtime.test.mjs 中防止弱化验收的测试。
-->

---
class: slide-light slide-circuit-source
---

<div class="eyebrow">电路设计 / tscircuit</div>
<h1>电路设计，<em>用代码定义每条连接。</em></h1>
<div class="circuit-source-body">
  <div class="circuit-code-panel">
    <span class="detail-label">设计源码 · OLED 模块</span>
    <span class="code-source">hardware/sections/Display.tsx</span>
    <pre v-pre><code>&lt;OledModule
  doNotPlace
  name="OLED"
  connections={{
    SDA: nets.display.sda.selector,
    SCL: nets.display.scl.selector,
    VCC: nets.power.v3v3.selector,
    GND: nets.power.gnd.selector,
  }}
/&gt;</code></pre>
    <span class="code-excerpt">节选，省略绘图分区与坐标</span>
  </div>
  <figure class="circuit-generated">
    <span class="detail-label">生成图纸 · 同一个 OLED 模块</span>
    <a href="/reference/pao-schematic.svg" target="_blank" rel="noopener noreferrer"><svg viewBox="267 358 130 52" role="img" aria-label="由左侧 OLED 代码生成的真实原理图局部，含 V3V3、GND、OLED_SDA 和 OLED_SCL"><image href="/reference/pao-schematic.svg" width="1200" height="600" /></svg></a>
    <figcaption><p>OLED_SDA ↔ GPIO41<br>OLED_SCL ↔ GPIO42</p><span>Controller.tsx 将主控引脚接入同名网络。</span></figcaption>
  </figure>
</div>
<div class="page-number">06 / 16</div>

<!--
建议 30 秒。左边是 Display.tsx 中真实的 OLED 模块定义，只省略绘图分区与坐标；右边是 tscircuit 生成的原始 SVG 局部。代码定义器件、引脚和四条网络连接，图纸由这些设计输入生成。
nets.ts 将 nets.display.sda 和 scl 定义为 OLED_SDA 与 OLED_SCL；Controller.tsx 把 GPIO41、GPIO42 接入相同网络。图上的同名网络表达电气连接，不要求每条连接都画成长导线。
这是 PAO 模块接线参考，不是 PCB 制造图。来源：hardware/sections/Display.tsx、Controller.tsx、hardware/nets.ts、hardware/components/Oled.tsx、hardware/schematic.svg。
-->

---
class: slide-light slide-circuit-tests
---

<div class="eyebrow">电路验收 / 单元测试与工程规则</div>
<h1>电路验收，<em>把接线要求写成单元测试。</em></h1>
<div class="circuit-tests-body">
  <div class="circuit-test-panel">
    <span class="detail-label">PAO 接线图 · 检查 OLED 接对没有</span>
    <span class="code-source">connectivity.test.ts · 展开现有测试参数</span>
    <pre v-pre><code>assertNetwork(["ESP32_S3.GPIO41",
  "OLED.SDA"]);
assertNetwork(["ESP32_S3.GPIO42",
  "OLED.SCL"]);</code></pre>
    <h2>少接、多接、接错，测试都不通过。</h2>
    <p>正确答案单独写在测试里，不照抄电路代码。</p>
  </div>
  <div class="circuit-rules">
    <div><span class="detail-label">实验平台 · 防止短路</span><p>VIN 已经接了 3.3V，再接 GND 就短路了，直接拒绝。</p><pre v-pre><code>assert.match(connectionError(nodes, wires,
  "2:VIN", "1:J1-22"), /短接/);</code></pre><span class="code-source">experimental/platform/circuit.test.mjs</span></div>
    <div><span class="detail-label">实验平台 · 检查 PCB 能不能生产</span><p>线断了、线太细或钻孔不合规，就不让导出生产文件。</p></div>
  </div>
</div>
<div class="evaluation-feedback"><b>反馈给 Agent</b><p>告诉它哪根线错了、错在哪，改完再测一遍。</p></div>
<div class="bottom-note">左右两边是不同的电路，分开检查；这里只看线怎么连，不算实际电流。</div>
<div class="page-number">07 / 16</div>

<!--
建议 45 秒。电路设计也能写单元测试。左侧把现有 OLED 测试循环中的两组参数展开：GPIO41 只能与 OLED.SDA 同网，GPIO42 只能与 OLED.SCL 同网。assertNetwork 读取构建后的 Circuit JSON，查找网络全部成员，再与独立记录的接线要求严格比较。少接、多接或短到其他信号都会失败；测试预期不从设计源码导入，避免跟着错误设计一起变化。
失败时 assert.deepEqual 报告实际和预期成员，这些证据反馈给 Agent，修改设计后重跑同一套验收。
右侧短接示例来自实验平台的另一个模块场景：VIN 已接到 3.3V 后再次连 GND，必须返回短接错误。载板 manufacturing.test.mjs 故意删线、改线宽和端点，确认铜连接或制造规则违规会阻止导出。这些是模块载板能力，不是左侧 PAO 参考图的 PCB 或实物验收。来源：hardware/test/connectivity.test.ts、experimental/platform/circuit.test.mjs、manufacturing.test.mjs。
-->

---
class: slide-light slide-schematic
---

<div class="eyebrow">电路设计 / tscircuit</div>
<h1>电路图纸，<em>由 tscircuit 生成。</em></h1>
<div class="schematic-body">
  <figure class="schematic-overview">
    <a href="/reference/pao-schematic.svg" target="_blank" rel="noopener noreferrer" aria-label="打开 PAO 模块接线原理图原始 SVG">
      <svg viewBox="190 0 820 600" role="img" aria-label="由 hardware/index.tsx 生成的 PAO 模块接线原理图整图"><image href="/reference/pao-schematic.svg" width="1200" height="600" /></svg>
    </a>
    <figcaption>tscircuit · PAO 模块接线原理图（参考）</figcaption>
  </figure>
  <div class="schematic-outputs">
    <span class="detail-label">同一份设计，面向人和工具</span>
    <div><code>hardware/index.tsx</code><h2>设计输入</h2><p>用代码组合供电、主控、显示、<br>音频和执行机构。</p></div>
    <div><code>schematic.svg</code><h2>图纸交给人审阅</h2><p>看整机怎么接，确认符合设计。</p></div>
    <div><code>dist/index/circuit.json</code><h2>电路网络交给工具检查</h2><p>读出实际连接，跑上一页的接线测试。</p></div>
  </div>
</div>
<div class="page-number">08 / 16</div>

<!--
建议 25 秒。从 OLED 局部展开到整机：左侧是 tscircuit 从 hardware/index.tsx 生成的完整 schematic.svg。右侧是同一份设计的三种形态：TSX 组织模块，SVG 供人审阅，Circuit JSON 供工具检查。
图纸与网络来自同一次构建，避免图纸和验收各说各话。这里是模块间接线参考，不是 PCB 制造文件；模块内部电路、封装和机械尺寸不在本图中验证。生成入口：hardware/Taskfile.yaml 的 build 与 export。
-->

---
class: slide-light slide-runtime-detail
---

<div class="eyebrow">固件运行 / esp32sim</div>
<h1>固件运行，<em>用芯片仿真验证行为。</em></h1>
<div class="runtime-detail-body">
  <figure class="runtime-model"><DemoVideo id="video-05" title="模拟器语音交互演示" /><figcaption><b>esp32sim · PAO 参考模拟器</b></figcaption></figure>
  <div class="runtime-checks"><span class="detail-label">自由组合应用 · 运行评估函数</span><div><b>UART 日志</b><p>读取告警、音量、音调、电机与状态标签。</p></div><div><b>I²S / MCPWM 实际输出</b><p>PCM 峰值、提示音频率与桥臂占空比。</p></div><div><b>显示与暂停行为</b><p>OLED 显存到达；暂停后音频和电机归零。</p></div><div class="runtime-example"><b>失败如何反馈</b><p>“实际 PCM 峰值”与“期望值”一并返回 Agent。</p></div></div>
</div>
<div class="page-number">09 / 16</div>

<!--
建议 70 秒。正式固件由 ESP-IDF 构建后输入模拟器，从 ROM 启动，不需要另写仿真业务分支。OLED 来自 I²C 写入，运动来自 MCPWM，测距经过 GPIO / RMT，音频经过真实固件的 I²S 链路，屏幕和运动不是预置效果。模拟器实时输出 UART0 固件日志，可按关键字过滤，并从中解析设备状态。
运行评估按场景输入音频或传感器数据，读取实际输出。verifyApplication 检查 UART 业务状态，核对 PCM 峰值、音调频率和电机桥臂占空比；显示目前只确认显存到达，最后检查暂停归零。当前容差为 PCM 峰值差不超过 50、提示音频率差不超过 25Hz、桥臂占空比差不超过 1，这些是软件验收容差，不是实物精度。
无硬件运行让每轮修改都能获得执行反馈；温升、射频、声学与机械性能不由这些断言证明。左侧是 PAO 参考模拟器，右侧验收机制来自自由组合实验应用，两者使用各自板型。来源：simulator/README.md；experimental/platform/agent.ts:217–236。
-->

---
class: slide-light slide-mechanical
---

<div class="eyebrow">机械结构 / Blender · 当前研发</div>
<h1>机械结构，<br><em>Agent 建模，刚体仿真评估。</em></h1>
<div class="mechanical-graphic"><img src="/mechanical-loop.svg" alt="Agent 在 Blender 中生成和调整机械结构，刚体动力学仿真提供结果用于评估与下一轮修改" /></div>
<div class="mechanical-checks"><div><span>设计对象</span><h2>外壳、底盘、支架与装配</h2><p>尺寸、连接关系与结构参数。</p></div><div><span>几何与装配评估</span><h2>能否正确装在一起？</h2><p>尺寸、孔位、间隙与干涉。</p></div><div><span>刚体动力学评估</span><h2>运动是否符合目标？</h2><p>运动、碰撞与姿态。</p></div></div>
<div class="page-number">10 / 16</div>

<!--
建议 50 秒。机械结构同样是当前核心工作：由 Agent 驱动 Blender 建模与仿真，以刚体动力学结果评估设计。外壳也属于机械结构，包括底盘、支架、孔位和装配关系。
几何检查回答能否装配，刚体仿真回答运动、碰撞和姿态是否符合场景目标，结果为 Agent 下一轮调整提供依据。具体指标、阈值和场景随工程定义，不能只凭渲染图判断通过。刚体模型不证明外壳材料强度、弹性形变或散热。
Blender 链路仍在开发中，验收以对应工程、仿真场景与运行记录为准；它与 PAO 模拟器的简化 PWM 位姿显示是不同实现。
-->

---
class: slide-light slide-demo
---

<div class="eyebrow">PAO / 实机演示</div>
<h1>实机演示，<em>语音与遥控驱动小车。</em></h1>
<div class="demo-videos">
  <figure><DemoVideo id="video-02" title="语音行驶与转向" /><figcaption><h2>语音行驶与转向</h2></figcaption></figure>
  <figure><DemoVideo id="video-01" title="手机遥控与发射" /><figcaption><h2>手机遥控与发射</h2></figcaption></figure>
</div>
<div class="page-number">11 / 16</div>

<!--
建议 35 秒。左侧通过语音控制小车行驶和转向；右侧通过手机遥控页控制底盘和发射。按现场节奏选择内容。
MCP 与局域网 WebSocket 是并列控制入口，共用 PaoBoard 动作逻辑。实机结果对应 PAO 板型与场景，不代表任意模块组合都能复现。
来源：docs/making-of.md 的 video-02 与 video-01。
-->

---
class: slide-light slide-demo slide-demo-field
---

<div class="eyebrow">PAO / 实机演示</div>
<h1>实机演示，<em>验证运动与执行机构。</em></h1>
<div class="demo-videos">
  <figure><DemoVideo id="video-03" title="室内语音行驶" /><figcaption><h2>室内语音行驶</h2></figcaption></figure>
  <figure><DemoVideo id="video-04" title="桌面发射测试" /><figcaption><h2>桌面发射测试</h2></figcaption></figure>
</div>
<div class="page-number">12 / 16</div>

<!--
建议 20 秒。按需播放室内语音行驶和桌面发射测试，不要求全部播完。
来源：docs/making-of.md 的 video-03 与 video-04。
-->

---
class: slide-light slide-close
---

<div class="eyebrow">FUTURE / 后续规划</div>
<h1>后续规划：<br><em>把验证过的流程做成可复用的工具。</em></h1>
<div class="outlook-grid">
  <div><span>当前 · PAO 验证</span><h2>在具体产品中验证方法</h2><p>电路、嵌入式软件与机械结构</p></div>
  <div><span>规划 · PAO Studio</span><h2>给人用的工作台</h2><p>需求、设计、构建与评估集中在一处</p></div>
  <div><span>规划 · Skill</span><h2>给 Agent 用的流程</h2><p>工具、步骤和评估规则跨项目复用</p></div>
</div>
<div class="takeaway">Studio 和 Skill 都是后续规划，以 PAO 验证过的路径为基础。</div>
<div class="page-number">13 / 16</div>

<!--
建议 20 秒。PAO 是当前的实验载体。后续规划有两件事：PAO Studio 把工程路径整合成人使用的工作台，Skill 把同一套流程封装给 Agent 复用。这两项都是规划，下面分别介绍。来源：docs/platform-roadmap.md。
-->

---
class: slide-light slide-studio
---

<div class="eyebrow">FUTURE / PAO STUDIO · 规划</div>
<h1>PAO Studio：<em>把流程变成工作台。</em></h1>
<div class="requirement"><span>目标体验</span><p>从一句需求，得到可构建、可仿真、可复验的工程。</p></div>
<div class="studio-gallery"><figure><img src="/reference/agent-hardware-preview.jpg" alt="Studio 的 Agent 选型与模块接线界面" /><figcaption>真实模块与接线约束</figcaption></figure><figure><img src="/reference/agent-pcb-preview.jpg" alt="Studio 生成的模块载板 PCB 界面" /><figcaption>原理图、模块载板与 DRC</figcaption></figure><figure><img src="/reference/manufacturing-preview.jpg" alt="Studio 制造文件预览界面" /><figcaption>可导出的工程与制造资料</figcaption></figure></div>
<div class="studio-output"><code>hardware.tsx / pcb.json</code><span>同一接线</span><code>wiring.h / board.json</code><span>编译 + 仿真</span><b>执行验收</b></div>
<div class="bottom-note">目标：同一设计能恢复对应的代码、结构、构建产物与评估记录。</div>
<div class="page-number">14 / 16</div>

<!--
建议 40 秒。把前面验证过的方法整合成 PAO Studio，让需求、设计、构建与评估集中在一个工作台。统一工程身份、工具输入输出和结果记录，让电路、固件、仿真和机械各环节围绕同一设计交接。
可以用声音告警需求说明目标体验：从选型和工程生成到编译、仿真，保留同一工程的验收证据。画面来自 experimental/platform 的实验界面，用来说明规划方向，不是已交付的产品；PAO 实车也不是一次性自动生成。来源：docs/platform-roadmap.md；experimental/platform/README.md。
-->

---
class: slide-light slide-close slide-skill
---

<div class="eyebrow">FUTURE / SKILL · 规划</div>
<h1><em>把硬件工作流封装为 Skill。</em></h1>
<div class="studio-output"><code>需求与验收条件</code><span>→</span><code>生成电路、固件、结构</code><span>→</span><code>构建与仿真</code><span>→</span><code>评估</code><span>→</span><b>修复或停止</b></div>
<div class="outlook-grid">
  <div><span>固定什么</span><h2>工具与验收标准</h2><p>输入输出、工程产物、验收步骤</p></div>
  <div><span>留下什么</span><h2>各阶段产物与证据</h2><p>每一步做了什么，结果如何</p></div>
  <div><span>何时停止</span><h2>做不了就报告原因</h2><p>模块不支持、约束冲突、修复次数用完</p></div>
</div>
<div class="page-number">15 / 16</div>

<!--
建议 40 秒。Skill 把电路、固件和结构生成，以及构建、仿真、评估、错误反馈与修复，编排成 Agent 可复用的流程。先打磨工作流，固定工具的输入输出、工程产物、验收步骤和失败信息；再封装，让 Agent 面向新的硬件任务沿用同一套方法。
Agent 从明确的需求和验收条件启动，保留各阶段产物与证据；遇到不支持的模块、约束冲突或修复预算耗尽时，停止并报告原因。Skill 的目标是自动完成工程与仿真验收，实物验收仍单独记录。来源：docs/platform-roadmap.md。
-->

---
class: slide-light slide-close slide-end
---

<div class="eyebrow">PAO / 2026 1024 HACKATHON</div>
<h1>万物皆代码，<br><em>评估驱动闭环。</em></h1>
<div class="outlook-grid">
  <div><span>代码</span><h2>让 Agent 能动手</h2></div>
  <div><span>评估</span><h2>让 Agent 知道是否做对</h2></div>
  <div><span>仿真</span><h2>让评估能自动执行</h2></div>
</div>
<div class="takeaway">PAO 用一台能语音控制、能发射的小车，验证了这条路径。</div>
<div class="closing-thanks">谢谢</div>
<div class="repo-address">github.com/pao-1024/pao</div>
<div class="page-number">16 / 16</div>

<!--
建议 15 秒。回到开头的问题：Agent 时代的硬件怎么开发。我们的答案是，用代码让 Agent 能动手，用评估让它知道对不对，用仿真让评估自动跑起来。PAO 这台小车验证了这条路径。谢谢大家。
-->

