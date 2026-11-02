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
<div class="page-number">08 / 18</div>

<!--
建议 25 秒。从 OLED 局部展开到整机：左侧是 tscircuit 从 hardware/index.tsx 生成的完整 schematic.svg。右侧是同一份设计的三种形态：TSX 组织模块，SVG 供人审阅，Circuit JSON 供工具检查。
图纸与网络来自同一次构建，避免图纸和验收各说各话。这里是模块间接线参考，不是 PCB 制造文件；模块内部电路、封装和机械尺寸不在本图中验证。生成入口：hardware/Taskfile.yaml 的 build 与 export。
-->
