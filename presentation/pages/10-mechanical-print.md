---
class: slide-light slide-mechanical-print
---

<div class="eyebrow">机械交付 / 源码生成打印件</div>
<h1>模型、仿真与打印文件，<br><em>由同一份设计源码生成。</em></h1>
<div class="mechanical-print-body">
  <figure class="mechanical-photo">
    <DemoVideo id="mechanical-physical" title="3D 打印发射机构实物展示" />
    <figcaption>3D 打印机构实物展示 · 装配与接线</figcaption>
  </figure>
  <div class="mechanical-delivery">
    <span class="detail-label">8 类 STL + 分件 STEP / 整机 STEP</span>
    <p class="mechanical-parts">底座 · 供弹板 · 转盘凸轮 · 撞针<br>电机桥 · 卡扣 · 小球 × 3 · 轴孔试片</p>
    <div class="mechanical-print-command"><code>task mechanical:print</code><span>本地输出：tmp/cadquery-launcher/stl/</span></div>
    <img class="mechanical-loop" src="/diagrams/mechanical-loop.svg" alt="Agent 调整 CadQuery 参数模型，经 PyBullet 刚体仿真和验收反馈继续迭代" />
    <p class="mechanical-print-status">已通过：实体有效性、网格封闭性与三球仿真。<br>待验证：打印配合、电机负载与实物连发。</p>
  </div>
</div>
<div class="page-number">12 / 18</div>

<!--
建议 30 秒。task mechanical:print 在本地导出八类 STL、分件 STEP 和检查报告，整机 STEP 由 model 入口生成。小球打印三个，其余各一个；先用轴孔试片核对 TT 电机 D 形轴，再打印整套。
左侧视频展示 3D 打印机构与接线，不能据此认定电机负载、实物连发、打印公差、强度或耐久性已通过验收。实体、封闭网格和初始装配干涉检查已通过。
来源：mechanical/cadquery-launcher/print_parts.py、build.py、Taskfile.yaml、README.md；pyproject.toml、uv.lock；https://github.com/pao-1024/pao/issues/55#issuecomment-6597724232。
-->
