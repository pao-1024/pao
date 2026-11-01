# Blender 原生凸轮发射器

这套模型完全由 Blender Python (`bpy`) 生成，不导入 OpenSCAD 或 STL。

## 当前状态

这是供弹、凸轮、击针和弹簧物理链的验证场景，不是已经能实体打印连续发射的完成版。

已验证：

- 动态复合击针经 `GENERIC_SPRING` 约束，能随凸轮后压并向前回位。
- 击针运动范围约 `41.66 mm` 到 `49.96 mm`。
- 弹仓、单球滑匣、接收板和炮管均为 Blender 原生网格。
- 每帧轨迹写到 `trace.csv`。

尚未通过：

- `validate.py` 要求三颗球都没有越过炮口。当前轨迹中球会越过 `160 mm`，因此验证脚本会明确失败。
- 未完成“一次只下一颗、稳定击发、连续补弹”的闭环。
- Blender 的对称球体刚体会在摩擦接触中产生数值漂移，必须更换供弹几何或接触设置后才能作为最终机构。

## 运行

```sh
blender --background --factory-startup --python mechanical/blender-cam-launcher/build_launcher.py
python3 mechanical/blender-cam-launcher/validate.py
```

当前 `validate.py` 失败是有意保留的回归信号，不应把失败改成通过来掩盖供弹异常。

## 文件

| 文件 | 内容 |
|---|---|
| `build_launcher.py` | Blender 原生建模、刚体、约束、烘焙和轨迹导出 |
| `launcher.blend` | 已烘焙的 Blender 场景 |
| `trace.csv` | 120 fps、240 帧的刚体位置记录 |
| `validate.py` | 轨迹完整性、击针行程和球越界检查 |

关联 issue：[#61](https://github.com/pao-1024/pao/issues/61)。
