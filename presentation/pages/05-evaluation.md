---
class: slide-light slide-loop
---

<div class="eyebrow">EVALUATION / 评估函数</div>
<h1>评估函数，决定 Agent<br><em>能否自己完成闭环。</em></h1>
<div class="loop-graphic"><img src="/diagrams/agent-loop.svg" alt="Agent 生成候选工程，经工具执行和评估后，成功保留产物，失败携带证据返回修复" /></div>
<div class="loop-rules"><div><b>知道何时完成</b><span>需求变成可执行的通过条件</span></div><div><b>知道哪里要改</b><span>返回具体偏差</span></div><div><b>知道修复是否有效</b><span>修改后重跑同一验收</span></div></div>
<div class="page-number">05 / 18</div>

<!--
建议 45 秒。代码生成之后，谁来判断它是否做对？评估函数把需求变成可执行条件，读取工程和运行结果，给出通过结论或具体偏差。Agent 才能知道什么时候停止、哪里需要修改，以及修改是否有效。
评估函数包括规则检查、单元测试、编译结果与仿真断言。不能只让生成模型自己说完成；规则与工具结果提供独立反馈。原型中的第一份有效验收场景由模型提出，之后修复时固定，当前最多三轮；仍需人核对场景是否充分表达需求。
接下来展开电路、固件运行和机械结构。来源：experimental/platform/agent.ts 的 iterateApplication 与 runtime.test.mjs 中防止弱化验收的测试。
-->
