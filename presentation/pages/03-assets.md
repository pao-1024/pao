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
    <div><b>机械与仿真</b><code>mechanical/cadquery-launcher/<br>simulator/pao-sim/src/</code></div>
    <div><b>测试与规则</b><code>hardware/test/connectivity.test.ts<br>experimental/platform/runtime.test.mjs</code></div>
  </div>
  <div class="asset-benefits">
    <div><h2>可追溯</h2><p>改动关联版本与审查记录。</p></div>
    <div><h2>可复用</h2><p>模块、驱动、模型与验收规则。</p></div>
    <div><h2>可重建</h2><p>保留源码、依赖与构建入口。</p></div>
  </div>
</div>
<div class="page-number">03 / 18</div>

<!--
建议 20 秒（0:50–1:10，含切页与视频展示）。

当硬件的资产代码化了之后，它就变成了和软件一样成为了一种可追溯可复用可重建的一种资产了。

### 备查

把软件工程的版本管理延伸到硬件工程：电路设计、固件配置、仿真模型与验收规则一起版本化，每次迭代都留下差异和原因，模块与测试也能在后续项目中复用。页面列出当前仓库已跟踪的真实文件，依赖通过 firmware/base.json、Cargo.lock、pnpm-lock.yaml、uv.lock 和 esp32sim gitlink 固定。
可重建指保留重建依据与入口，不承诺逐字节可复现。机械模型、动力学验收与打印件导出脚本也已纳入版本管理；STEP、STL 和动画由源码生成，保存在本地 tmp/。
来源：hardware/、firmware/base.json、simulator/pao-sim/、experimental/platform/、mechanical/cadquery-launcher/、uv.lock、.gitignore。
-->
