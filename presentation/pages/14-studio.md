---
class: slide-light slide-studio
---

<div class="eyebrow">PAO STUDIO / 实验原型与后续规划</div>
<h1>PAO Studio：<em>把流程变成工作台。</em></h1>
<div class="requirement"><span>目标体验</span><p>从一句需求，得到可构建、可仿真、可复验的工程。</p></div>
<div class="studio-gallery"><figure><img src="/reference/agent-hardware-preview.jpg" alt="Studio 的 Agent 选型与模块接线界面" /><figcaption>真实模块与接线约束</figcaption></figure><figure><img src="/reference/agent-pcb-preview.jpg" alt="Studio 生成的模块载板 PCB 界面" /><figcaption>原理图、模块载板与 DRC</figcaption></figure><figure><img src="/reference/manufacturing-preview.jpg" alt="Studio 制造文件预览界面" /><figcaption>可导出的工程与制造资料</figcaption></figure></div>
<div class="studio-output"><code>hardware.tsx / pcb.json</code><span>同一接线</span><code>wiring.h / board.json</code><span>编译 + 仿真</span><b>执行验收</b></div>
<div class="bottom-note">原型已支持内置模块的选型、接线、载板生成、固件编译与 SIL 验收。</div>
<div class="page-number">16 / 18</div>

<!--
建议 20 秒（8:45–9:05，含切页与视频展示）。

工作台的目标是让大家从一个需求出发，方便地开发出可构建、可仿真、可复验的工程。

当前实验原型已支持内置模块的选型、接线、载板生成、业务固件编译与软件在环验收。更多模块、批量回归、硬件在环和实物样板验收还需要继续完善。

### 备查

PAO Studio 已有实验原型，把选型、接线、编译与仿真验收串在一个工作台里，后续继续完善。
可以用声音告警需求说明目标体验：从选型和工程生成到编译、仿真，保留同一工程的验收证据。画面来自 experimental/platform 的实验原型，已支持内置模块范围内的选型、接线、载板生成、业务固件编译与软件在环（SIL）验收；更多模块、批量 SIL、硬件在环与实物样板验收仍在规划中。完整工作台仍需完善，PAO 实车也不是一次性自动生成。来源：docs/platform-roadmap.md；experimental/platform/README.md。
-->
