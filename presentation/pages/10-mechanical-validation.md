---
class: slide-light slide-mechanical-validation
---

<div class="eyebrow">机械评估 / PyBullet 刚体动力学</div>
<h1>从模型到运动，<br><em>用三球出膛结果验收设计。</em></h1>
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
建议 35 秒，播放左侧动画。视频由 simulate.py 的刚体轨迹生成，显示转盘角度、撞针位置和小球运动，不是实物录像，也不是手工编排动画。默认 40 rpm、弹簧刚度 100 N/m、球质量 0.9 g。三球出膛时刻约为 0.197 / 0.695 / 1.195 s，速度 1.360 / 1.441 / 1.427 m/s。另有 25 和 60 rpm 两个工况的回归验收。
关闭弹性力的对照中有一球低速滚出，约 0.13 m/s，没有球达到 0.5 m/s 的发射阈值，因此不能表述为“无弹簧时完全没有球出膛”。最大储能约 0.00605 J。仿真强制电机转角，没有评估真实电机扭矩余量；皮筋按等效线性力建模，尚未实测非线性力曲线。撞针采用碰撞近似，实物摩擦、打印公差、耐久性仍需打印后验收。
来源：mechanical/cadquery-launcher/simulate.py、animate.py、README.md；tmp/cadquery-launcher/result.json 为本地生成结果。
-->
