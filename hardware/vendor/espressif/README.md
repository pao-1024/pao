# 乐鑫 ESP32-S3-DevKitC 官方符号

- 来源：[espressif/kicad-libraries](https://github.com/espressif/kicad-libraries/blob/dd76561812ab300351234ba6e0ec1295641796f0/symbols/Espressif.kicad_sym)。
- 许可证：[CC-BY-SA 4.0 及电子设计例外](LICENSE.md)。
- 符号：`ESP32-S3-DevKitC`，完整 44 个物理引脚。
- 修改：将实例名占位符改为 `{REF}`，为矩形边框补充等价的闭合 polyline。

右侧排针按相反方向编号，`J3.n` 对应符号 `pin(45−n)`，例如 J3.7 / GPIO41 为 pin38，J3.1 / GND 为 pin44。重复的 GND 与 3V3 引脚在板上内部相连。
