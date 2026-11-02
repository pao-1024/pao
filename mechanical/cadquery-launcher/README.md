# CadQuery 弹簧连发机构

这套机械概念模型由底座、开放式炮管、三球立式弹仓、横向滑门、凸轮、螺旋弹簧和直线击针组成。它沿用 PAO 发射器实验的 170 × 80 mm 底座和 11 mm 球尺寸；炮管沿 X 正方向发射。该机构与参考机正在使用的 HU-064 电磁发射器是不同方案，不代表已经接入现有固件。

运行时，电机凸轮在每个周期将击针拉到后方。释放时，击针作为刚体受弹簧力回推，与弹仓底部的一颗球碰撞。球沿炮管滚动并越过 X=170 mm 的炮口。滑门随后横移一次，允许下一颗球落入发射位置，关闭后等待下一次击发。三颗球在三个独立周期发射。

![CadQuery 机构装配预览](images/launcher_preview.png)

![三球轨迹与弹簧储能变化](images/trajectory.png)

## 运行

在仓库根目录运行：

```sh
task mechanical:setup
task mechanical:check
task mechanical:preview
```

`check` 会执行 Ruff、ty、CadQuery 建模和 PyBullet 动力学验收。`preview` 额外生成装配图和轨迹图。也可以分别运行 `task mechanical:model`、`task mechanical:simulate`。所有生成文件放在本 worktree 的 `tmp/cadquery-launcher/`，包括装配及各零件 STEP、`trace.csv`、`result.json`、`launcher_preview.png` 和 `trajectory.png`。

Python 依赖由仓库根目录的 `pyproject.toml` 与 `uv.lock` 管理，Python 3.11。主要尺寸与弹簧参数在 `design.py`；`build.py` 生成 CadQuery 可编辑模型，`simulate.py` 使用相同尺寸建立 PyBullet 刚体场景，`render.py` 生成预览图。

## 仿真验收与边界

仿真以 960 Hz 计算、120 fps 记录轨迹。弹簧施加胡克定律力与线性阻尼，击针受直线约束；球、导轨、炮管、弹仓底口和滑门发生刚体碰撞。验收要求三颗球按顺序、每个凸轮周期一颗、以正向速度从炮管内通过炮口；无弹簧力的对照仿真必须没有球通过炮口。轨迹和逐球炮口速度可在 `result.json` 查看。

弹簧刚度 110 N/m、球质量 0.5 g、摩擦参数和电机周期是仿真假设，并非实测值。凸轮与滑门的运动目前由给定时序驱动；凸轮接触轮廓、滑门电机或连杆、弹簧预紧件、轴承、安装孔与打印公差尚未完成。STEP 是外形与装配概念，不应直接当作可打印成品或实物射程依据。实物制造前需确认弹簧选型、装配干涉、球材料与尺寸公差，并单独完成样机测试。
