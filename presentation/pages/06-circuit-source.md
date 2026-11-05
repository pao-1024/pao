---
class: slide-light slide-circuit-source
---

<div class="eyebrow">电路设计 / tscircuit</div>
<h1>同一份电路设计，<em>Agent 读代码，人看图纸。</em></h1>
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
    <AssetLink path="reference/pao-schematic.svg"><svg viewBox="267 358 130 52" role="img" aria-label="由左侧 OLED 代码生成的真实原理图局部，含 V3V3、GND、OLED_SDA 和 OLED_SCL"><image href="/reference/pao-schematic.svg" width="1200" height="600" /></svg></AssetLink>
    <figcaption><p>OLED_SDA ↔ GPIO41<br>OLED_SCL ↔ GPIO42</p><span>Controller.tsx 将主控引脚接入同名网络。</span></figcaption>
  </figure>
</div>
<div class="page-number">06 / 18</div>

<!--
建议 30 秒（2:25–2:55，含切页与视频展示）。

左边是我们使用tscircuit框架使用tsx描述的 OLED 模块， agent 可以通过读取 ts 代码理解 这个模块。

基于tsx代码我们也可以渲染出对应的图纸，原始代码很容易被Agent原生理解，渲染后的图纸很容易让人被理解。

### 备查

同一份电路设计，Agent 通过代码理解和修改，人通过生成的图纸审阅。左边是 Display.tsx 中真实的 OLED 模块定义，只省略绘图分区与坐标；右边是 tscircuit 生成的原始 SVG 局部。代码定义器件、引脚和四条网络连接，图纸由这些设计输入生成。
nets.ts 将 nets.display.sda 和 scl 定义为 OLED_SDA 与 OLED_SCL；Controller.tsx 把 GPIO41、GPIO42 接入相同网络。图上的同名网络表达电气连接，不要求每条连接都画成长导线。
这是 PAO 模块接线参考，不是 PCB 制造图。来源：hardware/sections/Display.tsx、Controller.tsx、hardware/nets.ts、hardware/components/Oled.tsx、hardware/schematic.svg。
-->
