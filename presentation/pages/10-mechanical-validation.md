---
class: slide-light slide-mechanical-validation
---

<div class="eyebrow">机械评估 / PyBullet 刚体动力学</div>
<h1>机械设计评估，<br><em>用三球出膛结果验收运动。</em></h1>
<div class="mechanical-validation-body">
  <figure class="mechanical-motion">
    <DemoVideo id="mechanical-launcher" title="三球旋转供弹刚体仿真" />
    <figcaption>俯视 + 侧视剖面 · 按仿真轨迹回放 · 2.5 倍慢放</figcaption>
  </figure>
  <div class="mechanical-results">
    <div class="mechanical-result-hero"><strong>3 / 3</strong><span>小球依次发射通过</span></div>
    <dl><div><dt>电机设定转速</dt><dd>40 rpm</dd></div><div><dt>相邻出膛间隔</dt><dd>约 0.50 s</dd></div><div><dt>出膛速度</dt><dd>1.36–1.44 m/s</dd></div></dl>
    <p>25 / 60 rpm 两个工况也通过三球验收；关闭弹性力后，没有小球达到发射速度阈值。</p>
    <div class="mechanical-validation-limit">仿真使用给定转速与线性弹性力，<br>实物电机负载与弹性件特性待测。</div>
  </div>
</div>
<div class="page-number">11 / 18</div>

<!--
建议 35 秒，播放左侧动画。动画由 simulate.py 的刚体轨迹生成，不是实物录像。默认 40 rpm、弹簧刚度 100 N/m、球质量 0.9 g；三球约在 0.197 / 0.695 / 1.195 s 出膛，速度 1.360 / 1.441 / 1.427 m/s。25 和 60 rpm 工况也通过三球验收。
关闭弹性力时有一球以约 0.13 m/s 滚出，低于 0.5 m/s 发射阈值，所以说“没有球达到发射速度”，不说“没有球出膛”。仿真直接给定电机转角，未评估扭矩余量；皮筋按线性力近似。
来源：mechanical/cadquery-launcher/simulate.py、animate.py、README.md；tmp/cadquery-launcher/result.json 为本地生成结果。
-->
