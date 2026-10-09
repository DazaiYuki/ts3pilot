# 大陆服务器：安装、升级与网络排查

生产运行推荐独立 Linux x86_64 包，无需额外安装 Node/npm。源码开发才需要 Node；WordPress 插件需要 WordPress/PHP，不需要 Node、npm 或 Composer。

## 下载渠道实际提供什么

| 渠道 | 内容 | 注意事项 |
| --- | --- | --- |
| GitHub Release | 最新独立 CLI、WordPress ZIP、npm `.tgz` 和 SHA-256 文件 | 当前稳定版本 0.4.1 |
| npm 官方 registry | 已发布的 `@ts3pilot/ts3-manager` 包 | 2026-10-09 查询仍为 0.4.0；Release 附件不会自动发布到 npm |
| npmmirror | npm 包镜像 | 可能同步延迟；不是 GitHub Release 镜像 |
| jsDelivr | 仓库的脚本和文档 | 不提供 Release 二进制；`@main` 文件会更新 |
| 第三方 GitHub 下载代理 | 尝试转发公开 Release 资产 | 可用性由运营方与实际网络决定；仍需验证原始可信摘要 |

本次在当前云环境中确认 jsDelivr 脚本可下载；npmmirror 和 gh-proxy 请求被云出口拒绝。这不是大陆电信/联通/移动的实测，不能据此保证某个镜像在你的机房可用。下面提供可在线尝试、也可完全离线完成的路线。

## 路线一：GitHub 可访问

按 [README](../README.zh-CN.md#安装-cli) 使用固定版本官方安装脚本即可。程序安装成功后，不需要持续连接 GitHub/npm 才能管理自己的 TS3。

## 路线二：脚本可下载，Release 需代理

下载当前仓库安装器。明确固定程序版本并提供可信摘要，避免脚本再依赖 GitHub API 或 GitHub 的摘要下载。

```bash
curl -fsSL --max-time 30 https://cdn.jsdelivr.net/gh/DazaiYuki/ts3pilot@main/scripts/install.sh -o install-ts3pilot.sh
sudo env TS3PILOT_VERSION=0.4.1 \
  TS3PILOT_SHA256=3de1e4012f8c9bdb40187844b9006d8778b4c8a881c89152cca36367ca09871d \
  TS3PILOT_MIRROR=jsdelivr bash install-ts3pilot.sh
```

安装器依次尝试 gh-proxy、mirror.ghproxy 和 GitHub 官方下载。**这个选项并不保证代理可用**；全部失败则保留旧程序，改走路线三。此处 `@main` 指安装器源码，`TS3PILOT_VERSION=0.4.1` 固定的是程序资产，不会安装其他版本。

以下摘要来自正式 v0.4.1 Release，并已与实际下载文件及 GitHub 资产摘要核对。只适用于这些文件；升级其他版本时，从可信的正式发布渠道重新获取对应摘要，不要沿用本表或只信任代理一起提供的 `.sha256`。

| 文件 | SHA-256 |
| --- | --- |
| `ts3pilot-linux-x64-v0.4.1.tar.gz` | `3de1e4012f8c9bdb40187844b9006d8778b4c8a881c89152cca36367ca09871d` |
| `ts3pilot-wp-v0.4.1.zip` | `c607d82843eee615559cddfbfe9fa5dc97ab63645e34193c29d1d9ad2bff10f4` |

正式来源：[v0.4.1 Release](https://github.com/DazaiYuki/ts3pilot/releases/tag/v0.4.1)。

## 路线三：离线转存，服务器完全不访问 GitHub

在能访问 GitHub 的电脑下载以下文件，然后通过 SSH/SFTP 上传到服务器自己的工作目录：

- `ts3pilot-linux-x64-v0.4.1.tar.gz`
- `ts3pilot-wp-v0.4.1.zip`（需要面板时）
- **当前 main 的** `scripts/install.sh`（本次增加了本地档案支持；v0.4.1 标签中的旧安装器没有此选项）

使用当前安装器安装本地包，必须同时提供固定版本和可信 SHA-256。它不会为此访问版本 API、摘要文件或下载代理：

```bash
sudo env TS3PILOT_VERSION=0.4.1 \
  TS3PILOT_SHA256=3de1e4012f8c9bdb40187844b9006d8778b4c8a881c89152cca36367ca09871d \
  TS3PILOT_ARCHIVE="$PWD/ts3pilot-linux-x64-v0.4.1.tar.gz" \
  bash ./install.sh
ts3pilot version
```

需要 Linux x86_64，以及 Bash、curl、tar、coreutils 等常规工具；安装器不会安装系统依赖。curl 是现有安装器的前置工具，即使选择离线档案也需存在。Ubuntu 可先通过正常系统软件源安装 `ca-certificates curl tar coreutils bzip2`。

本地档案也会检查摘要、档案条目和候选程序版本；失败保留已安装程序。成功后同样安装至 `/opt/ts3pilot`，保留用户配置，可用于离线重装或更新。**正在运行的 Agent 仍使用旧进程；确认更新后重启自己的 Agent 服务。**

WordPress ZIP 在上传前校验：

```bash
printf '%s  ts3pilot-wp-v0.4.1.zip\n' \
  c607d82843eee615559cddfbfe9fa5dc97ab63645e34193c29d1d9ad2bff10f4 | sha256sum -c -
```

通过 WordPress 后台上传并激活/替换正式插件。无需 WordPress 服务器连接 GitHub；已有设置与配对存储在 WordPress 数据库中，更新前按正常流程备份。

## TS3 官方服务器包是另一次下载

CLI 镜像设置**不会代理 TeamSpeak 的官方服务器下载**。新建流程默认访问 `files.teamspeak-services.com`，还需明确接受官方许可。

若机房无法下载，可在其他电脑从官方 HTTPS 来源取得正确的 Linux amd64 `.tar.bz2`，校验后转存。两种方式：

- 放到你控制的 HTTPS 下载地址，执行 `ts3pilot install --source-url https://你的地址/官方包.tar.bz2 --expected-sha256 '<可信摘要>' ...`，按部署文档显式选择 production、安装路径和许可接受参数。
- 按官方说明在**新建专用目录**手工解压、接受许可并初始化服务器，然后按[接管流程](deployment.md#场景二接管现有-ts3)设置目录和运行 `adopt`。官方 `.tar.bz2` 使用 `tar -xjf`，不是 `tar -xzf`。

不要从陌生镜像取得改版 TS3 包，也不要在已有服目录直接覆盖解压。TS3 的许可、运行库和维护仍由官方规则决定。

## 在线升级与日常控制

`ts3pilot update self` 先访问 GitHub API 读取版本与可信资产摘要，再通过下载代理或官方源获取包。因此，仅设置 `TS3PILOT_GH_MIRROR` **不能解决 GitHub API 完全不可达**的问题；这种情况使用上面的离线安装器更新。

WordPress 自动更新也依赖 GitHub API 和资产下载，无法访问时手动上传已校验的 ZIP。GitHub 下载代理不能用作 Agent 地址。

Agent 与 WordPress 配对后，状态、频道与客户端管理只需要 WordPress → Agent → TS3 的连接。推荐同机回环或受限内网，跨主机使用 HTTPS 与来源限制。不要为了下载问题将裸 Agent 管理端口公开到公网。

## 常见排查

| 现象 | 检查/处理 |
| --- | --- |
| curl 超时、403、域名无法解析 | 检查服务器出口、DNS、代理和对应域名；换路线三，不关闭 TLS 校验 |
| jsDelivr 返回 HTML/404 | 检查仓库路径与引用；它只提供仓库文件，不能用它下载 Release 附件 |
| npm 安装版本旧 | `npm view @ts3pilot/ts3-manager version --registry=https://registry.npmjs.org/`；生产使用正式 Release |
| npm 镜像不同步 | 对比官方 registry 与镜像版本，固定期望版本；无需为生产独立包安装 npm |
| 校验失败 | 丢弃不匹配文件，重新从可信来源转存；不要忽略摘要错误 |
| health 正常，TS3 状态仍失败 | 用同一 `--config` 执行 `doctor`，检查 production 模式、真实 Query 登录、端口与来源许可 |
| WordPress 无法配对 | 容器回环不共享；检查实际网络地址、时间同步、HTTPS 和配对码有效期 |

只在源码开发需要 npm 时，可对单次依赖安装使用 `npm ci --registry=https://registry.npmmirror.com/`；锁文件中固定的其他下载域名仍可能需要访问。发行包构建还会下载 GitHub 上的 pkg 运行时，切换 npm registry 并不能替代这一步。普通服主使用预构建 Release 即可。
