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
<div class="language-summary">
  <div class="language-heading"><strong>仓库语言分布</strong><span>占比与主要代码落点</span></div>
  <div class="language-bar" aria-label="TypeScript 51.6%，C++ 17.6%，Python 9.3%，JavaScript 6.6%，CSS 5.8%，Rust 5.2%，其他 4.0%">
    <span class="lang-ts" style="flex: 51.6"></span><span class="lang-cpp" style="flex: 17.6"></span><span class="lang-py" style="flex: 9.3"></span><span class="lang-js" style="flex: 6.6"></span><span class="lang-css" style="flex: 5.8"></span><span class="lang-rust" style="flex: 5.2"></span><span class="lang-other" style="flex: 4"></span>
  </div>
  <ul class="language-legend">
    <li class="lang-ts"><i></i><strong>TypeScript 51.6%</strong><small>平台 / 电路 / 网页</small></li>
    <li class="lang-cpp"><i></i><strong>C++ 17.6%</strong><small>固件</small></li>
    <li class="lang-py"><i></i><strong>Python 9.3%</strong><small>机械 / 工具</small></li>
    <li class="lang-js"><i></i><strong>JavaScript 6.6%</strong><small>平台 / 网页</small></li>
    <li class="lang-css"><i></i><strong>CSS 5.8%</strong><small>平台 / 演示界面</small></li>
    <li class="lang-rust"><i></i><strong>Rust 5.2%</strong><small>模拟器</small></li>
    <li class="lang-other"><i></i><strong>Other 4.0%</strong><small>Go / Shell 等</small></li>
  </ul>
</div>
<div class="bottom-note">来源：<a href="https://github.com/pao-1024/pao">GitHub Languages</a> · 2026-11-03 · 模块名称表示主要代码落点</div>
<div class="page-number">02 / 18</div>

<!--
建议 35 秒。硬件研发围绕三类核心设计：电路、嵌入式软件与机械结构。仿真、测试和评估是贯穿三者的反馈机制，不是额外的一类设计。
电路用 tscircuit 表达器件和网络，以连通性和电气规则检查；软件由 ESP-IDF 构建，在 esp32sim 中执行正式固件，以业务状态和外设输出评估；机械结构由 Agent 编写 CadQuery 参数化模型，以几何检查与 PyBullet 刚体动力学评估。全代码化也让电路与机械结构沿用版本控制、PR 审查与自动检查，下一页展开。
语言占比取自 GitHub Languages，按仓库识别的源码字节数计算；模块名称只说明主要代码落点，不表示该模块内部的语言比例。
来源：hardware/index.tsx；experimental/platform/README.md；simulator/README.md；mechanical/cadquery-launcher/README.md。
-->
