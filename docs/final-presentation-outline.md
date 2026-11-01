# PAO 决赛答辩大纲

面向 2026 1024 Hackathon 智能硬件赛道，按 10 分钟、十三页展示设计：讲述约 9 分 15 秒，预留约 45 秒给切换和现场停顿。核心叙事是：**探索 Agent 时代的硬件开发新范式：代码让 Agent 能动手，评估函数让 Agent 知道是否做对，模拟器让评估可自动执行。**

可运行的演示稿见根目录 [presentation/](../presentation/README.md)。

观众应记住三件事：电路设计、固件编写、固件运行与机械结构都进入 Agent 驱动的开发流程；每个环节都要有对应评估，才能确定下一步修改；代码、工具执行和反馈共同缩短开发迭代。电子工程部分展示现有代码与透明芯片级仿真，机械部分展示当前在 Blender 中开展的 Agent 建模与刚体动力学评估研发。PAO 实机演示之后，再展望 PAO Studio 平台化与全流程 Skill。

讲述顺序是先用“万物皆代码，驱动全流程 Agent 自动化”总览四个部分，再说明工程资产如何入库复用、变更如何通过 PR 共同审查。随后解释评估函数，逐项展开电路、固件、运行和机械结构：各环节由 Agent 操作、工具执行，并以评估反馈驱动修复。区分已有实验实现与当前研发状态，不把全流程方向表述成完整整机已全自动验收。

## 逐页安排

| 页码与时间 | 页面标题 | 讲述重点 | 画面与素材 |
| --- | --- | --- | --- |
| 1 · 0:00–0:25 | 探索 Agent 时代的硬件开发新范式 | 开场给出项目定位：把电路、固件、运行环境和机械结构纳入 Agent 可操作的工程，以评估驱动生成、执行与修复，用 PAO 验证这条路径。 | 主视觉呈现“电路设计 / 固件编写 / 固件运行 / 机械结构”。 |
| 2 · 0:25–1:00 | 万物皆代码，驱动全流程 Agent 自动化。 | 总览各环节如何被 Agent 操作：tscircuit / TSX 电路、ESP-IDF / C++ 固件、esp32sim 芯片仿真，以及当前 Blender 机械研发。工具负责执行，评估结果驱动后续修复。 | 四部分总览，突出各环节的 Agent 操作、执行工具与评估；机械标注“当前研发”。 |
| 3 · 1:00–1:35 | 全流程工程资产，可追溯、可复用、可重建。 | 将电路、固件、外设模型和评估规则作为工程资产管理。Git 历史可追溯设计变更，模块与验收场景可复用，依赖锁定与构建入口支持按版本重建。临时生成工程需整理保存后入库。 | 真实路径：`hardware/index.tsx` 与 `hardware/schematic.svg`、`firmware/boards/pao/` 与 `firmware/base.json`、`simulator/pao-sim/src/` 与 `simulator/pao-sim/Cargo.lock`、`hardware/test/connectivity.test.ts` 与 `experimental/platform/runtime.test.mjs`。 |
| 4 · 1:35–2:15 | 工程变更进入 PR，设计与验证一起审查。 | 用新增 HC-SR04 的 [PR #36](https://github.com/pao-1024/pao/pull/36)（提交 `9966479`）展示 `hardware/sections/Controller.tsx` 中 GPIO8 / GPIO9 两行接线代码的实际变更。人审接线与设计意图，工具检查网络和图纸一致性；PR 保留变更、验证记录与对应版本，便于协作和回溯。 | Mermaid `pr-review.mmd` 与真实 diff：`GPIO8: nets.ultrasonic.trig.selector,`、`GPIO9: nets.ultrasonic.echo.selector,`。Hardware CI 运行 `task test`，包含 `node --test test/connectivity.test.ts` 和 `cmp dist/index/schematic.svg schematic.svg`。 |
| 5 · 2:15–3:00 | 评估函数，决定 Agent 能否自己完成闭环 | 以“生成 → 工具执行 → 评估 → 修复”解释明确目标、定位偏差和固定标准复验。工具结果决定是否通过，错误回传 Agent；现有电子工程实验最多运行三轮，首份有效验收步骤固定。 | Mermaid 闭环图配合三项作用，用一条实际错误说明下一步如何确定。 |
| 6 · 3:00–3:30 | 电路设计，每条连接都可验证。 | tscircuit 从 TSX 描述生成原理图与电路网络，模块载板由本地实验工具生成。PAO 参考电路用 `assertNetwork` 比对完整网络成员；实验代码检查跨网短接、电气约束与制造 DRC，缺线、错误连接或铜几何不合规都应给出错误。 | 左侧放大[原始原理图](../hardware/schematic.svg)的 OLED 区域并说明代码生成，右侧对应连接评估。证据：`hardware/test/connectivity.test.ts`、`experimental/platform/src/electrical.ts`、`experimental/platform/src/manufacturing.ts`。 |
| 7 · 3:30–3:55 | 电路图纸，由 tscircuit 生成。 | 展示仓库由 tscircuit 实际生成的 PAO 模块接线原理图，将器件、引脚与网络对应到 TSX 代码和真实连通性断言。图纸用于说明工程产物，不作为 PCB 或实物验收证明。 | [原始 SVG](../hardware/schematic.svg)全图、OLED 局部放大与[连通性测试](../hardware/test/connectivity.test.ts)中的真实断言，原图可点击；图注标明“tscircuit · PAO 模块接线原理图（参考）”。 |
| 8 · 3:55–4:45 | 固件编写，把业务需求变成固件。 | 按接线生成 `main/wiring.h` 与 `board.json`，将 Agent 业务写入 `main/agent-app.h`，配合已有 `main/main.cpp` 与驱动组成 ESP-IDF 工程。`validateAgent` 检查代码和验收结构，`validateAgentHardware` 核对已接外设，再用 ESP-IDF 编译、链接验证工程。 | 左侧复用[业务生成与自动构建实际界面](../experimental/platform/agent-preview.jpg)，标注“已有实验原型”；右侧对应结构校验、硬件匹配与编译链接。证据：`experimental/platform/src/agent-spec.ts`、`experimental/platform/runtime.ts`。 |
| 9 · 4:45–5:50 | 固件运行，用芯片仿真验证行为。 | esp32sim 从 ROM 启动正式固件，在芯片与外设层执行 CPU 指令、寄存器和总线行为，对固件透明。无实物先运行主要链路，再用 `verifyApplication` 比对 UART、实际 PCM 与 MCPWM，检查 OLED 显存到达和暂停归零。当前容差为 PCM 峰值 ±50、音调 ±25 Hz、占空比 ±1 个百分点。 | 左侧复用[PAO 参考模拟器实际界面](../simulator/images/simulator-overview.png)，突出 esp32sim 与芯片透明性；右侧对应输出与验收断言，保留[模拟器演示](../simulator/README.md#页面)入口。 |
| 10 · 5:50–6:40 | 机械结构，Agent 建模，刚体仿真评估。 | 外壳、底盘、支架及其装配都属于机械结构。介绍 Blender 中当前开展的 Agent 建模与仿真研发：几何与装配检查回答尺寸、接口和干涉问题，刚体动力学评估回答运动、碰撞与姿态稳定性问题；具体场景与阈值按工程定义。 | 以流程示意表达 Agent 建模、几何 / 装配检查与 Blender 刚体仿真评估，标注“当前研发”；实际运行结论配对应素材。 |
| 11 · 6:40–7:35 | PAO，把这条路径带到真实世界 | 用 PAO 的语音、运动、测距与 OLED 展示模块、驱动和实物交互。实车证明对应设计与场景的行为；参考机与自由组合工程分别维护，需要实物环境的结论由实际测量确认。 | [实车照片](making-of.md#成品展示)、[实车演示视频](making-of.md#演示视频)，聚焦短程运动与停车。 |
| 12 · 7:35–8:25 | PAO Studio：把开发流程变成工作台 | 展望将工程路径平台化。已有本地实验原型可在支持模块范围内执行选型、接线、PCB、业务代码、编译与验收，作为产品化起点，继续整合开发工具与结果。 | [Agent 整机设计](../experimental/platform/agent-hardware-preview.jpg)、[PCB 载板](../experimental/platform/agent-pcb-preview.jpg)、[制造预览](../experimental/platform/manufacturing-preview.jpg)，标注“未来展望 / 实验原型”。 |
| 13 · 8:25–9:15 | 把这套开发流程，封装为可复用的 Skill | 展望将电路、固件、运行与机械结构的工具操作、工程产物、评估条件和失败反馈固化为 Skill，编排生成、构建、仿真、评估与修复；保留人工定义的目标和验收边界。 | 全流程 Skill 示意，明确标注“未来规划”；分工依据[团队与分工](../README.md#团队与分工)。 |

## 讲述口径

开场可说：“我们正在探索 Agent 时代的硬件开发新范式。从电路设计、固件编写和固件运行，到正在 Blender 中研发的机械结构自动化，Agent 都需要能操作的工程和能判断结果的评估。代码让它能动手，评估函数让它知道是否做对。我们用 PAO 验证这条路径，再探索如何复用到更多项目。”

收尾可说：“今天，电路、固件与芯片仿真已有可运行的工程，Agent 驱动的 Blender 机械建模与刚体仿真评估也正在研发。下一步，我们希望用 PAO Studio 整合这套开发体验，再将工具操作、评估条件和修复流程封装为可复用的 Skill，让更多项目沿着同一条可检查的路径迭代。”

“评估函数”是可执行的规则和断言：先明确完成条件，再把工程或运行结果与条件比较，返回通过或具体错误。首份有效验收场景由模型提出，并在修复中固定；仍需核对场景是否充分表达人的需求。固定标准能约束修复过程，不意味着已经完整证明需求正确。

工程资产入库让团队能查看变更历史、复用模块与验收规则，并依据锁定版本重新构建。当前可追踪资产包括 TSX 电路、固件源码、Rust 模型、测试和构建配置；`tmp/studio/` 中的生成工程不会自动进入 Git，需整理源码、配置与验收材料后保存入库。Blender 资产可采用同一流程，二进制模型应附预览和变更说明，较大的构建产物关联明确工程版本；当前仓库没有 `.blend` 文件。

PR 将设计意图、文件差异与验证结果放到同一审查上下文。示例展示 `Controller.tsx` 新增 Trig / Echo 接线，与同一 PR 的驱动、图纸和测试一起审查。相关 CI 按路径触发：Hardware 检查连通性与重新生成的图纸一致性；Firmware PR 只做静态检查，完整 ESP-IDF 构建在 `main`；Simulator / Platform 做检查、单测与构建，不执行真实应用 SIL。Blender 仿真及实机验收需另附证据。工作流配置说明现有自动检查范围，不表示已配置强制合并门禁。

电路评估分别来自 PAO 参考电路测试和本地实验代码的电气、PCB 检查。`assertNetwork` 比对编译后网络的全部成员，缺线或额外短接都会失败；`connectionError`、`electricalReport` 和 `manufacturingDrc` 检查接线与制造规则。短接检查依据网络关系和铜几何规则，不计算模拟短路电流。

固件评估先用 `validateAgent` 检查业务源码和验收数据，用 `validateAgentHardware` 核对场景需要的外设与接线是否匹配，再通过编译、链接判断工程能否生成固件。这些检查不代替运行行为验收；完整工程由平台模板、驱动、接线配置与 Agent 业务代码共同组成。

运行评估用 `verifyApplication` 核对 UART 状态、实际 I²S PCM 峰值与音调频率、电机桥臂占空比及暂停归零；OLED 当前检查显存是否到达，不逐像素判断画面。PCM 峰值 ±50、音调 ±25 Hz、占空比 ±1 个百分点是当前实现中的验收容差，不是传感器、电机或实机测量精度；数字波形测量也不等同于真实声学表现。

“全自动”指已支持模块范围内的选型、工程生成、编译、仿真验收和有限轮次修复；需求与验收目标仍需人确认，平台不自动刷写实物或下单生产。根目录 `hardware/` 的 TSX 是 PAO 参考接线图；Studio 生成的是模块安装载板，不表示重新设计了采购模块的内部电路。

“对固件透明”指正式应用与驱动沿用原有执行路径，不需要模拟器专用业务分支。主要固件链路可以无实物运行，覆盖范围取决于已有芯片和外设模型，当前没有“绝大部分代码”的覆盖率统计。软件在环不验证温升、射频、声学、机械负载或传感器实际精度。

机械结构包括外壳、底盘、支架及其装配。自动化设计与仿真是当前研发工作，由 Agent 驱动 Blender 建模；几何与装配检查评估尺寸、接口和干涉，刚体动力学仿真评估运动、接触和姿态。具体观测、阈值及通过记录按实际场景确认，不把评价问题写成已落地指标。刚体仿真不能据此证明外壳强度、形变或散热性能。PAO 参考模拟器的 PWM 简化位姿与 Blender 刚体仿真是不同实现，机械仿真结果也不代表实机已通过验收。

PAO Studio 放在实机演示后的未来展望中，表达将工程路径平台化、产品化的方向。仓库已有本地实验原型与部分自动开发机制，这些代码是能力证据，不代表成熟工作台已经交付。PAO 参考机和实验原型的自由组合板型分别维护；实车演示不能证明任意组合通过实物验收，也不能据此宣称 PAO 整车由 Studio 一键生成。后续推进目标见[平台规划](platform-roadmap.md)。

## 演示准备

- 第 3 页准备实际工程路径与版本锁定文件；第 4 页准备 PR #36 / `9966479` 中 [Controller.tsx](../hardware/sections/Controller.tsx) 的接线 diff、[Hardware 工作流](../.github/workflows/hardware.yml)与 [Taskfile](../hardware/Taskfile.yaml)，区分历史验证记录和当前 CI 配置。
- 第 5 页准备具体的编译或运行失败反馈；第 6 页准备连通性、短接检查与制造 DRC 源码；第 7 页确认原理图及原图链接可访问；第 8 页准备同一工程的配置、业务代码与编译日志。
- 第 9 页准备正式固件的构建与运行入口、验收断言、固件输出及[模拟器演示](../simulator/README.md#页面)。现场语音需要设备激活和麦克风授权，未具备条件时使用已有素材。
- 第 10 页按实际可用材料说明 Blender 当前研发与刚体仿真评估。流程图是机制说明；具体运行结论需要对应工程、场景与结果，不能用示意图代替验收证据。
- 第 11 页的实车演示选择可立即停车的短程动作，确保观众看到车体与反馈；备用为已有[实车视频](making-of.md#演示视频)。技术参数、完整接线和未展开的功能留到答辩追问。
- 第 12 页以已有实验原型说明未来 PAO Studio 的产品方向。使用预先核验的同一案例，区分原理图、PCB、DRC、Gerber / CAM、固件编译与软件在环结果。截图用于说明实验界面，结论以对应工程记录为准。

功能、验证方式及素材入口分别见[项目首页](../README.md)、[制作过程](making-of.md)、[模拟器说明](../simulator/README.md)和[Studio 说明](../experimental/platform/README.md)。
