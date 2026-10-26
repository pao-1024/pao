# Caddy 单设备访问模块

`http.handlers.single_device` 按浏览器 cookie 独占同一模拟器，支持同一浏览器同时打开模拟器和遥控页。最后一条 WebSocket 关闭后保留 5 秒重连时间；普通网页请求和健康检查不会占用设备。

在同一个站点中使用一个无参数 `single_device` 指令，放在所有模拟器路由之前：

```caddyfile
vps-jp.zhangzqs.cn {
    single_device
    reverse_proxy simulator:8000
}
```

首次获准的 WebSocket 握手签发 `pao_device` cookie，使用 `HttpOnly`、`SameSite=Strict`，HTTPS 下启用 `Secure`。其他浏览器收到 HTTP 423 中文占用页，每 5 秒自动重试。只读 `GET /_single_device/status` 始终返回 `{"available":false,"owned":false}` 形式的 JSON：`available` 表示无人持有，`owned` 表示当前浏览器是持有者。

本模块适用于单个 Caddy 实例。不同浏览器或无痕窗口视为不同设备；关闭所有页面后释放，突然断网的识别时间由 TCP 连接检测决定。Caddy 重启或重新加载配置会结束现有连接并重建会话。

依赖 Caddy 2.11.7、Go 1.26 及以上。验证命令：

```sh
go test -race ./...
go vet ./...
```
