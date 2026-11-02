---
class: slide-light slide-mechanical-print
---

<div class="eyebrow">机械交付 / 源码生成打印件</div>
<h1>模型、仿真与打印文件，<br><em>由同一份设计源码生成。</em></h1>
<div class="mechanical-print-body">
  <figure class="mechanical-photo">
    <div class="mechanical-photo-placeholder" role="img" aria-label="3D 打印实物照片待补充，预留组装完成后的整机照片位置">
      <span class="mechanical-photo-tag">实物照片预留</span>
      <strong>3D 打印实物照片</strong>
      <p>待打印完成后补充</p>
      <span class="mechanical-photo-hint">整机装配 · 转盘供弹与弹性件安装细节</span>
    </div>
    <figcaption>预留照片位；实物装配与三球连发待验收。</figcaption>
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
建议 30 秒。打印文件不作为源码提交，使用 task mechanical:print 在本地导出八类 STL、分件 STEP 与检查报告，整机 STEP 由 model 入口生成。小球打印三个，其余类型默认各一个；轴孔试片用于核对 TT 电机实际 D 形轴尺寸。推荐先试配，再打印整套。完整打印说明以 mechanical/cadquery-launcher/README.md 为准。
左侧专门预留打印实物照片，当前没有实物照片，也未完成打印装配或实物三球连发验收。后续补充用户提供的实际照片并按照片内容修改图注。CAD 有效实体与封闭网格检查通过，初始装配干涉检查通过，不等于已经证明打印公差、强度和整机耐久性。软件工具链为 uv + Ruff + ty，任务入口在模块 Taskfile。
来源：mechanical/cadquery-launcher/print_parts.py、build.py、Taskfile.yaml、README.md；pyproject.toml、uv.lock。
-->
