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

`task mechanical:print` 生成可导入切片软件的分件 STL 及对应 STEP，放在 `tmp/cadquery-launcher/print/`。`report.json` 记录各件包围盒与体积；生成时检查每个零件为单一有效 CAD 实体、STL 为封闭且法线朝外的体积网格，并检查活动件装配位置没有实体穿插。

| STL | 数量 | 用途 |
|---|---:|---|
| [chassis.stl](stl/chassis.stl) | 1 | 170 × 80 mm 平底底座、导轨、弹簧止挡与 TT 电机座 |
| [magazine.stl](stl/magazine.stl) | 1 | 三球立式弹仓与两处插接脚 |
| [gate.stl](stl/gate.stl) | 1 | 横向滑门与连接孔 |
| [striker.stl](stl/striker.stl) | 1 | 带弹簧挡肩和凸轮随动块的击针 |
| [cam.stl](stl/cam.stl) | 1 | 单削平轴配合孔的凸轮 |
| [cover.stl](stl/cover.stl) | 1 | 可拆卸炮管顶盖 |
| [motor_clamp.stl](stl/motor_clamp.stl) | 1 | 插接式电机压板 |
| [ball.stl](stl/ball.stl) | 3 | 直径 11 mm 的打印球 |
| [shaft_fit.stl](stl/shaft_fit.stl) | 1（先打） | 三种轴孔间隙试配件，沿 X 从左到右依次为 0.1、0.2、0.3 mm |

以 0.4 mm 喷嘴、0.2 mm 层高的 PETG 为初始切片条件；底座平放，凸轮已旋转为平放导出，薄滑门加裙边，弹仓与击针需要检查切片预览中的悬空区域并启用支撑，球建议高填充率打印后修整支撑痕。底座至少需要 170 × 80 mm 可用打印区域。先打印轴孔试配件和一个球，实测轴配合及弹仓通行，再打印其余零件。

非打印件仅为黄色 TT 减速电机，以及压缩弹簧或皮筋二选一。弹仓、电机压板与炮管盖使用打印插接结构，不需要螺钉或扎带。轴孔名义尺寸按直径 5.4 mm、单平面削到距圆弧 4.3 mm 设计；这两个数字需以手头电机和试配件核对。弹簧在击针后拉位置可用空间约 28.5 mm、前推位置约 54.5 mm；购买前需核对压缩高度、自由长和刚度，避免压到底或脱座。皮筋挂点已建模，皮筋工作长度与力曲线仍需实测。

Python 依赖由仓库根目录的 `pyproject.toml` 与 `uv.lock` 管理，Python 3.11。主要尺寸与弹簧参数在 `design.py`；`build.py` 生成 CadQuery 可编辑模型，`simulate.py` 使用相同尺寸建立 PyBullet 刚体场景，`render.py` 生成预览图。

## 仿真验收与边界

仿真以 960 Hz 计算、120 fps 记录轨迹。弹簧施加胡克定律力与线性阻尼，击针受直线约束；球、导轨、炮管、弹仓底口和滑门发生刚体碰撞。验收要求三颗球按顺序、每个凸轮周期一颗、以正向速度从炮管内通过炮口；无弹簧力的对照仿真必须没有球通过炮口。轨迹和逐球炮口速度可在 `result.json` 查看。

弹簧刚度 130 N/m、打印球质量约 0.9 g、摩擦参数和电机周期是仿真假设，并非实测值。凸轮与滑门目前分别按给定时序驱动，三球轨迹不能证明一台电机能自动供弹。曾尝试将挡球舌固定到击针上，但真实接触仿真出现同周期串球，故未采用。分件 STL 虽可切片，**整机仍不是打印后可直接使用的自动连发结构**；真实电机轴配合、弹簧或皮筋力曲线、打印公差和样机发射也尚未验证。
