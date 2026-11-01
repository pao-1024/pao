---
class: slide-light slide-mechanical
---

<div class="eyebrow">机械结构 / Blender · 当前研发</div>
<h1>机械结构，<br><em>Agent 建模，刚体仿真评估。</em></h1>
<div class="mechanical-graphic"><img src="/diagrams/mechanical-loop.svg" alt="Agent 在 Blender 中生成和调整机械结构，刚体动力学仿真提供结果用于评估与下一轮修改" /></div>
<div class="mechanical-checks"><div><span>设计对象</span><h2>外壳、底盘、支架与装配</h2><p>尺寸、连接关系与结构参数。</p></div><div><span>几何与装配评估</span><h2>能否正确装在一起？</h2><p>尺寸、孔位、间隙与干涉。</p></div><div><span>刚体动力学评估</span><h2>运动是否符合目标？</h2><p>运动、碰撞与姿态。</p></div></div>
<div class="page-number">10 / 16</div>

<!--
建议 50 秒。机械结构同样是当前核心工作：由 Agent 驱动 Blender 建模与仿真，以刚体动力学结果评估设计。外壳也属于机械结构，包括底盘、支架、孔位和装配关系。
几何检查回答能否装配，刚体仿真回答运动、碰撞和姿态是否符合场景目标，结果为 Agent 下一轮调整提供依据。具体指标、阈值和场景随工程定义，不能只凭渲染图判断通过。刚体模型不证明外壳材料强度、弹性形变或散热。
Blender 链路仍在开发中，验收以对应工程、仿真场景与运行记录为准；它与 PAO 模拟器的简化 PWM 位姿显示是不同实现。
-->
