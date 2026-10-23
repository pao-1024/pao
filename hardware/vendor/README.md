# 外部元件定义来源

此目录保留外部定义、固定版本与许可证，供核对实际复用内容。本项目只描述模块外部接线，不生成可制造的 PCB。

- [乐鑫 ESP32-S3 开发板](espressif/README.md)：官方完整 44 针 KiCad 符号，由 tscircuit 原生导入。
- 下列充电、升压模块：适配为 TSX 外部接口，保留固定版本来源链接和 MIT 许可证。

## TP4056 充电保护模块

- 来源：[TVilella/FritzingParts 的 TP4056.fzpz](https://github.com/TVilella/FritzingParts/blob/04ea66ccaefc164c8164eb469894cd1d65cc4bdb/TP4056.fzpz)。
- 许可证：`tp4056/LICENSE`（MIT，Thiago Vilella）；原件见上述固定版本链接。
- 转换组件：`../components/Tp4056.tsx` 中的 `Tp4056Protection`。

读取归档内 `.fzp` 的 `connector/description`，保留连接点顺序；原理图按左侧输入、右侧输出排布，便于阅读供电链路：

| Fritzing 连接点 | 原始描述 | TSX 引脚 | 接口名 |
| --- | --- | --- | --- |
| connector0 | + | pin1 | USB_PLUS |
| connector1 | - | pin2 | USB_MINUS |
| connector2 | OUT+ | pin3 | OUT_PLUS |
| connector3 | B+ | pin4 | B_PLUS |
| connector4 | B- | pin5 | B_MINUS |
| connector5 | OUT- | pin6 | OUT_MINUS |

`USB_PLUS`、`USB_MINUS` 表示上游的充电输入焊盘，本接线参考使用模块自身 USB 口，两个焊盘不接线。B− 与 OUT− 是不同接口，不能绕过保护电路直接并接。

## 5V 升压参考模块

- 来源：[barafael/MT3608-module-kicad 的 hw-045.lib](https://github.com/barafael/MT3608-module-kicad/blob/6eec783960051b95c91892367e1a1d637893db33/hw-045.lib)。
- 许可证：`mt3608/LICENSE`（MIT，Rafael Bachmann）；原件见上述固定版本链接。
- 转换组件：`../components/Boost5V.tsx` 中的 `Boost5VModule`。

复用现成 MT3608 板级四端子接口的 5V 升压参考；用户实际升压模块的型号尚未确认，不能据此认定照片中的芯片型号。

保留上游针脚编号和位置：左上 pin1 为 VIN＋，左下 pin2 为 VIN−，右下 pin3 为 VOUT−，右上 pin4 为 VOUT＋。上游 `.lib` 把 pin3 和 pin4 都标成 `VOUT-`；转换组件将 pin4 修正为 `VOUT_PLUS`。VIN− 与 VOUT− 在接线图中接公共地。
