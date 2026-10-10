# TS3Pilot — TeamSpeak 3 管理工具

[English](README.md) | **中文**

在 Linux 服务器上新建或接管 TeamSpeak 3，通过独立 CLI/Agent 管理服务、频道、客户端和备份；可选 WordPress 插件提供后台控制面板、前台状态卡和身份核验入口。

## 先选安装方式

| 你要做什么 | 使用什么 | 是否需要安装 Node.js |
| --- | --- | --- |
| Ubuntu 等 Linux x86_64 生产部署 | Release 的独立 CLI 二进制 | **不需要**，包内自带运行时 |
| WordPress 控制面板 | Release 的 `ts3pilot-wp-v0.5.0.zip` | 不需要 Node/npm/Composer，使用 WordPress 和 PHP |
| 修改 TypeScript 源码、运行开发测试 | Git 仓库 + npm | Node 24，或 Node 22.6+ 配合类型擦除选项 |
| 使用 npm 安装 CLI | `@ts3pilot/ts3-manager` | 安装时需要 npm；包内仍是 Linux x86_64 独立二进制 |

**当前稳定版本：[v0.5.0](https://github.com/DazaiYuki/ts3pilot/releases/tag/v0.5.0)。** 2026-10-10 查询时 npm 官方包仍是 **0.4.0**，不要把 `npm install -g` 当作安装 0.5.0 的方式。Release 中的 npm `.tgz` 是分发文件，不代表同版本已发布到 npm registry；第三方镜像也可能延迟同步。

## 安装 CLI

适用于 Linux **x86_64（64 位 x86）**。生产服务器无需安装 Node、npm 或 PHP；PHP 仅用于 WordPress 面板。

```bash
curl -fsSL https://raw.githubusercontent.com/DazaiYuki/ts3pilot/v0.5.0/scripts/install.sh -o install-ts3pilot.sh
sudo env TS3PILOT_VERSION=0.5.0 bash install-ts3pilot.sh
ts3pilot version
```

安装器校验 SHA-256，安装到 `/opt/ts3pilot`，创建 `/usr/local/bin/ts3pilot`；校验失败保留旧程序，重装保留用户配置。

**大陆服务器：先看[大陆网络安装、离线转存与升级](docs/mainland-install.md)。** jsDelivr 提供仓库文件，不提供 GitHub Release 二进制；下载脚本成功不代表下载程序成功。文档提供固定版本/可信摘要、镜像尝试和完全离线安装三条路径。

## 新建或接管：按顺序配置

先按[生产部署文档](docs/deployment.md)创建服务账户和 `/var/lib/ts3pilot/config.json`，再设置 `mode=production`。默认 `development` 模式使用 mock，不能据此判断真实 TS3 是否已安装。

| 场景 | 下一步 |
| --- | --- |
| 新建服务器 | 从官方 HTTPS 来源确认 TS3 版本与 SHA-256，明确接受官方许可，再执行 `ts3pilot install`；配置目录所有权、Query 凭据和服务托管 |
| 已有服务器 | 设置真实 `ts3.installPath`，执行只读 `ts3pilot adopt`，匹配既有服务账户与启动参数；不要用 `install --force` 覆盖旧服 |
| 远程/Docker 服务器 | 配置 Query 地址及部署类型；文件操作只能使用实际可访问的本地数据目录 |

以下命令始终使用同一份配置；Query 用户名和密码通过受保护编辑器填写，避免写入 shell 历史。

```bash
sudo -u ts3 ts3pilot doctor --config /var/lib/ts3pilot/config.json
sudo -u ts3 ts3pilot api enable --config /var/lib/ts3pilot/config.json
```

复制一次性配对码，按部署文档用 systemd 启动 Agent。Agent 默认监听 `127.0.0.1:17880`；服务启停需要相应的系统授权。直接运行 `ts3pilot` 可进入中英双语交互控制台。

## WordPress 控制面板

1. 下载正式 Release 的 ZIP，在 WordPress「插件 → 安装插件 → 上传插件」安装并激活。不要上传仓库源码 ZIP。
2. 在 **TS3Pilot → Settings** 填写 Agent URL 和配对码；配对码 15 分钟内有效且只能使用一次。
3. 确认连接返回 CLI 0.5.0、production 模式及真实 Query provider，再检查状态、客户端和频道管理。
4. 在设置页配置显示字段、加入地址、文字和可见性。使用带侧栏设置的 **TS3 Status** 区块、**TS3 Status & Join** 经典小工具，或 `[ts3_status show_channels="true"]`；独立按钮使用 `[ts3_join]`，身份入口使用 `[ts3_identity]`。

同机原生部署可以用回环地址；Docker 容器各有自己的回环网络。跨主机连接按部署文档配置 HTTPS 与来源限制。**GitHub/npm 不可达不会阻断已经配对的本地管理功能**，但会影响在线安装和自动更新；WordPress 可以手动上传已校验的新版 ZIP。

## 常用操作

| 命令 | 用途 |
| --- | --- |
| `ts3pilot status / start / stop / restart` | 服务状态与启停 |
| `ts3pilot doctor` | 路径、权限、Query 登录和 Agent 诊断 |
| `ts3pilot adopt` | 只读接管分析 |
| `ts3pilot backup --dest backup.tar.gz` | 备份；生产备份前先停止自己的 TS3 服务 |
| `ts3pilot restore --backup backup.tar.gz --dry-run` | 恢复预检；实际恢复前先停服并保留独立备份 |
| `ts3pilot update check / self` | 检查/更新 CLI；不会升级第三方 TS3 Server |
| `ts3pilot logs --lines 100` | 查看日志 |

以上操作追加 `--config /var/lib/ts3pilot/config.json`。WordPress 角色权限与 TeamSpeak 权限相互独立；Agent 只提供固定动作，没有任意 shell 命令接口。

## 已验证范围

v0.5.0 通过 130 项 Node、63 项 PHP 测试；官方 TS3 在 Ubuntu 24.04 的新建、独立 tar 解压脚本旧服接管与启停及真实 WordPress 联调通过。CLI/Agent 以非特权用户通过 17 个仍受支持的 Linux 镜像检查，涵盖 Ubuntu、Debian、Rocky Linux、Fedora、openSUSE、Alpine 和 Arch。容器兼容检查覆盖用户空间，不等同于所有发行版的完整 systemd/SELinux 或 TS3 第三方二进制验证。

## 文档与开发

- [生产部署：新建、接管、Query、systemd 和 WordPress](docs/deployment.md)
- [大陆网络安装与升级](docs/mainland-install.md)
- [快速上手与常见问题](docs/quickstart-zh.md)
- [开发、测试和发布](docs/development.md)
- [架构](docs/architecture.md) · [Agent API](docs/api/agent-api-v1.md) · [安全说明](SECURITY.md)
- [版本变更](CHANGELOG.md) · [v0.5.0 说明](docs/release-notes-v0.5.0.md)

源码开发使用 `npm ci`，不要在生产服务器为运行独立包执行源码构建。

## 许可与维护

项目代码采用 [Apache-2.0](LICENSE)，不捆绑或重新分发 TeamSpeak Server。使用 TS3 必须遵守官方许可；第三方说明见 [NOTICE](docs/notice.md)。本项目与 TeamSpeak Systems GmbH 无隶属或背书关系。

维护者：dazaiyuki；AI 辅助开发工具：OpenAI Codex CLI。
