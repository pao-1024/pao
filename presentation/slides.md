---
theme: default
title: PAO · 一句话，让车动起来
info: 2026 1024 Hackathon 智能硬件赛道决赛答辩
class: slide-dark slide-cover
aspectRatio: 16/9
canvasWidth: 1280
transition: fade-out
---

<div class="hero-photo"><img src="/release/photo-12-first-rollout.jpg" alt="PAO 实车" /></div>
<div class="hero-wash"></div>
<div class="slide-kicker light">2026 1024 HACKATHON · 智能硬件赛道</div>
<div class="hero-copy">
  <div class="hero-name">PAO<span class="hero-pulse"></span></div>
  <h1>一句话，<br>让车动起来<span class="accent">。</span></h1>
  <p>一台能听指令的真实小车，一条可复用的硬件开发路径。</p>
</div>
<div class="slide-index light">01 / 10</div>

<!--
建议 30 秒。让实车动作或录像先出现，再亮出标题。
开场：先看小炮做一件事。PAO 是我们做出的语音小车；做完这台车后，我们还想让下一台硬件在器件没到齐时，就能先检查设计、编译固件、验证关键行为。
-->

---
class: slide-paper
---

<div class="slide-kicker">WHY / 为什么做</div>
<h1>让硬件问题<br><span class="accent">更早暴露。</span></h1>
<p class="lead">接线、固件和外设行为需要反复对齐。问题发现得越晚，越需要重新接线、编译和上机。</p>
<div class="process-line">
  <div><span>需求</span><small>想做什么</small></div>
  <div><span>接线</span><small>能否安全连接</small></div>
  <div><span>固件</span><small>能否编译运行</small></div>
  <div class="process-final"><span>上机</span><small>实物表现如何</small></div>
</div>
<div class="slide-callout">目标：把能提前验证的错误，留在上机之前。</div>
<div class="slide-index">02 / 10</div>

<!--
建议 35 秒。只举一个工程例子：引脚或总线配置不匹配，可以在接线检查和固件运行阶段提前发现。
不要给出未经测量的节省成本或时间比例。
-->

---
class: slide-dark slide-product
---

<div class="product-photo"><img src="/release/photo-03-motion-check.jpg" alt="PAO 正面与测距模块" /></div>
<div class="slide-kicker light">PRODUCT / 已做出的实车</div>
<h1>PAO 能听、<br>能动、能反馈。</h1>
<div class="capabilities">
  <div><strong>听</strong><span>唤醒与语音指令</span></div>
  <div><strong>动</strong><span>前后行驶、转向、停车</span></div>
  <div><strong>看</strong><span>测距与 OLED 状态</span></div>
  <div><strong>执行</strong><span>网页遥控与单次发射</span></div>
</div>
<div class="slide-index light">03 / 10</div>

<!--
建议 50 秒。照片指向实物；用动作和反馈解释，不逐项报器件型号和 GPIO。
PAO 的语音、网页遥控、测距、OLED 与发射功能见项目 README。不要把模拟器行为当作实车测量结果。
-->

---
class: slide-paper slide-demo
---

<div class="slide-kicker">LIVE / 现场演示</div>
<h1>一句话，变成<br><span class="accent">车轮的动作。</span></h1>
<div class="demo-steps">
  <div class="demo-step"><b>01</b><span>“小炮小炮”</span><small>唤醒设备</small></div>
  <div class="demo-step"><b>02</b><span>查询前方距离</span><small>听到真实返回</small></div>
  <div class="demo-step"><b>03</b><span>短程前进 → 停车</span><small>看到车轮执行</small></div>
</div>
<div class="demo-foot">
  <p>语音服务 → MCP 工具 → PAO 固件 → 电机与屏幕</p>
  <a href="https://github.com/pao-1024/pao/blob/main/docs/making-of.md#演示视频" target="_blank" rel="noopener noreferrer">实车演示视频 ↗</a>
</div>
<div class="slide-index">04 / 10</div>

<!--
建议 75 秒。现场优先演示查询距离、短程运动和停车，确保评委看到车体动作与 OLED 反馈。
发射展示项目已有测试视频；现场语音条件不稳定时切到实车视频，按相同讲述顺序继续。
-->

---
class: slide-paper slide-architecture
---

<div class="slide-kicker">SYSTEM / ESP-IDF · C++ · MCP · WebSocket</div>
<h1>两条入口，<span class="accent">一套动作逻辑。</span></h1>

<div class="architecture-graphic"><img src="/architecture.svg" alt="语音 MCP 与网页 WebSocket 并列汇入 PaoBoard，再控制底盘、测距和发射的架构图" /></div>

<div class="architecture-strip"><span>参数校验</span><span>动作取消</span><span>指令有效期</span><span>停车</span></div>
<div class="slide-index">05 / 10</div>

<!--
建议 55 秒。MCP 与 WebSocket 是并列入口，都汇合到板级控制逻辑。板级实现见 firmware/boards/pao/pao_board.cc。
讲一例：网页断开或指令过期后不续发，设备侧负责停车；语音与网页共用动作及参数校验。
-->

---
class: slide-dark slide-simulator
---

<div class="slide-kicker light">SIMULATOR / esp32sim · Rust · React · Three.js</div>
<h1>同一份固件，<br>在浏览器里也能跑。</h1>
<div class="simulator-shot"><img src="/reference/simulator-overview.png" alt="PAO 模拟器总览" /></div>
<div class="simulator-facts">
  <div><b>ROM</b><span>从芯片启动</span></div>
  <div><b>I²C</b><span>驱动 OLED</span></div>
  <div><b>MCPWM</b><span>驱动 3D 位姿</span></div>
</div>
<a class="small-link" href="https://github.com/user-attachments/assets/b82adcdc-420b-4e07-abb6-0e4ae3ad228b" target="_blank" rel="noopener noreferrer">模拟器演示 ↗</a>
<div class="slide-index light">06 / 10</div>

<!--
建议 60 秒。模拟器从 ROM 启动仓库构建的 PAO 正式固件；屏幕来自 I²C 写入，3D 小车运动来自 MCPWM 输出。Rust/esp32sim 实现芯片仿真，React/Three.js 呈现可观察的 3D 场景。
电脑麦克风与扬声器可参与语音交互。模拟器覆盖已建模的数字接口，不等于实物性能测试。
-->

---
class: slide-paper slide-studio
---

<div class="slide-kicker">PAO STUDIO / React · TypeScript · tscircuit</div>
<h1>把需求变成<span class="accent">可检查的工程。</span></h1>
<div class="studio-gallery">
  <figure><img src="/reference/agent-hardware-preview.jpg" alt="PAO Studio Agent 选型与接线" /><figcaption><b>01</b> 真实模块选型与接线</figcaption></figure>
  <figure><img src="/reference/agent-pcb-preview.jpg" alt="PAO Studio PCB 载板" /><figcaption><b>02</b> 原理图、PCB 与规则检查</figcaption></figure>
  <figure><img src="/reference/manufacturing-preview.jpg" alt="PAO Studio 制造文件预览" /><figcaption><b>03</b> 制造检查与工程导出</figcaption></figure>
</div>
<div class="studio-flow">自然语言需求 <i>→</i> 选型接线 <i>→</i> PCB / DRC <i>→</i> 固件编译 <i>→</i> 软件在环验收</div>
<div class="slide-index">07 / 10</div>

<!--
建议 85 秒。用一个工作台已支持的需求贯穿：React/TypeScript 实现工作台交互，tscircuit 参与电路生成；Agent 选择内置真实模块、补齐接线与电气约束，生成原理图和 PCB，检查制造规则，再编译按当前接线生成的固件，在 esp32sim 中验收。
制造文件在规则通过后导出。当前是本地实验能力，范围限于已有器件、驱动和模型；Studio 自由组合板型与 PAO 参考机分别维护。
-->

---
class: slide-dark slide-code
---

<div class="slide-kicker light">SOURCE CODE / 从硬件到演示</div>
<h1>从电路到这份 PPT，<br><span class="accent">都是代码。</span></h1>
<div class="source-panel">
  <div class="source-panel-head"><span>pao/</span><span>FRAMEWORK → RESULT</span></div>
  <div class="source-row"><code>hardware/index.tsx</code><span>tscircuit · TSX</span><b>电路</b></div>
  <div class="source-row"><code>firmware/boards/pao/pao_board.cc</code><span>ESP-IDF · C++</span><b>板级控制</b></div>
  <div class="source-row"><code>simulator/pao-sim/src/main.rs</code><span>esp32sim · Rust</span><b>芯片仿真</b></div>
  <div class="source-row"><code>simulator/web/car3d.tsx</code><span>React · Three.js</span><b>3D 交互</b></div>
  <div class="source-row"><code>experimental/platform/src/main.tsx</code><span>React · TypeScript</span><b>Studio</b></div>
  <div class="source-row source-row-self"><code>presentation/slides.md</code><span>Slidev · Markdown</span><b>正在看的 PPT</b></div>
</div>
<div class="source-foot">系统图同样有源码：<code>presentation/architecture.mmd</code> → Mermaid</div>
<div class="slide-index light">08 / 10</div>

<!--
建议 70 秒。这页可以现场打开仓库源码：hardware/index.tsx 是可追踪的电路定义，pao_board.cc 是控制汇合点，main.rs 与 car3d.tsx 对应芯片和 3D 场景，Studio 是 React/TypeScript 工作台。
最后指出正在讲的这一页就在 presentation/slides.md；架构图有 Mermaid 源码。这里的“代码驱动”指各层有可审查的源码，不意味着软件在环替代了实物验收。
-->

---
class: slide-paper slide-evidence
---

<div class="slide-kicker">EVIDENCE / 验证边界</div>
<h1>每个结论，<span class="accent">都有对应证据。</span></h1>
<div class="evidence-grid">
  <div><span class="evidence-tag">实车</span><h2>动作与交互</h2><p>语音驾驶、网页遥控与发射演示证明具体场景中的实车行为。</p></div>
  <div><span class="evidence-tag">固件</span><h2>接口与业务</h2><p>正式固件从 ROM 启动；已建模接口由 I²C、MCPWM、I²S 等真实固件路径驱动。</p></div>
  <div><span class="evidence-tag">工程</span><h2>设计与制造检查</h2><p>原理图、PCB、DRC、Gerber / CAM、固件编译和软件在环结果分别记录。</p></div>
</div>
<div class="evidence-note">温升、射频、声学、机械负载及实际测量精度，仍需实物对照。</div>
<div class="slide-index">09 / 10</div>

<!--
建议 50 秒。明确区分实车视频、正式固件仿真、静态设计检查与制造文件检查。
不能把静态检查或 SIL 通过概括成全部硬件功能已经实物验收。
-->

---
class: slide-dark slide-close
---

<div class="close-photo"><img src="/release/photo-18-display-installed.jpg" alt="PAO 实车侧面" /></div>
<div class="slide-kicker light">NEXT / 从 PAO 出发</div>
<h1>让下一台硬件，<br><span class="accent">更早开始验证。</span></h1>
<p class="close-lead">PAO 是可见的验证产品。PAO Studio 是正在形成的开发工具链。</p>
<div class="close-next"><span>更多真实模块</span><span>可重复的回归场景</span><span>仿真与实物对照</span></div>
<div class="close-team">Zhiqiang Zhang · 硬件、底盘与板级集成<br>jimyag · 构建、模拟器、语音与网页控制</div>
<div class="slide-index light">10 / 10</div>

<!--
建议 45 秒。目标用户是独立开发者和小型硬件团队；商业化方向仍待真实项目验证。
收尾：今天展示的是一台真实工作的 PAO，以及一条已经在有限器件范围内跑通的开发链路。接下来，我们会用更多模块和实物对照，把这条链路做得更可靠。
-->
