---
class: slide-light slide-review
---

<div class="eyebrow">HARDWARE COLLABORATION / 软件协作方式用于硬件</div>
<h1>硬件变更进入 PR，<br><em>电路与固件一起审查。</em></h1>
<div class="review-graphic"><img src="/diagrams/pr-review.svg" alt="硬件变更提交 PR，由工具检查和人工审查共同提供依据，再决定合并并保留版本记录" /></div>
<div class="review-evidence">
  <div class="review-diff"><span class="detail-label">真实变更 · 新增超声波接线</span><a href="https://github.com/pao-1024/pao/pull/36/files" target="_blank" rel="noopener noreferrer">PR #36 · 9966479 · Controller.tsx ↗</a><code>+ GPIO8: nets.ultrasonic.trig.selector,<br>+ GPIO9: nets.ultrasonic.echo.selector,</code><p>接线与驱动、图纸、测试同一 PR 审查。</p></div>
  <div class="review-ci"><span class="detail-label">Hardware CI · 已配置的自动检查</span><span class="review-source">hardware/Taskfile.yaml · task test</span><code>node --test test/connectivity.test.ts<br>cmp dist/index/schematic.svg schematic.svg</code><p>检查连接关系，确认图纸与提交版本一致。</p></div>
</div>
<div class="page-number">04 / 18</div>

<!--
建议 35 秒（1:10–1:45，含切页与视频展示）。

它也可以使用PR的形式管理，被CI进行检查，被人工进行Review合并。使用整套Git的工作方式，实现硬件资产的可diff，可审查。

比如以我们的一个真实的PR为例，这个PR为PAO增加了超声波模块，其中HcSr04.tsx定义了超声波模块，nets.ts定义了线路，Ultrasonic.tsx定义了超声波模块如何连接到定义的走线上，Controller.tsx定义了ESP32 S3如何连接到定义的走线上。

### 备查

这里的价值是把 Git、PR 和持续集成延伸到硬件工程：接线、图纸、驱动和验收规则在同一个 PR 中审查。Agent 提交变更，工具执行已有检查，人审设计意图、约束与证据，再决定是否合并。发生问题时可回溯工程版本。
左侧来自 PR #36 的提交 99664793053145a98f8d7cd5adfa66f77db139f9：Controller.tsx 新增 GPIO8 的 Trig 与 GPIO9 的 Echo，并同步硬件、固件、图纸与说明。右侧命令来自 hardware/Taskfile.yaml，Hardware workflow 在 pull_request 上按路径触发 task test。这里展示的是检查配置，不代表所有 CI 已通过，也不代表已设置强制合并门禁。
来源：.github/workflows/{hardware,firmware,simulator,platform}.yml；hardware/Taskfile.yaml；PR #36。
-->
