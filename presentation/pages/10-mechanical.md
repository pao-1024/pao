---
class: slide-light slide-mechanical
---

<div class="eyebrow">机械结构 / CadQuery 参数化建模</div>
<h1>一个电机，<br><em>完成供弹、储能与三球连发。</em></h1>
<div class="mechanical-design-body">
  <figure class="mechanical-assembly">
    <div class="mechanical-cad-crop"><img src="/reference/launcher_preview.png" alt="CadQuery 透明装配预览：底座、固定供弹板、三球转盘凸轮和直线撞针" /></div>
    <figcaption>CAD 装配预览 · 170 × 80 mm 底座 · Ø11 mm 打印小球</figcaption>
  </figure>
  <div class="mechanical-details">
    <div><span>01 / 定量供弹</span><h2>三槽转盘 + 固定出球窗</h2><p>转盘每转 120°，完成一轮供弹与发射。</p></div>
    <div><span>02 / 储能与释放</span><h2>凸轮拉回撞针，再脱扣释放</h2><p>弹簧座与成对皮筋挂点集成在打印件上。</p></div>
    <div><span>03 / 简化装配</span><h2>TT 电机直接驱动转盘</h2><p>D 形轴直连转盘与凸轮。</p></div>
  </div>
</div>
<div class="bottom-note">首球预装在发射膛，另外两球由转盘依次供弹。</div>
<div class="page-number">10 / 18</div>

<!--
建议 40 秒。这是独立的三球发射机构示例：CadQuery 建模，PyBullet 验收。TT 减速电机经 D 形轴驱动三槽转盘和三瓣凸轮，每转 120° 完成一次供弹与发射；固定供弹板决定出球位置，撞针沿底座滑槽运动。
弹簧和皮筋都可作储能件，安装位已集成在打印件上；弹簧尺寸、皮筋力曲线和电机轴配合待实测。图为 CAD 预览。后面实车视频用的仍是电磁铁发射机构。
来源：mechanical/cadquery-launcher/design.py、rotary_parts.py、README.md、images/launcher_preview.png。
-->
