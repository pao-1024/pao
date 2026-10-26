# PAO 制作过程

PAO 参考机使用两个减速电机、1S 电池与保护板、ESP32-S3、MX1508 电机驱动、
I2S 麦克风与功放、OLED、HC-SR04、发射继电器和 HU-064 电磁发射器。

接线、引脚和供电要求以[硬件接线说明](../hardware/README.md)为准，
固件功能与构建方法见[固件说明](../firmware/README.md)。

## 底盘装配

底盘使用亚克力层板、两个减速电机、两个驱动轮和万向轮。
从散件开始，装好轮组，再用铜柱连接上下两层车架，为电池、主控和其他模块留出安装空间。

![底盘散件][photo-11]

| 底盘轮组安装完成 | 底盘两层组装完成 |
| --- | --- |
| ![底盘轮组安装完成][photo-06] | ![底盘两层组装完成][photo-08] |

## 电磁发射器装配

HU-064 发射器独立装配后安装到整车顶部。

| 发射器电路焊接 | 发射线圈焊接 |
| --- | --- |
| ![HU-064 发射器电路焊接][photo-10] | ![HU-064 发射线圈焊接][photo-17] |

| 发射器电路组装完成 | 发射器外壳组装完成 |
| --- | --- |
| ![发射器电路组装完成][photo-04] | ![发射器亚克力外壳组装完成][photo-19] |

PAO 将 HU-064 作为整体模块接入，继电器触点只短接发射按钮。
发射器内部的高压升压、储能和放电回路不在整车接线中展开。

![发射器加装继电器][photo-15]

发射器由独立 3.3V 支路常供电，3.3V 单路继电器以低电平吸合。
上电后发射器就处于充能状态，软件没有断电手段；调试时不装弹丸，断电通过整机开关。

## 控制电路与装机前测试

控制电路使用 ESP32-S3、OLED、麦克风、功放、扬声器、HC-SR04 和电机驱动模块。

![控制器、屏幕、音频、测距与电机驱动模块散件][photo-16]

电池、主控和驱动分层安装，扬声器、OLED 与线束装入车架。
装机前的电路测试在工作台上进行，底盘、主控和独立发射器分别摆放，便于检查模块之间的连接。

| 底盘电路组装 | 装机前电路测试 |
| --- | --- |
| ![底盘电路组装][photo-09] | ![底盘、主控与发射器的装机前电路测试][photo-01] |

1S 电池经充电保护板供电，5V 升压给 ESP32-S3 和 MX1508；发射器与继电器使用独立的
5V 转 3.3V 支路，只与主控共地，不并入开发板 3V3。

ESP32-S3 通过 I2S 连接 INMP441 麦克风和 MAX98357 功放，通过 I2C 连接 SSD1306 OLED，
再用 MCPWM 驱动 MX1508 的两路电机。OLED 显示设备状态、表情和访问地址，
网页遥控与语音控制共用同一套底盘和发射器驱动。

## 成品展示

发射器位于车体顶部，电池、主控、驱动、音频和显示模块安装在下方车架。

| 正面 | 后面 |
| --- | --- |
| ![成品正面][photo-03] | ![成品后面][photo-13] |

| 侧面 | 另一侧面 |
| --- | --- |
| ![成品侧面][photo-18] | ![成品另一侧面][photo-12] |

## 演示视频

| 视频 | 内容 |
| --- | --- |
| [语音控制][video-02] | 通过语音控制小车行驶和转向 |
| [遥控控制][video-01] | 通过手机遥控页控制底盘和发射 |
| [语音控制][video-03] | 通过语音控制小车在室内行驶 |
| [发射测试][video-04] | 在桌面场景触发电磁发射器 |

## 模拟器演示

[模拟器使用演示][video-05]展示在浏览器中通过语音控制正式固件，并查看 OLED、3D 小车、
I2C、PWM、I2S 和日志。

## 继续查看

- [硬件接线说明](../hardware/README.md)：模块、GPIO、供电域和发射器接线。
- [固件说明](../firmware/README.md)：语音工具、底盘、测距、发射器、遥控页和构建方式。
- [模拟器说明](../simulator/README.md)：用正式固件在浏览器里复现设备和交互。

[photo-01]: https://github.com/pao-1024/pao/releases/download/assets/photo-01-parts-overview.jpg
[photo-03]: https://github.com/pao-1024/pao/releases/download/assets/photo-03-motion-check.jpg
[photo-04]: https://github.com/pao-1024/pao/releases/download/assets/photo-04-motor-driver-bench.jpg
[photo-06]: https://github.com/pao-1024/pao/releases/download/assets/photo-06-motor-wheel-assemblies.jpg
[photo-08]: https://github.com/pao-1024/pao/releases/download/assets/photo-08-chassis-top-view.jpg
[photo-09]: https://github.com/pao-1024/pao/releases/download/assets/photo-09-electronics-integration.jpg
[photo-10]: https://github.com/pao-1024/pao/releases/download/assets/photo-10-custom-control-board.jpg
[photo-11]: https://github.com/pao-1024/pao/releases/download/assets/photo-11-component-arrangement.jpg
[photo-12]: https://github.com/pao-1024/pao/releases/download/assets/photo-12-first-rollout.jpg
[photo-13]: https://github.com/pao-1024/pao/releases/download/assets/photo-13-control-stack.jpg
[photo-15]: https://github.com/pao-1024/pao/releases/download/assets/photo-15-power-wiring.jpg
[photo-16]: https://github.com/pao-1024/pao/releases/download/assets/photo-16-electronics-layout.jpg
[photo-17]: https://github.com/pao-1024/pao/releases/download/assets/photo-17-launcher-coil.jpg
[photo-18]: https://github.com/pao-1024/pao/releases/download/assets/photo-18-display-installed.jpg
[photo-19]: https://github.com/pao-1024/pao/releases/download/assets/photo-19-launcher-relay.jpg
[video-01]: https://github.com/user-attachments/assets/86558584-a297-4060-9ab0-d9342689d7a4
[video-02]: https://github.com/user-attachments/assets/00f3ba4a-ebc6-4572-abdd-9d6d226bc902
[video-03]: https://github.com/user-attachments/assets/1410e80f-5f5c-41c7-aefa-fa4bdb594a81
[video-04]: https://github.com/user-attachments/assets/52e24651-2d71-49b4-80f9-46e723018991
[video-05]: https://github.com/user-attachments/assets/b82adcdc-420b-4e07-abb6-0e4ae3ad228b
