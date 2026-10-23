# 乐鑫 ESP32-S3-DevKitC 官方符号

- 来源：[espressif/kicad-libraries](https://github.com/espressif/kicad-libraries/blob/dd76561812ab300351234ba6e0ec1295641796f0/symbols/Espressif.kicad_sym)，固定提交 `dd76561812ab300351234ba6e0ec1295641796f0`。
- 许可证：上游 CC-BY-SA 4.0，附对电子设计及生成文件的例外，原文保留在 [LICENSE.md](./LICENSE.md)。
- 提取：使用上游 `kicadts@0.0.53` 的 `parseKicadSym` 和 `KicadSymbolLib`，从全库选择完整的 `ESP32-S3-DevKitC` 符号并重新序列化。仅去除无关符号，未重建或删减 44 个物理引脚及其图形。
- 文本适配：使用同一 AST 将 `Reference` 的默认值 `U` 改成 tscircuit 的 `{REF}` 占位符，以显示实际实例名；保留原始文本位置、图形和引脚。
- 边框兼容：当前转换器将 `fill=background` 的矩形仅用作包围盒，原生组件导入时会漏画边框。提取脚本保留原矩形，并从 AST 的两个角点自动生成等价闭环 polyline，复用原 stroke/fill，使 tscircuit 绘制相同边框及底色；没有维护手工尺寸或修改引脚。
- 导入：tscircuit 原生处理 `.kicad_sym`，`components/Esp32S3.tsx` 从导入结果自动提取 GPIO 短别名，电源引脚保留官方名称，没有维护第二份引脚表。线宽设为 0.02，避免转换器的缺省值使边框及引脚过粗；所有坐标和文字保留。
- 引脚编号是上游将两列 22 针连续编号的方式；右侧排针按相反方向编号，`J3.n` 对应符号 `pin(45−n)`（例如 J3.7 / GPIO41 为 pin38，J3.1 / GND 为 pin44）。重复的 GND 与 3V3 引脚由 tscircuit 识别为板上内部相连。

在 `hardware/` 目录运行 `node vendor/espressif/extract.mjs` 可重现提取过程；该脚本使用当前依赖树中的 `kicadts`，不参与日常构建。
