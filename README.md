# TS3Pilot — TS3 Community Operations Suite（TS3 社区运营套件）

A decoupled, secure TeamSpeak 3 management suite with an independent CLI/Agent
host control plane and optional WordPress integration.

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

## 5-Minute Quick Start（5 分钟极速上手）

### 场景 A：新服主从零安装

1. 安装 CLI（Linux 一行命令）：

   ```bash
   curl -sSL https://raw.githubusercontent.com/DazaiYuki/ts3pilot/main/scripts/install.sh | sudo bash
   ```

2. 一键安装 TS3 Server（自动下载官方包、解压、EULA 标记、可选防火墙）：

   ```bash
   sudo ts3pilot install --accept-eula --install-path /srv/ts3 --setup-firewall
   ```

3. `ts3pilot doctor` 检查环境，然后 `ts3pilot api enable` 复制**配对码**。
4. `ts3pilot agent` 启动 Agent（生产建议 systemd 托管）。
5. 从 **GitHub Releases** 下载 `ts3pilot-wp-v*.zip`，上传 WordPress 激活并配对。

### 场景 B：已有 TS3 服务器接管

1. 安装 CLI（同上的一行命令）。
2. `ts3pilot config set ts3.installPath <你的安装目录>`。
3. `ts3pilot adopt`（只读分析，绝不改文件）→ 按建议配置
   `query_ip_whitelist` 与受限 ServerQuery 凭据。
4. `ts3pilot doctor` 确认端口/权限/Query 连通性。
5. `ts3pilot api enable` → `ts3pilot agent` → WP 配对。

### 步骤一：CLI 工具与 Agent 启动

```bash
# 方式 1：一键安装（Linux 生产，推荐）
curl -sSL https://raw.githubusercontent.com/DazaiYuki/ts3pilot/main/scripts/install.sh | sudo bash
ts3pilot config init
ts3pilot doctor
ts3pilot api enable --port 17880      # 输出一次性配对码
ts3pilot agent

# 方式 2：源码运行（开发/自用）
npm install
npm run cli -- config init
npm run cli -- doctor
npm run cli -- api enable --port 17880
npm run cli -- agent
```

### 步骤二：WordPress 插件安装与配对

1. 前往 **GitHub Releases**（https://github.com/DazaiYuki/ts3pilot/releases）
   下载 `ts3pilot-wp-v*.zip`。
2. WordPress 后台 **插件 → 安装插件 → 上传插件**，选择该 zip，安装并**激活**。
3. 进入 **TS3Pilot → Settings**：输入 Agent 地址（默认
   `http://127.0.0.1:17880`）与**配对码**，点击 **Complete pairing**。
4. 成功后 Settings 的 Node Registry 会出现该节点；后台顶部 Node Switcher
   可在多节点间切换。

### 步骤三：前台展示

**Gutenberg 区块**：编辑器搜索 "TS3 Status"，插入后配置显示字段与节点。

**经典短代码**（与编辑器无关，永远可用）：

```html
[ts3_status]
[ts3_status node="你的节点ID" show_channels="true" theme="auto"]
[ts3_identity]
```

## 常用 CLI 命令速查

| 命令 | 说明 |
| --- | --- |
| `ts3pilot status / start / stop / restart` | 服务状态与启停 |
| `ts3pilot doctor` | 深度诊断（端口/权限/SQLite/Query 鉴权） |
| `ts3pilot adopt` | 只读接管分析（已有服务器） |
| `ts3pilot install --accept-eula --setup-firewall` | 官方源下载安装 TS3 Server（Linux；Windows/开发为 mock） |
| `ts3pilot backup [--dest x.tar.gz]` | 真实 tar.gz 备份 + manifest |
| `ts3pilot restore --backup x.tar.gz --dry-run` | 恢复预检（不写盘） |
| `ts3pilot restore --backup x.tar.gz --force` | 真实恢复（破坏性） |
| `ts3pilot logs --lines 100` | 查看日志 |
| `ts3pilot api enable / status / disable` | Agent API 生命周期 |
| `ts3pilot identity worker once` | 身份核验单轮扫描 |
| `ts3pilot systemd generate ts3server` | 生成加固 systemd unit |

完整列表见 [docs/quickstart-zh.md](docs/quickstart-zh.md) 与 CLI `--help`。

## WordPress 后台能力与权限

| Capability | 后台能力 |
| --- | --- |
| `manage_ts3_view` | Dashboard、节点切换 |
| `manage_ts3_clients` | 客户端列表、Kick / Poke / Move |
| `manage_ts3_channels` | 频道树、创建/编辑/移动/删除 |
| `manage_ts3_server` | 服务器配置类操作 |
| `manage_ts3_maintenance` | Restart 等高危维护动作 |
| `manage_ts3_users` | 身份绑定与挑战管理 |

激活时默认授予 administrator，站长可按角色自定义。**WordPress 权限与
TeamSpeak 权限完全平行**，互不自动同步。

## 安全要点

- Agent API 默认只监听 `127.0.0.1:17880`，与 TS3 WebQuery/Query 端口严格分离。
- HMAC-SHA256 v1 签名 + 时间窗 + nonce 防重放；配对码一次性、15 分钟有效。
- 多节点凭据独立存储与签名，杜绝跨节点凭据越界。
- 恢复/解包有路径沙箱，拒绝 `..`、绝对路径与符号链接。

## 文档索引

- [docs/quickstart-zh.md](docs/quickstart-zh.md) — 中文保姆级上手 + FAQ
- [docs/quickstart-en.md](docs/quickstart-en.md) — English quick start + FAQ
- [docs/architecture.md](docs/architecture.md) — 组件边界、端口、认证、数据流
- [SECURITY.md](SECURITY.md) — 威胁模型与缓解措施
- [docs/development.md](docs/development.md) — 开发环境、测试矩阵
- [docs/deployment.md](docs/deployment.md) — Linux 部署、systemd 加固
- [docs/status.md](docs/status.md) — 当前实现状态与已知限制
- [docs/api/agent-api-v1.md](docs/api/agent-api-v1.md) — Agent API 协议
- [CHANGELOG.md](CHANGELOG.md) — 版本变更记录

## License / 第三方声明

项目代码：Apache-2.0（[LICENSE](LICENSE)）。第三方依赖与 TeamSpeak 许可边界
见 [docs/notice.md](docs/notice.md)。

## Authors & Credits

- **Architecture & Maintainer:** dazaiyuki
- **AI-assisted development tool:** OpenAI Codex CLI
