---
theme: default
title: PAO · AI Agent 时代的硬件开发
info: 2026 1024 Hackathon · 万物皆代码，评估驱动闭环开发
class: slide-dark slide-cover
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
  <h1>让 AI Agent<br><em>跑通硬件开发</em></h1>
  <p>从电路设计、固件编写，到固件运行与效果评估。<br>让代码驱动全过程，让反馈推动下一次迭代。</p>
</div>
<div class="hero-art">
  <div class="artifact-label">CODE → EXECUTION → EVALUATION</div>
  <div class="hero-source"><span>&lt;Hardware /&gt;</span><span>firmware.bin</span><span>evaluate(result)</span></div>
  <img src="/reference/simulator-overview.png" alt="PAO 正式固件在 esp32sim 中运行的页面" />
  <div class="artifact-caption">PAO STUDIO · 自动开发工作台<br>PAO · 语音小车验证产品</div>
</div>
<div class="bottom-note">万物皆代码 / 评估驱动闭环 / 对固件透明的芯片级仿真</div>
<div class="page-number">01 / 10</div>

<!--
建议 35 秒。开场：AI Agent 已经能写代码，硬件开发能不能也像软件一样，自动生成、运行、检查，再修复？我们用 PAO 探索这件事：把电路、固件和运行环境都变成代码，再把判断是否做对的标准交给评估函数。
PAO Studio 是本地实验工作台，在已建模器件与业务接口内实现自动闭环。PAO 小车用于验证软硬件路径，不宣称它由 Studio 一次性自动生成。
-->

---
class: slide-light slide-source
---

<div class="eyebrow">FOUNDATION / 可执行的工程表达</div>
<h1>万物皆代码，<br><em>开发才可自动化。</em></h1>
<div class="source-columns">
  <div class="source-card"><span class="type-label">电路设计</span><h2>&lt;Hardware /&gt;</h2><p>器件、引脚、网络与约束<br>生成原理图和模块载板</p><code>hardware/index.tsx<br>platform → hardware.tsx</code></div>
  <div class="source-card"><span class="type-label">固件编写</span><h2>firmware.bin</h2><p>按接线生成配置与 C++<br>ESP-IDF 编译真实固件</p><code>firmware/boards/pao/<br>platform → wiring.h</code></div>
  <div class="source-card"><span class="type-label">固件运行</span><h2>esp32sim</h2><p>芯片、寄存器与外设模型<br>运行固件，输出观测结果</p><code>simulator/pao-sim/<br>platform → board.json</code></div>
</div>
<div class="takeaway">能被 Agent 修改，也能被工具构建、检查和执行。</div>
<div class="bottom-note">连这份演示稿也是代码：presentation/slides.md · Slidev / Markdown</div>
<div class="page-number">02 / 10</div>

<!--
建议 45 秒。万物皆代码的价值，是把各阶段变成 Agent 可以操作、工具可以检查的工程对象。接线改变后，生成匹配的引脚配置与虚拟板型，让设计和运行使用同一份输入。
根目录 hardware/index.tsx 是 PAO 参考接线图；Studio 生成的 hardware.tsx、PCB 和制造资料属于模块载板流程，不把根接线图说成已布线 PCB。PAO 参考固件与 Studio 自由组合工程分别维护。
来源：hardware/index.tsx；experimental/platform/README.md 的自然语言整机与业务开发；simulator/README.md。
-->

---
class: slide-dark slide-evaluation
---

<div class="eyebrow">EVALUATION / 自动开发的关键接口</div>
<h1>评估函数，<br><em>让 AI 知道是否做对。</em></h1>
<div class="eval-table">
  <div class="eval-row eval-head"><span>被评估的对象</span><span>可执行的判断标准</span><span>返回给 Agent</span></div>
  <div class="eval-row"><b>电路与 PCB</b><span>完整网络成员 · 跨网短接 · 制造 DRC</span><code>具体网络 / 违规位置</code></div>
  <div class="eval-row"><b>固件工程</b><span>编译成功 · 启动就绪 · 接线配置一致</span><code>编译 / 启动错误</code></div>
  <div class="eval-row"><b>运行效果</b><span>UART · OLED 显存 · PCM 音频 · PWM</span><code>实际值与预期差异</code></div>
</div>
<div class="test-example"><div><span>仓库中的真实断言</span><code>assert.match(connectionError(nodes, wires,<br>&nbsp;&nbsp;"2:VIN", "1:J1-22"), /短接/);</code></div><p>VIN 已接 3.3V，<br>再次接入 GND 必须被拒绝。</p></div>
<div class="bottom-note">电路图也能写单元测试；短路检查针对网络与铜连接，不等同于实物电气测量。</div>
<div class="page-number">03 / 10</div>

<!--
建议 55 秒。评估函数是这套系统的关键：Agent 生成了一张电路图，如何知道它接对了？把连通性、短路与规则写成可执行检查；生成固件后用编译器和启动日志判断；运行后检查屏幕、音频、电机输出是否符合验收条件。
电路测试读取构建后的 Circuit JSON 比对完整网络成员，见 hardware/test/connectivity.test.ts:45–63；页面短接断言来自 experimental/platform/circuit.test.mjs:37–45，预先连接 3.3V 后试接 GND。manufacturing.test.mjs 会故意删除铜线和修改几何，验证制造 DRC 拒绝输出。Agent 的动态效果验收见 experimental/platform/agent.ts:217–236：检查 UART、PCM 峰值与频率、桥臂占空比、暂停归零，OLED 只验证显存到达，不逐像素判断画面语义。
工具返回具体失败，而不是让生成模型自己宣称成功。评估可信度取决于断言与模型覆盖范围，首份有效验收场景也需核对是否充分表达人类需求，实物电流、温升等仍需测量。
-->

---
class: slide-light slide-loop
---

<div class="eyebrow">AGENT LOOP / 生成只是一次迭代的开始</div>
<h1>Agent 的下一步，<br><em>由运行结果决定。</em></h1>
<div class="loop-graphic"><img src="/agent-loop.svg" alt="需求交给 Agent 生成电路和固件，经过规则检查、编译和芯片仿真后评估；失败携带证据返回 Agent，成功保留工程与验收记录" /></div>
<div class="loop-rules"><div><b>真实反馈</b><span>选型、布线、编译、启动与验收错误</span></div><div><b>固定标准</b><span>保留首份有效验收步骤，修复后重跑</span></div><div><b>有界修复</b><span>当前最多三轮，失败保留具体原因</span></div></div>
<div class="bottom-note">已实现的本地实验能力 · 限于内置器件、驱动与仿真模型</div>
<div class="page-number">04 / 10</div>

<!--
建议 75 秒。把开发闭环完整讲一遍：自然语言需求变成模块选择、电路和业务代码；规则检查不通过就返回错误，编译或启动失败也返回错误；启动后执行验收步骤，实际观测与预期不符则继续修复。
最重要的不是模型说“我完成了”，而是工具给出可执行证据。第一份有效验收步骤会被保留，后续修改仍需通过它，不能通过降低验收标准来掩盖失败。当前最多三轮，不宣称必然自动成功。
来源：experimental/platform/agent.ts、experimental/platform/runtime.ts、experimental/platform/README.md。
-->

---
class: slide-light slide-transparent
---

<div class="eyebrow">CHIP-LEVEL SIMULATION / 正式固件照常执行</div>
<h1>仿真发生在芯片层，<br><em>对固件透明。</em></h1>
<div class="transparent-body">
  <div class="chip-graphic"><img src="/architecture.svg" alt="同一份 PAO 正式应用固件可运行于真实 ESP32-S3 与 esp32sim；仿真从 ROM 启动并通过 CPU、寄存器、总线连接虚拟外设" /></div>
  <div class="transparent-copy"><h2>固件访问硬件接口<br>模型响应芯片行为</h2><p>复用正式驱动与业务逻辑<br>无需仿真专用业务分支</p><div class="bus-tags"><span>GPIO</span><span>I²C</span><span>I²S</span><span>MCPWM</span><span>RMT</span></div></div>
</div>
<div class="bottom-note">“透明”指固件接口与执行路径；仿真覆盖已建模的数字行为，不等于完整物理还原。</div>
<div class="page-number">05 / 10</div>

<!--
建议 65 秒。PAO 的模拟器从 ROM 启动 task firmware:build 产出的正式固件，运行原有驱动和业务代码。固件写寄存器、发 I²C、配置 I²S，模型就在对应的芯片与外设接口响应。
OLED 是真实显存写入，运动是 MCPWM 输出，超声波是 Trig/Echo 经 RMT 返回驱动；这些不是前端按按钮播放的替代效果。芯片模型和 PAO 板型均为软件，固件不需要包含模拟器 SDK 或维护仿真业务分支。云语音仍需要服务绑定与麦克风授权。
芯片级描述的是仿真层次，不声称逐周期或模拟电气完全准确。来源：simulator/README.md；simulator/pao-sim/src/main.rs、board.rs、trace.rs。
-->

---
class: slide-dark slide-runtime
---

<div class="eyebrow">RUN WITHOUT HARDWARE / 让评估随时可执行</div>
<h1>没有实物，<br><em>先跑通主要固件链路。</em></h1>
<div class="runtime-body"><div class="runtime-shot"><img src="/reference/simulator-overview.png" alt="正式 PAO 固件驱动的 OLED、3D 小车、接线及总线观测页面" /></div><div class="runtime-signals"><div><b>显示</b><span>I²C 写入 → OLED 显存</span></div><div><b>运动</b><span>MCPWM → 轮组与位姿</span></div><div><b>测距</b><span>GPIO / RMT → 驱动读数</span></div><div><b>语音</b><span>I²S → 唤醒、交互、播放</span></div><a href="https://github.com/user-attachments/assets/b82adcdc-420b-4e07-abb6-0e4ae3ad228b" target="_blank" rel="noopener noreferrer">查看模拟器演示 ↗</a></div></div>
<div class="bottom-note">无实物可验证接口与业务行为；温升、射频、声学、机械负载及实际精度需实物验证。</div>
<div class="page-number">06 / 10</div>

<!--
建议 60 秒。强调没有硬件也能开始运行主要软件链路，Agent 才能在自己的执行环境内获得反馈，而不必每轮都等待人上板测试。浏览器用于观察和交互，固件执行在 Rust/esp32sim 后端。
PAO 参考机可用电脑麦克风与扬声器完成真实固件的语音路径；自动验收在支持的场景中通过 PCM 输入与输出检查完成。区分用户语音交互和自动化验收，不把测试 PCM 称为真实用户说话。
画面来自仓库既有素材，本页不代表本次重新完成全部运行验证。无代码覆盖率统计，不给出“百分之多少代码已经验证”的数字。
-->

---
class: slide-light slide-studio
---

<div class="eyebrow">PAO STUDIO / 本地实验工作台</div>
<h1>一份设计，<em>贯穿电路与固件。</em></h1>
<div class="requirement"><span>输入需求</span><p>“声音超过阈值时播放告警，并在 OLED 显示状态。”</p></div>
<div class="studio-gallery"><figure><img src="/reference/agent-hardware-preview.jpg" alt="Studio 的 Agent 选型与模块接线界面" /><figcaption>真实模块与接线约束</figcaption></figure><figure><img src="/reference/agent-pcb-preview.jpg" alt="Studio 生成的模块载板 PCB 界面" /><figcaption>原理图、模块载板与 DRC</figcaption></figure><figure><img src="/reference/manufacturing-preview.jpg" alt="Studio 制造文件预览界面" /><figcaption>可导出的工程与制造资料</figcaption></figure></div>
<div class="studio-output"><code>hardware.tsx / pcb.json</code><span>同一接线</span><code>wiring.h / board.json</code><span>编译 + 仿真</span><b>执行验收</b></div>
<div class="bottom-note">示例需求在已支持音频与显示模块范围内；截图展示工作台能力，具体结论以工程验收记录为准。</div>
<div class="page-number">07 / 10</div>

<!--
建议 75 秒。用声音告警这一具体需求解释链路：Agent 选麦克风、功放、扬声器与 OLED，平台补齐电源、公共地、复位与使能，完成模块载板检查；同一接线生成引脚配置与虚拟板型，生成 C++ 后编译，再运行验收。
现场可展示匹配工程的源码、编译输出、仿真遥测和验收记录。正常输入保持监听，达到阈值时观察提示音与 OLED，输入回落后观察恢复。演示结论必须来自当次实际结果；只有截图时说明这是界面展示。
Studio 自动生成模块安装板，不重新设计所购模块的内部电路；PAO 参考板与自由组合板型分别维护。来源：experimental/platform/README.md。
-->

---
class: slide-dark slide-product
---

<div class="product-photo"><img src="/release/photo-12-first-rollout.jpg" alt="PAO 语音小车实物" /></div>
<div class="eyebrow">PAO / 验证产品</div>
<h1>把这条路径<br>带到<em>真实世界。</em></h1>
<p class="product-lead">语音、显示、底盘与执行机构，<br>在同一台设备上协同工作。</p>
<div class="product-points"><span>语音唤醒与对话</span><span>运动、测距与停车</span><span>OLED 状态反馈</span><span>网页遥控与发射</span></div>
<a class="product-link" href="https://github.com/pao-1024/pao/blob/main/docs/making-of.md#演示视频" target="_blank" rel="noopener noreferrer">查看实车演示 ↗</a>
<div class="bottom-note">PAO 验证对应板型与场景；Studio 自由组合工程分别维护。</div>
<div class="page-number">08 / 10</div>

<!--
建议 55 秒。到这里再展示实车，回答代码驱动开发是否能连接真实世界。PAO 将语音、屏幕、底盘和执行机构放在同一台设备上，检验描述、驱动、固件与实物连接的一致性。
可现场展示查询距离、短程前进与停车，或打开项目已有实车视频。MCP 与局域网 WebSocket 是并列控制入口，共用 PaoBoard 动作逻辑。不能把 PAO 的现有功能说成 Studio 可对任意模块组合一键复现，也不声称整车由现有 Agent 一次性自动生成。
来源：README.md；docs/making-of.md；firmware/boards/pao/README.md。
-->

---
class: slide-light slide-value
---

<div class="eyebrow">EFFICIENCY / 把一次交接变成一次工具调用</div>
<h1>把验证前移，<br><em>把迭代交给软件。</em></h1>
<div class="value-grid"><div><span class="type-label">更早开始</span><h2>器件未到<br>固件先跑</h2><p>已有模型提供运行环境，<br>减少开发对实物到货的依赖。</p></div><div><span class="type-label">更短反馈</span><h2>失败信息<br>直接回到 Agent</h2><p>从规则、编译到行为断言，<br>工具结果驱动下一轮修复。</p></div><div><span class="type-label">更易复验</span><h2>工程与验收<br>一起保留</h2><p>修改代码后执行既定步骤，<br>让结果可以重跑与审查。</p></div></div>
<div class="takeaway">人定义目标与验收边界，Agent 执行生成、运行和修复。</div>
<div class="bottom-note">效率用首次运行耗时、自动验收通过率与人工介入次数衡量；当前不预设提升倍数。</div>
<div class="page-number">09 / 10</div>

<!--
建议 45 秒。把前面的技术还原为效率收益的机制：不用等齐所有实物才开始编写和运行；工具错误直接反馈模型，减少人工搬运日志；同一套验收标准可以在修复后重新运行。
这些是可以衡量的效率来源，当前没有对照实验数字，不给出“提升十倍”之类结论。可在后续真实项目中记录从需求到首次可运行工程的耗时、固定验收的通过率、人工介入次数和实物返工；批量团队回归与硬件在环属于下一步。
-->

---
class: slide-dark slide-close
---

<div class="eyebrow">PAO / 面向 AI AGENT 的硬件开发</div>
<h1>让硬件开发，<br>拥有<em>软件的迭代速度。</em></h1>
<div class="closing-equation"><div><b>代码</b><span>让 Agent 能动手</span></div><i>+</i><div><b>评估函数</b><span>让结果可判断</span></div><i>+</i><div><b>芯片仿真</b><span>让闭环可执行</span></div></div>
<p class="closing-statement">在已支持范围内跑通自动闭环，<br>向更多模块、更完整验收与实物对照推进。</p>
<div class="team">Zhiqiang Zhang · 硬件、底盘与板级集成<br>jimyag · 构建、模拟器、语音与网页控制</div>
<div class="repo-address">github.com/pao-1024/pao</div>
<div class="page-number">10 / 10</div>

<!--
建议 45 秒。收尾：我们希望硬件开发也具备软件开发的迭代方式。代码让 Agent 能生成和修改，评估函数让它知道是否做对，透明芯片仿真让它在没有实物时也能执行验证。三者合起来，才是全自动开发闭环的基础。
当前本地工作台已在内置器件与模型范围内实现选型、接线、PCB、固件和软件在环闭环。接下来扩展完整模块定义、驱动、模型与验收，并用实物对照校正模型。人负责目标、验收边界和实物确认；不宣称任意硬件已全自动交付。
-->
