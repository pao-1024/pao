# PAO 制作过程

PAO 从一组独立模块开始：两个减速电机、1S 电池与保护板、ESP32-S3、MX1508
电机驱动、I2S 麦克风与功放、OLED、HC-SR04、发射继电器和 HU-064 电磁发射器。
制作时没有先做完整外壳再往里塞电路，而是让结构、供电和固件一起收敛：先让底盘能跑，
再接上语音和屏幕，最后接入电磁发射器并完成整机联调。

本文记录参考机的手工制作路线。模块接线、引脚和供电约束以
[硬件接线说明](../hardware/README.md)为准，固件行为见[固件说明](../firmware/README.md)。
全部照片和视频保存在 [assets release](https://github.com/pao-1024/pao/releases/tag/assets)。

## 从零件到车架

先把电机、轮子、电源、控制和发射模块摊开，按底盘、供电、控制、发射四组整理接口和数量。
底盘最初用纸板打样轮距、轮径和安装孔，确认两个减速电机、轮组与层板能够对齐后，再切亚克力车架。

| 零件摊开 | 模块分组 |
| --- | --- |
| [![零件和模块摊开][photo-01]][asset-release] | [![按功能整理模块][photo-11]][asset-release] |

| 纸板结构打样 | 电机和轮组 |
| --- | --- |
| [![纸板底盘打样][photo-05]][asset-release] | [![两侧减速电机与轮组][photo-06]][asset-release] |

底盘采用上下分层。电机和轮组先固定在底层，再把电源、主控和驱动往上叠，利用层间空间走线，
同时把较重的电池放低，减少整车重心对转向的影响。

| 底层传动结构 | 顶层装配检查 |
| --- | --- |
| [![底层电机和轮组][photo-02]][asset-release] | [![从上方检查层板和设备位置][photo-08]][asset-release] |

第一轮测试只关心车轮能否稳定驱动、左右方向是否一致，以及起步和停车时车架是否扭动。
桌面空载测试完成后，再放到地毯上观察负载、偏航和振动。

| 桌面底盘测试 | 行驶姿态检查 |
| --- | --- |
| [![桌面底盘测试][photo-14]][asset-release] | [![完整车体行驶测试][photo-03]][asset-release] |

## 供电与电子

电源、电机驱动和控制模块先平铺在工作台上核对接口，再装进车体。1S 电池经充电保护板供电，
5V 升压给 ESP32-S3 和 MX1508；发射器与继电器使用独立的 5V 转 3.3V 支路，
只与主控共地，不并入开发板 3V3。

| 电源与模块平铺 | 供电和电机走线 |
| --- | --- |
| [![电源与电子模块平铺][photo-16]][asset-release] | [![电池、升压和电机驱动接线][photo-15]][asset-release] |

电机驱动先单独通电测试，再接入车体。屏幕上查看板卡图、接口和线路，能避免按实物排针顺序
反推信号；绿色转接板把相邻模块的排针和端子集中到一起，减少车体内部的飞线。

| 电机驱动台架测试 | 板卡和线路图 |
| --- | --- |
| [![MX1508 和电源台架测试][photo-04]][asset-release] | [![对照屏幕上的板卡图检查接线][photo-07]][asset-release] |

| 转接板与端子 | 控制层接线 |
| --- | --- |
| [![排针与端子转接板][photo-10]][asset-release] | [![控制模块和线束装配][photo-09]][asset-release] |

## 控制、语音与显示

ESP32-S3 通过 I2S 连接 INMP441 麦克风和 MAX98357 功放，通过 I2C 连接 SSD1306 OLED，
再用 MCPWM 驱动 MX1508 的两路电机。控制层、电池和驱动分层安装，传感器和执行器尽量靠近
各自对应的接插件，方便单层拆装和排障。

| 控制层与电池 | 顶部视角 |
| --- | --- |
| [![控制层与电池叠放][photo-13]][asset-release] | [![OLED 和语音控制模块安装后的顶部视角][photo-18]][asset-release] |

OLED 安装后用于显示设备状态、表情和访问地址。完成语音链路后，屏幕、扬声器、麦克风和
底盘共用同一套板级控制逻辑，网页遥控与语音控制最终都落到相同的底盘和发射器驱动上。

## 电磁发射器

发射器使用 HU-064 套件。PAO 不拆开内部高压升压、储能和放电回路，只把整机当作黑盒：
3.3V 供电后持续充能，FIRE 与 GND 短接等同于按下发射键。

| 发射线圈 | 继电器与发射单元 |
| --- | --- |
| [![HU-064 发射线圈][photo-17]][asset-release] | [![发射线圈、驱动板和继电器][photo-19]][asset-release] |

发射器由独立 3.3V 支路常供电，3.3V 单路继电器以低电平吸合，触点只短接发射按钮。
因此上电后发射器就处于充能状态，软件没有断电手段；调试时不装弹丸，断电只能通过整机开关。

## 整机联调

最后一次装配把亚克力车架、电子层、电池、发射器和线束固定到整机。外露走线保留了
快速替换模块的能力，也方便在联调时测量电压、检查继电器动作和观察底盘运动。

| 第一次完整落地 | 亚克力车架侧面 |
| --- | --- |
| [![第一次完整落地测试][photo-12]][asset-release] | [![亚克力车架层距和走线][photo-20]][asset-release] |

整机测试覆盖网页遥控、语音控制、OLED 状态、底盘运动和继电器发射。
最终状态不是封闭外壳里的成品，而是一台能继续拆换模块、继续测量和修正的参考机。

[![最终装配与接线检查][photo-21]][asset-release]

## 演示视频

| 视频 | 内容 | 时长 |
| --- | --- | --- |
| [驾驶演示][video-02] | 完整车体在室内地面行驶和转向 | 52 秒 |
| [手机控制界面][video-01] | 展示手机上的底盘与发射控制界面 | 27 秒 |
| [窄道行驶][video-03] | 在狭窄通道内向前行驶 | 12 秒 |
| [发射测试][video-04] | 在桌面场景触发电磁发射器 | 11 秒 |

以上视频通过 [GitHub 附件评论](https://github.com/pao-1024/pao/issues/55#issuecomment-6421112640)提供，点击后可直接播放。

## 继续查看

- [硬件接线说明](../hardware/README.md)：模块、GPIO、供电域和发射器接线。
- [固件说明](../firmware/README.md)：语音工具、底盘、测距、发射器、遥控页和构建方式。
- [模拟器说明](../simulator/README.md)：用正式固件在浏览器里复现设备和交互。

[asset-release]: https://github.com/pao-1024/pao/releases/tag/assets
[photo-01]: https://github.com/pao-1024/pao/releases/download/assets/photo-01-parts-overview.jpg
[photo-02]: https://github.com/pao-1024/pao/releases/download/assets/photo-02-drive-train-base.jpg
[photo-03]: https://github.com/pao-1024/pao/releases/download/assets/photo-03-motion-check.jpg
[photo-04]: https://github.com/pao-1024/pao/releases/download/assets/photo-04-motor-driver-bench.jpg
[photo-05]: https://github.com/pao-1024/pao/releases/download/assets/photo-05-cardboard-chassis-patterns.jpg
[photo-06]: https://github.com/pao-1024/pao/releases/download/assets/photo-06-motor-wheel-assemblies.jpg
[photo-07]: https://github.com/pao-1024/pao/releases/download/assets/photo-07-pcb-layout.jpg
[photo-08]: https://github.com/pao-1024/pao/releases/download/assets/photo-08-chassis-top-view.jpg
[photo-09]: https://github.com/pao-1024/pao/releases/download/assets/photo-09-electronics-integration.jpg
[photo-10]: https://github.com/pao-1024/pao/releases/download/assets/photo-10-custom-control-board.jpg
[photo-11]: https://github.com/pao-1024/pao/releases/download/assets/photo-11-component-arrangement.jpg
[photo-12]: https://github.com/pao-1024/pao/releases/download/assets/photo-12-first-rollout.jpg
[photo-13]: https://github.com/pao-1024/pao/releases/download/assets/photo-13-control-stack.jpg
[photo-14]: https://github.com/pao-1024/pao/releases/download/assets/photo-14-chassis-test.jpg
[photo-15]: https://github.com/pao-1024/pao/releases/download/assets/photo-15-power-wiring.jpg
[photo-16]: https://github.com/pao-1024/pao/releases/download/assets/photo-16-electronics-layout.jpg
[photo-17]: https://github.com/pao-1024/pao/releases/download/assets/photo-17-launcher-coil.jpg
[photo-18]: https://github.com/pao-1024/pao/releases/download/assets/photo-18-display-installed.jpg
[photo-19]: https://github.com/pao-1024/pao/releases/download/assets/photo-19-launcher-relay.jpg
[photo-20]: https://github.com/pao-1024/pao/releases/download/assets/photo-20-acrylic-chassis.jpg
[photo-21]: https://github.com/pao-1024/pao/releases/download/assets/photo-21-final-assembly.jpg
[video-01]: https://github.com/pao-1024/pao/issues/55#issuecomment-6421112640
[video-02]: https://github.com/pao-1024/pao/issues/55#issuecomment-6421112640
[video-03]: https://github.com/pao-1024/pao/issues/55#issuecomment-6421112640
[video-04]: https://github.com/pao-1024/pao/issues/55#issuecomment-6421112640
