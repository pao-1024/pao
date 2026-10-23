# 外部元件定义来源

- [乐鑫 ESP32-S3 开发板](espressif/README.md)：官方 44 针 KiCad 符号。

## TP4056 充电保护模块

- 来源：[TVilella/FritzingParts 的 TP4056.fzpz](https://github.com/TVilella/FritzingParts/blob/04ea66ccaefc164c8164eb469894cd1d65cc4bdb/TP4056.fzpz)。
- 许可证：[MIT](https://github.com/TVilella/FritzingParts/blob/04ea66ccaefc164c8164eb469894cd1d65cc4bdb/LICENSE)（Thiago Vilella）。
- 组件：[Tp4056Protection](../components/Tp4056.tsx)。

使用模块自带的 USB 充电口，`USB_PLUS`、`USB_MINUS` 焊盘不接线。B− 与 OUT− 分别是电池负极和保护后负极。

## 5V 升压参考模块

- 来源：[barafael/MT3608-module-kicad 的 hw-045.lib](https://github.com/barafael/MT3608-module-kicad/blob/6eec783960051b95c91892367e1a1d637893db33/hw-045.lib)。
- 许可证：[MIT](https://github.com/barafael/MT3608-module-kicad/blob/6eec783960051b95c91892367e1a1d637893db33/LICENSE)（Rafael Bachmann）。
- 组件：[Boost5VModule](../components/Boost5V.tsx)。

保留四端子接口，将上游 pin4 的 `VOUT-` 笔误修正为 `VOUT_PLUS`。实际升压模块型号待确认。
