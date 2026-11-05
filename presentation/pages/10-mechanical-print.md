---
class: slide-light slide-mechanical-print
---

<div class="eyebrow">机械交付 / 源码生成打印件</div>
<h1>代码中的机械设计，<br><em>已经做成了打印件。</em></h1>
<div class="mechanical-print-body">
  <figure class="mechanical-photo">
    <DemoVideo id="mechanical-physical" title="3D 打印发射机构实物展示" />
    <figcaption>3D 打印机构实物展示 · 装配与接线</figcaption>
  </figure>
  <div class="mechanical-delivery">
    <span class="detail-label">从参数模型到实物打印件</span>
    <p class="mechanical-parts">同一份设计源码<br>生成模型、仿真与打印文件</p>
    <div class="mechanical-print-command"><code>设计 → 仿真 → 打印</code><span>已完成打印件展示 · 实物连发待验收</span></div>
    <img class="mechanical-loop" src="/diagrams/mechanical-loop.svg" alt="Agent 调整 CadQuery 参数模型，经 PyBullet 刚体仿真和验收反馈继续迭代" />
  </div>
</div>
<div class="page-number">12 / 18</div>

<!--
建议 30 秒（6:40–7:10，含切页与视频展示）。

这是 CadQuery 模型导出的 3D 打印机构，视频展示打印件与接线。仿真已检查三球连发，实物的电机负载、装配配合和连续发射仍需单独验收。后面的实车发射视频使用的是电磁铁机构，与这个三球机构不同。

### 备查

前面展示的代码设计已经做成了打印件，视频展示实物与接线。模型、仿真与打印文件由同一份设计源码生成。task mechanical:print 在本地导出八类 STL、分件 STEP 和检查报告，整机 STEP 由 model 入口生成。零件包括底座、供弹板、转盘凸轮、撞针、电机桥、卡扣、小球和轴孔试片，本地 STL 输出在 tmp/cadquery-launcher/stl/。小球打印三个，其余各一个；先用轴孔试片核对 TT 电机 D 形轴，再打印整套。
左侧视频展示 3D 打印机构与接线，不能据此认定电机负载、实物连发、打印公差、强度或耐久性已通过验收。实体、封闭网格和初始装配干涉检查已通过。
来源：mechanical/cadquery-launcher/print_parts.py、build.py、Taskfile.yaml、README.md；pyproject.toml、uv.lock；https://github.com/pao-1024/pao/issues/55#issuecomment-6597724232。
-->
