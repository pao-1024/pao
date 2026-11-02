---
class: slide-light slide-runtime-detail
---

<div class="eyebrow">固件运行 / esp32sim</div>
<h1>固件运行，<em>用芯片仿真验证行为。</em></h1>
<div class="runtime-detail-body">
  <figure class="runtime-model"><DemoVideo id="video-05" title="模拟器语音交互演示" /><figcaption><b>esp32sim · PAO 参考模拟器</b></figcaption></figure>
  <div class="runtime-checks"><span class="detail-label">自由组合应用 · 运行评估函数</span><div><b>UART 日志</b><p>读取告警、音量、音调、电机与状态标签。</p></div><div><b>I²S / MCPWM 实际输出</b><p>PCM 峰值、提示音频率与桥臂占空比。</p></div><div><b>显示与暂停行为</b><p>OLED 显存到达；暂停后音频和电机归零。</p></div><div class="runtime-example"><b>失败如何反馈</b><p>“实际 PCM 峰值”与“期望值”一并返回 Agent。</p></div></div>
</div>
<div class="page-number">09 / 18</div>

<!--
建议 70 秒。正式固件由 ESP-IDF 构建后输入模拟器，从 ROM 启动，不需要另写仿真业务分支。OLED 来自 I²C 写入，运动来自 MCPWM，测距经过 GPIO / RMT，音频经过真实固件的 I²S 链路，屏幕和运动不是预置效果。模拟器实时输出 UART0 固件日志，可按关键字过滤，并从中解析设备状态。
运行评估按场景输入音频或传感器数据，读取实际输出。verifyApplication 检查 UART 业务状态，核对 PCM 峰值、音调频率和电机桥臂占空比；显示目前只确认显存到达，最后检查暂停归零。当前容差为 PCM 峰值差不超过 50、提示音频率差不超过 25Hz、桥臂占空比差不超过 1，这些是软件验收容差，不是实物精度。
无硬件运行让每轮修改都能获得执行反馈；温升、射频、声学与机械性能不由这些断言证明。左侧是 PAO 参考模拟器，右侧验收机制来自自由组合实验应用，两者使用各自板型。来源：simulator/README.md；experimental/platform/agent.ts:217–236。
-->
