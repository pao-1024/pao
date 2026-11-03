---
class: slide-light slide-source
---

<div class="eyebrow">FOUNDATION / 三类核心设计</div>
<h1>万物皆代码，<br><em>驱动全流程 Agent 自动化。</em></h1>
<div class="source-columns">
  <div class="source-card"><span class="type-label">电路设计</span><h2>tscircuit</h2><p>定义器件、引脚与网络</p><code>TSX → SVG / Circuit JSON<br>评估：连通性测试 / 电气规则</code></div>
  <div class="source-card"><span class="type-label">嵌入式软件</span><h2>ESP-IDF + esp32sim</h2><p>在芯片模型中运行正式固件</p><code>固件源码 → firmware.bin<br>评估：业务状态 / 外设实际输出</code></div>
  <div class="source-card"><span class="type-label">机械结构设计</span><h2>CadQuery + PyBullet</h2><p>参数化机构、装配与打印件</p><code>Python → STEP / STL<br>评估：几何检查 / 刚体动力学</code></div>
</div>
<div class="takeaway">全代码化，让电路与机械结构也能按软件工程的方式管理。</div>
<div class="bottom-note">连这份演示稿也是代码：presentation/slides.md · Slidev / Markdown</div>
<div class="page-number">02 / 18</div>

<!--
建议 35 秒。硬件研发围绕三类核心设计：电路、嵌入式软件与机械结构。仿真、测试和评估是贯穿三者的反馈机制，不是额外的一类设计。
电路用 tscircuit 表达器件和网络，以连通性和电气规则检查；软件由 ESP-IDF 构建，在 esp32sim 中执行正式固件，以业务状态和外设输出评估；机械结构由 Agent 编写 CadQuery 参数化模型，以几何检查与 PyBullet 刚体动力学评估。全代码化也让电路与机械结构沿用版本控制、PR 审查与自动检查，下一页展开。
来源：hardware/index.tsx；experimental/platform/README.md；simulator/README.md；mechanical/cadquery-launcher/README.md。
-->
