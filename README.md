# TS3 Community Operations Suite（TS3 社区运营套件）

一套本地优先（local-first）的 TeamSpeak 3 服务器运维工具链：`ts3-manager`
CLI/Agent 独立可用，WordPress 插件是可选的 Web 控制平面，两者通过受控的
`/v1` Agent API 解耦协作。

> 本项目不重新分发 TeamSpeak Server 二进制。用户必须自行从 TeamSpeak
> 官方渠道获取并在遵守 TeamSpeak 官方许可条款的前提下使用。
> 项目代码本身采用 Apache-2.0 许可，与 TeamSpeak 软件许可严格分离。

## 组件

| 组件 | 目录 | 说明 |
| --- | --- | --- |
| ts3-manager | `packages/ts3-manager` | TypeScript CLI + Agent（Host Control Plane），零运行时依赖 |
| ts3-operations-wp | `packages/ts3-operations-wp` | WordPress 插件（可选 Web Control Plane） |
| 沙盒/文档 | `sandbox/`、`docs/` | Docker 集成测试入口与架构/安全/API 文档 |

## 核心设计

- **本地管理工具独立可用**：CLI 在没有 WordPress、没有网络的情况下也能完成
  状态、启停、备份、日志、诊断等操作。
- **Agent 是受控的 Host Control Plane，不是远程 Shell**：所有系统操作映射到
  固定动作枚举，不存在任意命令执行接口。
- **API 默认关闭**：`api enable` 是明确的安全边界；默认只监听
  `127.0.0.1:17880`，与 TS3 WebQuery（10080/10443）等端口严格分离。
- **HMAC-SHA256 认证**：timestamp + nonce + method + path + body-hash 的
  canonical string，恒定时间比较，防重放、防篡改；配对码一次性、15 分钟有效。
- **Capability 模型**：每个端点声明所需能力；高风险能力（update/restore/
  restart）默认不授予，需显式 `--high-risk`。
- **WP 与 TS3 权限完全平行**：`manage_ts3_*` capability 只决定网页端能做什么；
  绝不自动同步或改变 TeamSpeak 内的权限。

## Windows 开发环境快速开始

```powershell
npm install
npm run verify

# 端到端冒烟（全部在 mock 模式下）
npm run cli -- config init --config .\tmp\dev\config.json
npm run cli -- status --config .\tmp\dev\config.json
npm run cli -- api enable --port 17880 --config .\tmp\dev\config.json
npm run cli -- agent --config .\tmp\dev\config.json
```

Windows 上 systemd/script provider 不可用，自动降级为 **Mock ServiceManager**；
TS3 连接默认使用 **Mock TeamSpeak 客户端**（数据字段完整、可重复、显式标记
`mock: true`）。真实 Linux/systemd/TS3 行为由 provider 隔离，Linux 上无需改动代码。

## 文档索引

- [ARCHITECTURE.md](ARCHITECTURE.md) — 组件边界、端口、认证、权限、数据流、发布策略
- [SECURITY.md](SECURITY.md) — 威胁模型与缓解措施
- [DEVELOPMENT.md](DEVELOPMENT.md) — 开发环境、测试矩阵、Docker 沙盒
- [DEPLOYMENT.md](DEPLOYMENT.md) — Linux 部署、systemd 加固、防火墙、配对
- [docs/api/agent-api-v1.md](docs/api/agent-api-v1.md) — Agent API 协议
- [STATUS.md](STATUS.md) — 当前实现状态与已知限制

## 许可证与第三方声明

本项目代码：Apache-2.0（见 [LICENSE](LICENSE)）。第三方依赖与 TeamSpeak
许可边界见 [NOTICE.md](NOTICE.md)。
