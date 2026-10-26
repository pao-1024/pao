# Docker 部署

`Dockerfile` 将正式 PAO 固件、ESP32-S3 ROM、Rust 模拟器、3D 网页及固件遥控页打包为一个完整应用镜像。`caddy.Dockerfile` 构建带 [`single_device` 插件](caddy-single-device/README.md)的 Caddy 镜像，提供统一入口、单浏览器独占和自动 HTTPS。当前支持 Linux amd64。

## 从源码启动

需要 Docker Engine 与 Docker Compose v2。在仓库根目录执行：

```sh
git submodule update --init --recursive
docker compose -f docker/compose.yaml up -d --build
```

打开 <http://127.0.0.1:8080/>，点击启用麦克风和扬声器。顶栏“遥控”使用同一入口下的 `/control/`。首次构建需要联网下载 SDK、工具链、固件组件及网页依赖；构建的耗时和空间明显高于运行时。运行时不需要本机安装 ESP-IDF、Rust、Node.js 或 Task。

模拟器以非 root 用户运行，容器内 Nginx 将网页、音频 WebSocket 和固件遥控统一到 8000 端口。Compose 仅向外开放 Caddy，不映射模拟器端口，因此公网不能绕开独占检查。

## 使用 GHCR 镜像

推送 Git tag 时，`Simulator image` GitHub Actions 工作流自动发布两个镜像：

- `ghcr.io/pao-1024/pao-simulator:<tag>`
- `ghcr.io/pao-1024/pao-simulator-caddy:<tag>`

同时生成 `sha-<短提交号>` 标签；也支持在 Actions 页面手动运行。首次发布后，将两个 GHCR 包设为公开，或在部署服务器上使用有读取包权限的凭据执行 `docker login ghcr.io`。

服务器只需下载 `compose.yaml`，在同目录创建 `.env`，将 `<tag>` 换为实际版本：

```dotenv
PAO_SIM_IMAGE=ghcr.io/pao-1024/pao-simulator:<tag>
PAO_CADDY_IMAGE=ghcr.io/pao-1024/pao-simulator-caddy:<tag>
```

在该目录运行：

```sh
docker compose up -d --no-build --pull always
```

只使用已发布镜像时不需要源码、子模块或构建工具。

## 线上 HTTPS

在 `.env` 中补充以下配置，将域名替换为指向服务器的实际域名：

```dotenv
PAO_SIM_DOMAIN=simulator.example.com
PAO_SIM_BIND=0.0.0.0
PAO_SIM_HTTP_PORT=80
PAO_SIM_HTTPS_PORT=443
```

确保 TCP 80/443 端口空闲并已放通，执行相同的 Compose 启动命令。Caddy 自动申请和续期证书，无需 DNS API 密钥；UDP 443 用于 HTTP/3。浏览器线上麦克风需要 HTTPS。

本地默认仅监听 `127.0.0.1:8080`，不申请证书。可通过 `PAO_SIM_BIND`、`PAO_SIM_HTTP_PORT` 和 `PAO_SIM_HTTPS_PORT` 修改监听地址和端口。

## 设备独占

一个浏览器配置档案代表一个设备会话，以随机、不可预测的 HttpOnly Cookie 识别，不按 IP 区分。首次 WebSocket 连接获得独占；同一浏览器可同时打开模拟器与遥控页，其他浏览器收到“设备正在使用”的提示，空闲后自动重试。普通网页探测和健康检查不会抢占设备。

最后一条连接断开后保留 5 秒重连时间，再允许其他浏览器接入。刷新或短暂重连可继续使用；不同浏览器和无痕窗口视为不同会话。骤然断网的释放时间还包括 TCP 检测失联的时间。同一会话内避免同时打开多个模拟器页面收音，以免音频重复输入。

## 状态与维护

`simulator-data` 卷保存 MAC、UUID、激活状态及 NVS，`caddy-data` 和 `caddy-config` 保存证书与 Caddy 状态。正常停止会保存 Flash；更新镜像或重建容器时保留这些卷，不要使用 `docker compose down -v`。

```sh
docker compose logs -f
docker compose stop
docker compose up -d --no-build
```

以上维护命令假设当前目录中有 `compose.yaml`；从仓库根目录运行时加 `-f docker/compose.yaml`。

运行仍需访问固件使用的灵矽服务，新设备按页面提示完成绑定。镜像不包含宿主机 `tmp/`、设备身份或云密钥，保留 ROM、固件及组件的许可证。

当前 amd64 模拟器使用基本块解释执行，上游原生 JIT 仅支持 ARM64。ESP32-S3 的两个虚拟 CPU 核心由一个宿主机线程调度，增加 vCPU 数量不会自动并行仿真。部署时优先关注 CPU 单核性能；低配 VPS 的语音交互可能慢于实时，可通过页面上的“速度”指标检查是否接近 1×。
