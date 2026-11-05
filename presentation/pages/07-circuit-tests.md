---
class: slide-light slide-circuit-tests
---

<div class="eyebrow">电路设计的评估函数 / 单元测试与工程规则</div>
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
<div class="page-number">07 / 18</div>

<!--
建议 40 秒（2:55–3:35，含切页与视频展示）。

使用代码描述电路图纸后，我们甚至可以将图纸的一些关键部分使用标准的TypeScript单元测试来做自动化测试。

左侧测试断言 ESP32-S3 的 GPIO41、GPIO42 分别与 OLED 的 SDA、SCL 相连。右侧是实验平台的独立示例：VIN 已接 3.3V 时，再接 GND 必须被拒绝。

这样就可以甚至可以实现电路图的TDD开发流程。

**这是我们在电路设计方面的评估函数。**

### 备查

电路设计也能写单元测试。左侧把现有 OLED 测试循环中的两组参数展开：GPIO41 只能与 OLED.SDA 同网，GPIO42 只能与 OLED.SCL 同网。assertNetwork 读取构建后的 Circuit JSON，查找网络全部成员，再与独立记录的接线要求严格比较。少接、多接或短到其他信号都会失败；测试预期不从设计源码导入，避免跟着错误设计一起变化。
失败时 assert.deepEqual 报告实际和预期成员，这些证据反馈给 Agent，修改设计后重跑同一套验收。
右侧短接示例来自实验平台的另一个模块场景：VIN 已接到 3.3V 后再次连 GND，必须返回短接错误。载板 manufacturing.test.mjs 故意删线、改线宽和端点，确认铜连接或制造规则违规会阻止导出。这些是模块载板能力，不是左侧 PAO 参考图的 PCB 或实物验收。来源：hardware/test/connectivity.test.ts、experimental/platform/circuit.test.mjs、manufacturing.test.mjs。
-->
