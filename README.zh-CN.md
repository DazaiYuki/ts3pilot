# TS3Pilot — TS3 社区运营套件

[English](README.md) | [中文](README.zh-CN.md)

一套本地优先（local-first）的 TeamSpeak 3 服务器运维工具链：`ts3pilot`
CLI/Agent 独立可用，WordPress 插件是可选的 Web 控制平面，两者通过受控的
`/v1` Agent API 解耦协作。无论你是**从零搭建新服**，还是**接管已有 TS3
服务器**，都可以从这里开始。

> 本项目不重新分发 TeamSpeak Server 二进制。用户必须自行从 TeamSpeak
> 官方渠道获取并遵守其许可条款；项目代码本身采用 Apache-2.0，与 TeamSpeak
> 软件许可严格分离。

## 架构一览（CLI + Agent + WP）

```
┌──────────────────┐      ┌────────────────────────┐      ┌─────────────────┐
│  浏览器 / 前台     │      │  ts3pilot Agent         │      │   TeamSpeak 3   │
│  (状态卡/短代码)   │      │  (Host Control Plane)  │      │   (Service)     │
└────────┬─────────┘      └───────────┬────────────┘      └────────┬────────┘
         │ HTTP(S)                    │ HMAC-SHA256 /v1            │ TS3 协议
         ▼                            ▼                            ▼
┌──────────────────┐      ┌────────────────────────┐      ┌─────────────────┐
│  WordPress 插件   │ ───▶ │  ts3pilot CLI           │ ───▶ │  Voice/Query/   │
│  (可选 Web CP)    │      │  (本地管理工具)          │      │  FileTransfer   │
└──────────────────┘      └────────────────────────┘      └─────────────────┘
```

- **CLI/Agent（必须）**：`apps/ts3-manager`，TypeScript，零运行时依赖。
- **WordPress 插件（可选）**：`plugins/ts3pilot-wp`，通过 HMAC 安全配对。
- 两者都只面向固定动作枚举，**不存在任意命令执行接口**。

## 5 分钟极速上手

### 场景 A：新服主从零安装

1. 安装 CLI（Linux 一行命令）：

   ```bash
   curl -sSL https://raw.githubusercontent.com/DazaiYuki/ts3pilot/main/scripts/install.sh | sudo bash
   ```

   无法直连 GitHub？使用 jsDelivr 加速版：

   ```bash
   curl -sSL https://cdn.jsdelivr.net/gh/DazaiYuki/ts3pilot@main/scripts/install-cn.sh | sudo bash
   ```

2. 一键安装 TS3 Server（自动下载官方包、解压、EULA 标记、可选防火墙）：

   ```bash
   sudo ts3pilot install --accept-eula --install-path /srv/ts3 --setup-firewall
   ```

3. `ts3pilot doctor` 检查环境，然后 `ts3pilot api enable` 复制**配对码**。
4. `ts3pilot agent` 启动 Agent（生产建议 systemd 托管）。
5. 从 **GitHub Releases** 下载 `ts3pilot-wp-v*.zip`，上传 WordPress 激活并配对。

### 场景 B：已有 TS3 服务器接管

```bash
ts3pilot config set ts3.installPath /srv/ts3
ts3pilot adopt          # 只读分析，绝不改文件
ts3pilot doctor
ts3pilot api enable && ts3pilot agent
```

### WordPress 配对与前台

1. **TS3Pilot → Settings**：Agent 地址 `http://127.0.0.1:17880`（同机）+ 配对码
   → **Complete pairing**。
2. 前台：使用 **TS3 Status** Gutenberg 区块，或经典短代码
   `[ts3_status]`、`[ts3_status node="..." show_channels="true"]`、
   `[ts3_identity]`。

直接运行 `ts3pilot`（不带参数）会进入**交互式双语控制台**（English /
简体中文）。

## 常用 CLI 命令速查

| 命令 | 说明 |
| --- | --- |
| `ts3pilot status / start / stop / restart` | 服务状态与启停 |
| `ts3pilot doctor` | 深度诊断（端口/权限/SQLite/Query 鉴权） |
| `ts3pilot adopt` | 只读接管分析（已有服务器） |
| `ts3pilot install --accept-eula --setup-firewall` | 官方源下载安装 TS3 Server |
| `ts3pilot backup [--dest x.tar.gz]` | 真实 tar.gz 备份 + manifest |
| `ts3pilot restore --backup x.tar.gz --dry-run` | 恢复预检（不写盘） |
| `ts3pilot restore --backup x.tar.gz --force` | 真实恢复（破坏性） |
| `ts3pilot logs --lines 100` | 查看日志 |
| `ts3pilot api enable / status / disable` | Agent API 生命周期 |
| `ts3pilot identity worker once` | 身份核验单轮扫描 |
| `ts3pilot systemd generate ts3server` | 生成加固 systemd unit |

## WordPress 后台能力与权限

`manage_ts3_view`、`manage_ts3_clients`、`manage_ts3_channels`、
`manage_ts3_server`、`manage_ts3_maintenance`、`manage_ts3_users`——激活时默认
授予 administrator，可按角色自定义。**WordPress 权限与 TeamSpeak 权限完全
平行**，互不自动同步。

## 安全要点

- Agent API 默认只监听 `127.0.0.1:17880`，与 TS3 端口严格分离。
- HMAC-SHA256 v1 签名 + 时间窗 + nonce 防重放；配对码一次性、15 分钟有效。
- 多节点凭据独立存储与签名；恢复/解包有路径沙箱。

## 文档索引

- [docs/quickstart-zh.md](docs/quickstart-zh.md) — 中文保姆级上手 + FAQ
- [docs/quickstart-en.md](docs/quickstart-en.md) — English quick start + FAQ
- [docs/architecture.md](docs/architecture.md) — 架构
- [SECURITY.md](SECURITY.md) — 威胁模型
- [docs/development.md](docs/development.md) — 开发
- [docs/deployment.md](docs/deployment.md) — 部署与 systemd
- [docs/api/agent-api-v1.md](docs/api/agent-api-v1.md) — Agent API 协议
- [CHANGELOG.md](CHANGELOG.md) — 变更记录

## License / 第三方声明

项目代码：Apache-2.0（[LICENSE](LICENSE)）。第三方依赖与 TeamSpeak 许可边界
见 [docs/notice.md](docs/notice.md)。

## Authors & Credits

- **Architecture & Maintainer:** dazaiyuki
- **AI-assisted development tool:** OpenAI Codex CLI
