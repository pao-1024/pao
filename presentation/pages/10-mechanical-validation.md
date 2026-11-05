---
class: slide-light slide-mechanical-validation
---

<div class="eyebrow">机械设计的评估函数 / 刚体仿真 + 运动断言</div>
<h1>打印之前，<br><em>先用 PyBullet 仿真验证三球连发。</em></h1>
<div class="mechanical-validation-body">
  <figure class="mechanical-motion">
    <DemoVideo id="mechanical-launcher" title="三球旋转供弹刚体仿真" />
    <figcaption>俯视 + 侧视剖面 · 按仿真轨迹回放 · 2.5 倍慢放</figcaption>
  </figure>
  <div class="mechanical-results">
    <div class="mechanical-result-hero"><strong>3 / 3</strong><span>小球依次发射通过</span></div>
    <dl><div><dt>电机设定转速</dt><dd>40 rpm</dd></div><div><dt>相邻出膛间隔</dt><dd>约 0.50 s</dd></div><div><dt>出膛速度</dt><dd>约 1.14 m/s</dd></div></dl>
    <p>25 / 60 rpm 工况也通过三球验收；关闭弹性力的首个供弹周期内，没有小球出膛。</p>
  </div>
</div>
<div class="page-number">11 / 18</div>

<!--
建议 50 秒（5:50–6:40，含切页与视频展示）。

如何预先知道我们设计的机械结构是可行的呢，这是Python导出的实际仿真的俯视图和侧视图的动画，这个动画是我们使用 PyBullet 这个物理引擎进行刚体动力学仿真实际导出的画面。

我们检查三颗球是否按顺序、每个供弹周期恰好发射一颗，以及出口速度是否达到阈值。刚体仿真与这些运动断言一起构成机械设计的评估函数；这证明的是所列仿真假设下的运动结果。

【预先打开这个链接，展示机械结构仿真结果的 \(位移，弹簧能量\)→时间 曲线】

[https://github.com/pao-1024/pao/tree/main/mechanical/cadquery-launcher](https://github.com/pao-1024/pao/tree/main/mechanical/cadquery-launcher)

### 备查

播放左侧动画。软件可以在硬件到货前测试，机械运动也可以在打印前先用仿真验证。动画由 simulate.py 的刚体轨迹生成，不是实物录像。默认 40 rpm、弹簧刚度 100 N/m、球质量 0.9 g；当前本地结果中，三球约在 0.223 / 0.723 / 1.223 s 出膛，速度均约 1.14 m/s。25 和 60 rpm 工况也通过三球验收。验收要求按顺序、每个 120° 周期恰好发射一球，且出口速度高于 0.7 m/s。
关闭弹性力的对照仅覆盖首个完整 120° 周期（0.5 s），当前结果没有球出膛，不验证后续堵料行为。仿真直接给定电机转角，未评估扭矩余量；皮筋按线性力近似。仿真轨迹与这些运动断言组成机械设计的评估函数。
来源：mechanical/cadquery-launcher/simulate.py、animate.py、README.md；tmp/cadquery-launcher/result.json 为本地生成结果。
-->
