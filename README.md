<div align="center">

<img src="docs/icon.svg" width="112" alt="PAO" />

# PAO

**PAO Aims Ordnance**

一台听得懂人话、会开火的小车

<sub>2026 1024 Hackathon · 智能硬件赛道</sub>

</div>

---

> ### PAO = PAO Aims Ordnance
>
> 这是一个**递归缩写**（recursive acronym）：全称的第一个词，就是缩写本身。
> 和 `GNU's Not Unix`、`YAML Ain't Markup Language`、`WINE Is Not an Emulator` 一样，
> 它的定义永远指回自己。说不清，也都说得清。

## 它是什么

不需要摇杆，不需要 App，不需要记指令表。**说出口，就打出去。**

## 硬件接线

[ESP32-S3 模块接线图与预览说明](hardware/README.md)：使用 tscircuit 描述供电、电机驱动、麦克风、功放、扬声器及 OLED 的连接。

## 项目 Skill

先安装 [Task v3](https://taskfile.dev/installation/)、Git 和 Node.js 22.20.0 或更新版本（含 npm/npx），然后在仓库目录执行：

```sh
task skills:install
```

该命令会按照 `skills-lock.json` 一次性安装全部项目 skill，目前包含用于电路和 PCB 设计的 `tscircuit`。清单通过上游 commit 固定版本，完整文件安装到 `.agents/skills/`，该目录不纳入 Git。

新增或更新 skill 后，提交更新的 `skills-lock.json` 即可。任务固定使用 `skills@1.7.4` 的 `experimental_install` 命令恢复清单。

---

<div align="center">
<sub>Talk is cheap. We shoot anyway.</sub>
</div>
