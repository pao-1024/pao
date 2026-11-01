---
theme: default
title: PAO · 探索 Agent 时代的硬件开发新范式
info: 2026 1024 Hackathon · 万物皆代码，评估驱动硬件开发闭环
class: slide-light slide-cover
aspectRatio: 16/9
canvasWidth: 1280
transition: fade-out
fonts:
  sans: Noto Sans CJK SC
  mono: DejaVu Sans Mono
  local: sans
---

<div class="eyebrow">PAO / 2026 1024 HACKATHON</div>
<div class="hero-copy">
  <div class="edition">AI AGENT 时代</div>
  <h1>探索 Agent 时代的<br><em>硬件开发新范式</em></h1>
  <p>用代码定义工程，用评估驱动迭代。<br>让 Agent 贯通设计、编译、仿真与修复。</p>
</div>
<div class="hero-art">
  <div class="artifact-label">CODE → EXECUTION → EVALUATION</div>
  <div class="hero-source"><span>&lt;Hardware /&gt;</span><span>firmware.bin</span><span>evaluate(result)</span></div>
  <img src="/reference/simulator-overview.png" alt="PAO 正式固件在 esp32sim 中运行的页面" />
  <div class="artifact-caption">PAO · 语音小车验证产品<br>代码驱动 · 自动开发流程探索</div>
</div>
<div class="bottom-note">万物皆代码 / 评估驱动闭环 / 对固件透明的芯片级仿真</div>
<div class="page-number">01 / 13</div>

<!--
建议 25 秒。开场：我们正在探索 Agent 时代的硬件开发新范式。用代码定义工程，用评估驱动迭代，让 Agent 贯通设计、编译、仿真与修复。把电路、固件、运行环境和机械结构变成代码，把验收标准变成可执行的评估函数，Agent 就能自己生成、运行、检查，再根据失败证据修复。PAO 是验证这套流程的产品，Studio 的平台化方向放在实机展示后介绍。
电子工程与 Blender 机械结构工作分别说明当前范围；PAO 实机验证对应板型与场景。实验源码用于解释已有机制，不将实验工作台表述为成熟交付平台。
-->

---
class: slide-light slide-source
---

<div class="eyebrow">FOUNDATION / 可执行的工程表达</div>
<h1>万物皆代码，<br><em>驱动全流程 Agent 自动化。</em></h1>
<div class="source-columns">
  <div class="source-card"><span class="type-label">电路设计</span><h2>tscircuit</h2><p>TSX 描述器件与连接<br>生成原理图与电路网络</p><code>hardware/index.tsx<br>生成产物 → schematic.svg</code></div>
  <div class="source-card"><span class="type-label">固件编写</span><h2>firmware.bin</h2><p>按接线生成配置与 C++<br>ESP-IDF 编译真实固件</p><code>firmware/boards/pao/<br>生成产物 → wiring.h</code></div>
  <div class="source-card"><span class="type-label">固件运行</span><h2>esp32sim</h2><p>芯片、寄存器与外设模型<br>运行固件，输出观测结果</p><code>simulator/pao-sim/<br>生成产物 → board.json</code></div>
  <div class="source-card"><span class="type-label">机械结构</span><h2>Blender</h2><p>Agent 驱动建模与仿真<br>以刚体动力学评估设计</p><code>外壳 · 底盘 · 支架 · 装配<br>当前研发：Blender 工作流</code></div>
</div>
<div class="takeaway">Agent 能操作，工具能评估，团队能审查与复用。</div>
<div class="bottom-note">连这份演示稿也是代码：presentation/slides.md · Slidev / Markdown</div>
<div class="page-number">02 / 13</div>

<!--
建议 35 秒。万物皆代码的价值，是让 Agent 自动化贯穿设计、构建、运行和评估。各阶段都变成 Agent 可以操作、工具可以执行和检查的工程对象，再由评估反馈推动修复。接线改变后，生成匹配的引脚配置与虚拟板型，让设计和运行使用同一份输入。机械结构工作由 Agent 驱动 Blender 建模与仿真，刚体动力学提供评估依据；各环节分别说明当前能力，不将全流程自动化方向说成完整整机已自动验收。
根目录 hardware/index.tsx 是 PAO 参考接线图；Studio 生成的 hardware.tsx、PCB 和制造资料属于模块载板流程，不把根接线图说成已布线 PCB。PAO 参考固件与 Studio 自由组合工程分别维护。
来源：hardware/index.tsx；experimental/platform/README.md 的自然语言整机与业务开发；simulator/README.md。
-->

---
class: slide-light slide-assets
---

<div class="eyebrow">HARDWARE ASSETS / 硬件设计、实现与验收一起版本化</div>
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
    <div><h2>可追溯</h2><p>谁改了什么、为什么改，<br>都能关联到具体版本与审查记录。</p></div>
    <div><h2>可复用</h2><p>模块、驱动、模型与验收规则，<br>作为团队资产持续积累。</p></div>
    <div><h2>可重建</h2><p>保留源码、依赖与构建入口，<br>让对应工程有据可查、有法重建。</p></div>
  </div>
</div>
<div class="bottom-note">源文件入 Git，大型产物关联版本；生成工程需保存后入库，Blender 资产可沿用同一方式。</div>
<div class="page-number">03 / 13</div>

<!--
建议 35 秒。把软件工程中成熟的版本管理延伸到硬件工程：电路、图纸、模型和验收规则也能成为可管理的工程资产。电路设计、固件配置、仿真模型与验收规则一起版本化，每次迭代都留下差异和原因；模块与测试也能在后续项目中复用。页面列出当前仓库已跟踪的真实文件，依赖通过 firmware/base.json、Cargo.lock、pnpm-lock.yaml 和 esp32sim gitlink 固定。
版本管理不仅保存最终文件，还保存源代码、配置、依赖与验收条件，支持查找历史、比较变化，以及恢复工程版本后重新构建验证。构建产物和大型模型可使用制品存储或大文件机制关联提交；不要求全部作为普通源码文件提交。机械建模脚本、参数和模型可沿用同一方式，二进制模型配合预览与仿真证据审查；当前 Blender 工作仍在研发，不宣称已在本仓库落地。
实验原型生成工程位于 tmp/studio/，需要导出保存并纳入版本管理，不会自动成为已入库资产。可重建指保留重建依据与入口，不承诺逐字节可复现。来源：hardware/、firmware/base.json、simulator/pao-sim/、experimental/platform/、.gitignore。
-->

---
class: slide-light slide-review
---

<div class="eyebrow">HARDWARE COLLABORATION / 把软件协作方式延伸到硬件工程</div>
<h1>硬件变更进入 PR，<br><em>电路与固件一起审查。</em></h1>
<div class="review-graphic"><img src="/pr-review.svg" alt="硬件变更提交 PR，由工具检查和人工审查共同提供依据，再决定合并并保留版本记录" /></div>
<div class="review-evidence">
  <div class="review-diff"><span class="detail-label">真实变更 · 新增超声波接线</span><a href="https://github.com/pao-1024/pao/pull/36/files" target="_blank" rel="noopener noreferrer">PR #36 · 9966479 · Controller.tsx ↗</a><code>+ GPIO8: nets.ultrasonic.trig.selector,<br>+ GPIO9: nets.ultrasonic.echo.selector,</code><p>引脚与信号的变化成为可读差异，<br>与驱动、图纸和测试一起审查。</p></div>
  <div class="review-ci"><span class="detail-label">Hardware CI · 已配置的自动检查</span><span class="review-source">hardware/Taskfile.yaml · task test</span><code>node --test test/connectivity.test.ts<br>cmp dist/index/schematic.svg schematic.svg</code><p>检查编译后的连接关系，<br>确认重新生成的图纸与提交版本一致。</p></div>
</div>
<div class="bottom-note">PR 按改动范围运行已接入的检查；完整固件构建在 main 执行，仿真与实机结果分别记录。</div>
<div class="page-number">04 / 13</div>

<!--
建议 40 秒。Git、PR 和持续集成本来就是成熟的软件工程方法。这里的价值，是把它们延伸到硬件工程：接线、图纸、驱动和验收规则可以在同一个 PR 中审查。Agent 提交可审查的变更，工具执行已有检查，人审设计意图、约束与证据，再决定是否合并。差异、讨论和验证结果可以关联同一提交，发生问题时可回溯工程版本。
左侧来自仓库真实提交 99664793053145a98f8d7cd5adfa66f77db139f9（PR #36）：Controller.tsx 新增 GPIO8 的 Trig 与 GPIO9 的 Echo 连接。该 PR 同步了硬件、固件、图纸与说明，用实际改动说明跨层审查。右侧命令来自 hardware/Taskfile.yaml；Hardware workflow 的 pull_request 按路径触发 task test，先执行 check 并生成电路，再测试连通性、比较 SVG。这里只展示已存在的检查配置，不代表本轮重新执行了硬件测试或所有 CI 已通过。
Firmware PR 当前只做静态检查，完整 ESP-IDF 构建在 main 执行并上传关联提交的固件产物。Simulator 与 Platform CI 包含模型、接线和运行时逻辑测试及构建，不等同于真实固件软件在环或实机验收；Blender 与实机验收也不在这些云端流程中。CI 配置不代表已设置强制合并门禁。来源：.github/workflows/{hardware,firmware,simulator,platform}.yml；hardware/Taskfile.yaml；PR #36。
-->

---
class: slide-light slide-loop
---

<div class="eyebrow">EVALUATION / 自动开发为什么需要评估函数</div>
<h1>评估函数，决定 Agent<br><em>能否自己完成闭环。</em></h1>
<div class="loop-graphic"><img src="/agent-loop.svg" alt="Agent 生成候选工程，经工具执行和评估后，成功保留产物，失败携带证据返回修复" /></div>
<div class="loop-rules"><div><b>知道何时完成</b><span>把需求变成机器能执行的通过条件</span></div><div><b>知道哪里要改</b><span>返回具体偏差，而不只是一个失败标签</span></div><div><b>知道修复是否有效</b><span>保留既定验收步骤，修改后重新执行</span></div></div>
<div class="bottom-note">代码让 Agent 能动手；评估函数提供反馈，让生成、执行与修复可以连续进行。</div>
<div class="page-number">05 / 13</div>

<!--
建议 45 秒。代码生成之后，谁来判断它是否做对？评估函数把需求变成可执行条件，读取工程和运行结果，给出通过结论或具体偏差。Agent 才能知道什么时候停止、哪里需要修改，以及修改是否有效。
这里的评估函数包括规则检查、单元测试、编译结果与仿真断言。不能只让生成模型自己说完成；规则与工具结果提供独立反馈。原型中的第一份有效验收场景由模型提出，之后修复时固定，当前最多三轮；仍需人核对场景是否充分表达需求。
接下来逐项展开电路、固件、运行与机械结构，每项都回答：生成什么、如何执行、如何判定。来源：experimental/platform/agent.ts 的 iterateApplication 与 runtime.test.mjs 中防止弱化验收的测试。
-->

---
class: slide-light slide-circuit-source
---

<div class="eyebrow">电路设计 / tscircuit · 真实 TSX 与生成图纸对照</div>
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
    <span class="code-excerpt">真实源码节选 · 省略绘图分区与坐标</span>
  </div>
  <figure class="circuit-generated">
    <span class="detail-label">生成图纸 · 同一个 OLED 模块</span>
    <a href="/reference/pao-schematic.svg" target="_blank" rel="noopener noreferrer"><svg viewBox="267 358 130 52" role="img" aria-label="由左侧 OLED 代码生成的真实原理图局部，含 V3V3、GND、OLED_SDA 和 OLED_SCL"><image href="/reference/pao-schematic.svg" width="1200" height="600" /></svg></a>
    <figcaption><b>代码中的网络，成为图上的连接。</b><p>OLED_SDA ↔ GPIO41<br>OLED_SCL ↔ GPIO42</p><span>Controller.tsx 将主控引脚接入同名网络。</span></figcaption>
  </figure>
</div>
<div class="bottom-note">同一份 TSX 生成原理图与 Circuit JSON；图纸用于审阅，电路网络交给下一页的测试。</div>
<div class="page-number">06 / 13</div>

<!--
建议 30 秒。左边是仓库 Display.tsx 中真实的 OLED 模块定义，只省略绘图分区与坐标；右边直接展示 tscircuit 生成的原始 SVG 局部。代码定义器件、引脚和四条网络连接，图纸由这些设计输入生成。
nets.ts 将 nets.display.sda 和 scl 定义为 OLED_SDA 与 OLED_SCL；Controller.tsx 把 GPIO41、GPIO42 接入相同网络。电源对应 V3V3 和 GND。图上的同名网络表达电气连接，不要求每条连接都画成长导线。
OledModule 复用 @tscircuit/header-modules 的真实四针 SSD1306 模块定义。这是 PAO 模块接线参考，不是 Studio 六针 OLED 或 PCB 制造图；doNotPlace 与现有参考图源码一致。来源：hardware/sections/Display.tsx、Controller.tsx、hardware/nets.ts、hardware/components/Oled.tsx、hardware/schematic.svg。
-->

---
class: slide-light slide-circuit-tests
---

<div class="eyebrow">电路验收 / 评估函数 · 单元测试与工程规则</div>
<h1>电路验收，<em>把接线要求写成单元测试。</em></h1>
<div class="circuit-tests-body">
  <div class="circuit-test-panel">
    <span class="detail-label">PAO 接线图 · OLED 连通性测试</span>
    <span class="code-source">connectivity.test.ts · 展开现有测试参数</span>
    <pre v-pre><code>assertNetwork(["ESP32_S3.GPIO41",
  "OLED.SDA"]);
assertNetwork(["ESP32_S3.GPIO42",
  "OLED.SCL"]);</code></pre>
    <h2>比较整张网络，漏连、多连都失败。</h2>
    <p>读取构建后的 Circuit JSON，核对完整网络成员。<br>预期接线独立定义，不从电路源码复制生成。</p>
  </div>
  <div class="circuit-rules">
    <div><span class="detail-label">实验平台 · 短接与电气约束</span><p>VIN 已接 3.3V，再次接入 GND 应拒绝。</p><pre v-pre><code>assert.match(connectionError(nodes, wires,
  "2:VIN", "1:J1-22"), /短接/);</code></pre><span class="code-source">experimental/platform/circuit.test.mjs</span></div>
    <div><span class="detail-label">实验平台 · 模块载板制造 DRC</span><p>检查铜连接、净距、线宽与钻孔；<br>违规阻止制造包导出。</p></div>
  </div>
</div>
<div class="evaluation-feedback"><b>反馈给 Agent</b><p>预期连接与实际网络差异、具体引脚或规则违规，成为下一轮修复依据。</p></div>
<div class="bottom-note">PAO 接线图与实验载板分别验收；检查网络和铜几何，不模拟实际短路电流。</div>
<div class="page-number">07 / 13</div>

<!--
建议 45 秒。电路设计也能写单元测试。左侧把现有 OLED 测试循环中的两组参数展开：GPIO41 只能与 OLED.SDA 同网，GPIO42 只能与 OLED.SCL 同网。assertNetwork 读取构建后的 Circuit JSON，查找网络全部成员，再与独立记录的接线要求严格比较。少接、多接或短到其他信号都会失败；测试预期不从设计源码导入，避免跟着错误设计一起变化。
失败时 assert.deepEqual 报告实际和预期成员，并提示哪个引脚的网络成员不符。这些证据可以反馈给 Agent，修改设计后重跑同一套验收；本页展示现有代码与判定机制，不宣称本轮重新执行了硬件测试。
右侧短接示例来自实验平台 circuit.test.mjs 的另一个模块场景：VIN 已接到 3.3V 后再次连 GND，必须返回短接错误。载板 manufacturing.test.mjs 故意删线、改线宽和端点，确认铜连接或制造规则违规会阻止导出。这些是模块载板能力，不能当作左侧 PAO 参考图的 PCB 或实物验收。来源：hardware/test/connectivity.test.ts、experimental/platform/circuit.test.mjs、manufacturing.test.mjs。
-->

---
class: slide-light slide-schematic
---

<div class="eyebrow">电路设计 / tscircuit · 从局部定义到完整工程产物</div>
<h1>电路图纸，<em>由 tscircuit 生成。</em></h1>
<div class="schematic-body">
  <figure class="schematic-overview">
    <a href="/reference/pao-schematic.svg" target="_blank" rel="noopener noreferrer" aria-label="打开 PAO 模块接线原理图原始 SVG">
      <svg viewBox="190 0 820 600" role="img" aria-label="由 hardware/index.tsx 生成的 PAO 模块接线原理图整图"><image href="/reference/pao-schematic.svg" width="1200" height="600" /></svg>
    </a>
    <figcaption>tscircuit · PAO 模块接线原理图（参考）<span>点击查看原始 SVG ↗</span></figcaption>
  </figure>
  <div class="schematic-outputs">
    <span class="detail-label">同一份设计，面向人和工具</span>
    <div><code>hardware/index.tsx</code><h2>模块化设计输入</h2><p>组合供电、主控、显示、音频<br>与执行机构的器件和连接。</p></div>
    <div><code>schematic.svg</code><h2>图纸交给人审阅</h2><p>查看整机接线，核对设计意图。</p></div>
    <div><code>dist/index/circuit.json</code><h2>电路网络交给工具检查</h2><p>提取实际连接，执行网络断言。</p></div>
  </div>
</div>
<div class="bottom-note">来源：hardware/index.tsx → schematic.svg；模块接线参考，尚未实物验证。</div>
<div class="page-number">08 / 13</div>

<!--
建议 25 秒。从 OLED 局部展开到整机：左侧是 tscircuit 从 hardware/index.tsx 实际生成的完整 schematic.svg，可点击查看所有标注。右侧说明同一份设计的三种形态：TSX 组织模块，SVG 供人审阅，Circuit JSON 供工具检查。
图纸与网络都来自同一次设计构建，避免图纸和验收各说各话。这里展示模块间接线参考，不是 PCB 制造文件；模块内部电路、封装和机械尺寸不在本图中验证。hardware/README.md 明确该接线参考尚未实物验证。生成入口：hardware/Taskfile.yaml 的 build 与 export。
-->

---
class: slide-light slide-runtime-detail
---

<div class="eyebrow">固件运行 / esp32sim · 透明芯片仿真与软件在环评估</div>
<h1>固件运行，<em>用芯片仿真验证行为。</em></h1>
<div class="runtime-detail-body">
  <figure class="runtime-model"><a class="runtime-screen" href="/reference/simulator-overview.png" target="_blank" rel="noopener noreferrer"><img src="/reference/simulator-overview.png" alt="esp32sim 的 PAO 参考模拟器真实界面，显示 OLED、车辆场景、ESP32-S3 引脚与总线活动" /></a><figcaption><b>esp32sim · PAO 参考模拟器</b><p>ESP-IDF 构建正式固件，交给芯片级仿真。<br>仿真对固件透明，驱动与业务逻辑照常执行。</p><a href="https://github.com/user-attachments/assets/b82adcdc-420b-4e07-abb6-0e4ae3ad228b" target="_blank" rel="noopener noreferrer">查看模拟器演示 ↗</a></figcaption></figure>
  <div class="runtime-checks"><span class="detail-label">自由组合应用 · 运行评估函数</span><div><b>UART 业务状态</b><p>按场景核对告警、音量、音调、电机与状态标签。</p></div><div><b>I²S / MCPWM 实际输出</b><p>检查 PCM 峰值、提示音频率与桥臂占空比，<br>将实测输出和场景预期比较。</p></div><div><b>显示与暂停行为</b><p>确认 OLED 显存到达；暂停后音频和电机归零。</p></div><div class="runtime-example"><b>失败如何反馈</b><p>“实际 PCM 峰值”与“期望值”一并返回 Agent。</p></div></div>
</div>
<div class="bottom-note">无实物可执行数字接口与业务验收；OLED 不逐像素判图，物理性能仍需对应模型与实测。</div>
<div class="page-number">09 / 13</div>

<!--
建议 70 秒。固件沿用常规软件工程，由 ESP-IDF 编译链接；预检或编译通过不证明业务正确，真正需要强调的是硬件环境中的行为评估。实验平台会将构建失败日志反馈给 Agent 修复，并保留既定验收场景。模拟器从 ROM 启动正式 PAO 固件，固件照常访问 CPU、寄存器和外设接口，不需要另写仿真业务分支。OLED 来自 I²C 写入，运动来自 MCPWM，测距经过 GPIO / RMT，音频经过真实固件的 I²S 链路。屏幕和运动不是预置成功效果。
运行评估按场景输入音频或传感器数据，读取实际输出。实验 verifyApplication 既检查 UART 业务状态，也核对 PCM 峰值、音调频率和电机桥臂占空比；显示目前只确认实际显存到达，最后还检查暂停归零。当前实现容差为 PCM 峰值差不超过 50、提示音频率差不超过 25Hz、桥臂占空比差不超过 1，这些是软件验收容差，不是实物精度。
无硬件运行使每轮修改都能获得执行反馈；温升、射频、声学与机械性能不由这些数字接口断言证明。左侧截图复用 simulator/images/simulator-overview.png，展示 esp32sim 的 PAO 参考模拟器；右侧验收机制来自自由组合实验应用，两者使用各自匹配板型。来源：simulator/README.md；experimental/platform/agent.ts:217–236。
-->

---
class: slide-light slide-mechanical
---

<div class="eyebrow">机械结构 / Agent 驱动的 Blender 开发</div>
<h1>机械结构，<br><em>Agent 建模，刚体仿真评估。</em></h1>
<div class="mechanical-graphic"><img src="/mechanical-loop.svg" alt="Agent 在 Blender 中生成和调整机械结构，刚体动力学仿真提供结果用于评估与下一轮修改" /></div>
<div class="mechanical-checks"><div><span>设计对象</span><h2>外壳、底盘、支架与装配</h2><p>用可修改的模型表达尺寸、连接关系与结构参数。</p></div><div><span>几何与装配评估</span><h2>能否正确装在一起？</h2><p>检查尺寸、孔位、间隙与装配干涉。</p></div><div><span>刚体动力学评估</span><h2>运动是否符合目标？</h2><p>以仿真中的运动、碰撞与姿态判断设计。</p></div></div>
<div class="bottom-note">当前正在 Blender 推进 Agent 驱动的设计与仿真；刚体评估不等同于外壳强度、形变或散热分析。</div>
<div class="page-number">10 / 13</div>

<!--
建议 50 秒。机械结构同样是当前核心工作：由 Agent 驱动 Blender 中的自动化设计与仿真，以刚体动力学结果评估设计。外壳也属于机械结构，包括底盘、支架、孔位和装配关系。
几何检查回答能否装配，刚体仿真回答运动、碰撞和姿态是否符合场景目标；评估结果为 Agent 下一轮调整提供依据。具体指标、阈值和场景需要随工程定义，不能只凭渲染图判断通过。刚体模型不证明外壳材料强度、弹性形变或散热。
Blender 链路当前处于开发中，具体验收以对应工程、仿真场景与运行记录为准。PAO 当前简化 PWM 位姿显示与这条刚体动力学工作分别说明，仿真结果和实物验收分别记录。
-->

---
class: slide-light slide-product
---

<div class="product-photo"><img src="/release/photo-12-first-rollout.jpg" alt="PAO 语音小车实物" /></div>
<div class="eyebrow">PAO / 验证产品</div>
<h1>把这条路径<br>带到<em>真实世界。</em></h1>
<p class="product-lead">语音、显示、底盘与执行机构，<br>在同一台设备上协同工作。</p>
<div class="product-points"><span>语音唤醒与对话</span><span>运动、测距与停车</span><span>OLED 状态反馈</span><span>网页遥控与发射</span></div>
<a class="product-link" href="https://github.com/pao-1024/pao/blob/main/docs/making-of.md#演示视频" target="_blank" rel="noopener noreferrer">查看实车演示 ↗</a>
<div class="bottom-note">PAO 验证对应板型与场景；实机结果与仿真结果分别记录。</div>
<div class="page-number">11 / 13</div>

<!--
建议 55 秒。到这里再展示实车，回答代码驱动开发是否能连接真实世界。PAO 将语音、屏幕、底盘和执行机构放在同一台设备上，检验描述、驱动、固件与实物连接的一致性。
可现场展示查询距离、短程前进与停车，或打开项目已有实车视频。MCP 与局域网 WebSocket 是并列控制入口，共用 PaoBoard 动作逻辑。不能把 PAO 的现有功能说成 Studio 可对任意模块组合一键复现，也不声称整车由现有 Agent 一次性自动生成。
来源：README.md；docs/making-of.md；firmware/boards/pao/README.md。
-->

---
class: slide-light slide-studio
---

<div class="eyebrow">FUTURE / PAO STUDIO · 平台化方向</div>
<h1>PAO Studio：<em>把流程变成工作台。</em></h1>
<div class="requirement"><span>目标体验</span><p>从一句需求，得到可构建、可仿真、可复验的工程。</p></div>
<div class="studio-gallery"><figure><img src="/reference/agent-hardware-preview.jpg" alt="Studio 的 Agent 选型与模块接线界面" /><figcaption>真实模块与接线约束</figcaption></figure><figure><img src="/reference/agent-pcb-preview.jpg" alt="Studio 生成的模块载板 PCB 界面" /><figcaption>原理图、模块载板与 DRC</figcaption></figure><figure><img src="/reference/manufacturing-preview.jpg" alt="Studio 制造文件预览界面" /><figcaption>可导出的工程与制造资料</figcaption></figure></div>
<div class="studio-output"><code>hardware.tsx / pcb.json</code><span>同一接线</span><code>wiring.h / board.json</code><span>编译 + 仿真</span><b>执行验收</b></div>
<div class="bottom-note">已有本地实验原型；后续将工程生成、评估与修复整合为可复用的开发工作台。</div>
<div class="page-number">12 / 13</div>

<!--
建议 50 秒。在实机之后介绍平台化方向：把前面验证过的方法整合成 PAO Studio，让需求、设计、构建与评估集中在一个工作台。已有本地实验原型用于探索器件选型、约束接线、模块载板与业务固件生成，画面展示这些原型界面。
可以用声音告警需求说明目标体验：从选型和工程生成到编译、仿真，保留同一工程的验收证据。Studio 在演示结构中属于未来平台化方向，不把实验原型当作成熟产品或将 PAO 实车归因为一次性自动生成。后续还需扩充模块、场景与实物对照。来源：experimental/platform/README.md。
-->

---
class: slide-light slide-close
---

<div class="eyebrow">FUTURE / 将开发方法沉淀为可复用能力</div>
<h1>把这套开发流程，<br><em>封装为可复用的 Skill。</em></h1>
<p class="outlook-current">电路、固件、运行与机械结构，共用“生成、评估、反馈修复”的方法。</p>
<div class="outlook-grid">
  <div><span>流程可复用</span><h2>一次定义，跨项目执行</h2><p>固化工具入口与工程产物，<br>编排设计、构建和仿真。</p></div>
  <div><span>验收可继承</span><h2>把评估标准一起带走</h2><p>保留场景、断言和失败反馈，<br>修改工程后重跑相同验收。</p></div>
  <div><span>结果可复验</span><h2>交付工程，也交付证据</h2><p>记录输入、版本与运行结果，<br>明确支持范围和实物验证状态。</p></div>
</div>
<p class="closing-statement">目标：从 PAO 出发，让 Agent 交付可复验的整机方案。</p>
<div class="team">Zhiqiang Zhang · 硬件、底盘与板级集成<br>jimyag · 构建、模拟器、语音与网页控制</div>
<div class="repo-address">github.com/pao-1024/pao</div>
<div class="page-number">13 / 13</div>

<!--
建议 50 秒。未来将整个开发流程封装成 Skill，把工具、工程产物、验收场景、错误反馈和修复步骤一起复用。Agent 接到新需求时，能够沿着可检查的流程推进，交付可重新构建、仿真和评估的工程。
每个领域的评估各司其职：电路看连接与规则，固件看构建，运行看真实输出，机械结构看几何与刚体仿真。全流程 Skill 仍属后续方向；仿真证据与实物验收分别记录，模型覆盖不到的部分不能自动标记通过。团队分工见项目 README。
-->
