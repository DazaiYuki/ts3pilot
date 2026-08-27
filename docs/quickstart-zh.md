# TS3 Community Operations Suite — 快速上手（中文保姆级）

这份指南面向"第一次接触这套工具"的服主：从零安装、接管已有服务器、
WordPress 配对、前台展示，以及常见问题排查。

## 0. 你需要准备什么

| 项目 | 要求 | 说明 |
| --- | --- | --- |
| 一台服务器/电脑 | Windows / Linux 均可开发；生产建议 Linux | Windows 上自动使用 Mock 模式，不影响联调 |
| Node.js | >= 22.6（推荐 24） | 运行 CLI/Agent |
| TeamSpeak 3 Server | 自行从官方渠道获取 | 本项目不提供/不重新分发 |
| WordPress | 6.0+，PHP 8.1+（可选） | 只需要 Web 面板时才需要 |

## 1. 先选你的场景

- **场景 A（新装）**：服务器上还没有 TS3，从零开始。
- **场景 B（接管）**：已经有一台在跑的 TS3，想用本套件管理。

两条路最终都会走到同一步：**开启 Agent API → 拿到配对码 → WordPress 配对**。

## 2. 场景 A：从零安装 TS3

1. 去 TeamSpeak 官网下载 Server 包（Linux 选 `ts3server_linux_amd64`）。
2. 解压到一个**专属目录**，例如 `/srv/ts3`：

   ```bash
   mkdir -p /srv/ts3
   tar -xzf teamspeak3-server_linux_amd64-*.tar.gz -C /srv/ts3 --strip-components=1
   cd /srv/ts3
   ```

3. 按官方说明接受许可（`accept` 标志或许可证文件），首次启动会生成
   `ts3server.sqlitedb` 与 `ts3server.ini`，并把 serveradmin 密码打印到日志。
4. 确认 `./ts3server_startscript.sh start` 能正常启动。

> 也可以使用一键安装：`npm run cli -- install --accept-eula --version 3.13.7
> --install-path /srv/ts3 --setup-firewall`（Linux 下自动下载、`tar -xjf`
> 解压、创建 `.ts3server_license_accepted`、按需配置 UFW/Firewalld 并生成
> systemd unit；Windows/开发环境自动走 mock 流程）。请先阅读 TeamSpeak
> 官方许可协议，确认同意后再加 `--accept-eula`。

## 3. 安装与配置 ts3-manager

### 方式 1：源码运行（开发/自用）

```bash
git clone https://github.com/DazaiYuki/ts3pilot.git
cd ts3pilot
npm install
npm run cli -- config init
```

### 方式 2：一键安装（Linux 生产，推荐）

```bash
curl -sSL https://raw.githubusercontent.com/DazaiYuki/ts3pilot/main/scripts/install.sh | sudo bash
```

无法直连 GitHub 时，使用 jsDelivr 加速版：

```bash
curl -sSL https://cdn.jsdelivr.net/gh/DazaiYuki/ts3pilot@main/scripts/install-cn.sh | sudo bash
```

（CLI 发布包镜像走 npmmirror，需先把 `@ts3pilot/ts3-manager` 发布到 npm 后
生效；在此之前会自动回退 GitHub 资产。）

脚本会自动：检测架构 → 从 GitHub Releases 拉取最新
`ts3pilot-linux-x64-v*.tar.gz`（**独立单文件二进制，服务器无需安装
Node.js**）→ 解压到 `/opt/ts3pilot` → 赋予执行权限 → 在
`/usr/local/bin/ts3pilot` 创建软链接。之后直接使用 `ts3pilot` 命令：

```bash
ts3pilot config init
ts3pilot doctor
```

### 告诉它你的 TS3 装在哪里

```bash
npm run cli -- config set ts3.installPath /srv/ts3
npm run cli -- doctor
```

`doctor` 会检查：目录权限、`ts3server.sqlitedb` 是否可读、关键端口、
ServerQuery 连通性等。看到 `FAIL` 项先解决再继续。

## 4. 场景 B：接管已有服务器

```bash
npm run cli -- config set ts3.installPath /srv/ts3
npm run cli -- adopt
```

`adopt` 是**只读**的，它会告诉你：

- 检测到哪些文件（sqlitedb、ini、files 等）。
- `ts3server.ini` 里的关键项（`query_ip_whitelist` 等）。
- 最小改动建议：
  1. 把 `query_ip_whitelist` 设为 `127.0.0.1`（或 `127.0.0.1,<内网段>`）后重启 TS3。
  2. 在 TS3 里创建一个**受限 ServerQuery 登录**（不要用 master serveradmin
     作为长期凭据），把用户名/密码写入配置：

     ```bash
     npm run cli -- config set ts3.query.username <用户名>
     npm run cli -- config set ts3.query.password <密码>
     ```
  3. 接管前先备份：`npm run cli -- backup`。

## 5. 开启 Agent API 并启动

```bash
npm run cli -- api enable --port 17880
```

屏幕会显示一次性**配对码**（15 分钟有效）。然后启动 Agent：

```bash
npm run cli -- agent
```

生产环境建议用 systemd 托管：

```bash
npm run cli -- systemd generate ts3-agent --user ts3agent --exec-start "<node路径> /opt/ts3pilot/dist/cli/index.js agent" --config /etc/ts3pilot/config.json --out /etc/systemd/system/ts3-agent.service
```

随时查看状态：`npm run cli -- api status`（不会打印完整凭据）。

## 6. WordPress 插件安装与配对

1. 前往 **GitHub Releases**
   （https://github.com/DazaiYuki/ts3pilot/releases）下载
   `ts3pilot-wp-v*.zip`，在 WordPress 后台 **插件 → 安装插件 → 上传插件**
   选择该 zip，安装并**激活**。
2. 进入 **TS3Pilot → Settings**：
   - Agent URL：默认 `http://127.0.0.1:17880`（同机部署）。
   - Pairing code：粘贴第 5 步的配对码。
   - 点击 **Complete pairing**。
3. 成功后会出现在 **Node Registry**；后台顶部 Node Switcher 可切换节点
   （多节点时）。

> 远程 Agent 属于高级部署：必须显式 `--remote` + 生产模式 + HTTPS/反代，
> 不要直接把 Agent 暴露到公网。

## 7. 前台展示

### Gutenberg 区块

在编辑器中搜索 **TS3 Status**，插入后可在右侧配置：显示名称/在线数/最大数/
版本/频道树/主题/节点。

### 经典短代码（无构建依赖，永远可用）

```html
[ts3_status]                                     <!-- 默认主节点 -->
[ts3_status node="<节点ID>" show_channels="true" theme="auto"]
[ts3_identity]                                   <!-- 登录用户的身份绑定 -->
```

`[ts3_status]` 常用属性：

| 属性 | 取值 | 默认 |
| --- | --- | --- |
| `node` | 节点 ID（非法则回退主节点） | 空 = 主节点 |
| `show_name` / `show_online` / `show_max` / `show_version` | `true`/`false` | 前三个 true |
| `show_channels` | `true`/`false` | 跟随后台设置 |
| `collapsible` | `true`/`false` | false |
| `theme` | `auto`/`light`/`dark` | 后台设置 |
| `join_policy` | `hidden`/`public`/`logged_in`/`verified_ts_user`/`role` | hidden |
| `join_role` | 角色名（join_policy=role 时） | 空 |

## 8. 常用命令速查

```bash
ts3-manager status | start | stop | restart
ts3-manager doctor
ts3-manager adopt
ts3-manager backup --dest /srv/backups/ts3-$(date +%F).tar.gz
ts3-manager restore --backup /srv/backups/ts3-xxx.tar.gz --dry-run
ts3-manager restore --backup /srv/backups/ts3-xxx.tar.gz --force
ts3-manager logs --lines 100
ts3-manager update          # 检查并自更新 CLI（二进制版，无需重新安装）
ts3-manager update check    # 只检查最新版本，不下载
ts3-manager api status
ts3-manager identity worker once
```

## 9. 常见问题 FAQ

### Q0：如何升级 ts3pilot 本身？

- 在服务器上执行 `ts3pilot update`（或控制台菜单 [7]）。它会自动从
  GitHub Releases 获取最新版，校验 gzip 后原子替换并做冒烟测试，失败自动
  回滚旧版本；国内网络会自动走镜像回退链。
- 只想看看有没有新版：`ts3pilot update check`。
- 完全离线时，也可以手动下载新版 tar.gz 覆盖 `/opt/ts3pilot/ts3pilot`。

### Q1：`doctor` 显示端口 9987/10011 是 closed

- 先确认 TS3 真的在运行：`./ts3server_startscript.sh status`。
- 检查防火墙/安全组：语音 9987/udp、文件传输 30033/tcp、Query 10011/tcp
  是否放行（管理端口建议只对内网）。
- Agent 只连本机 `127.0.0.1`，**不需要**这些端口对公网开放。

### Q2：配对失败

- 配对码 15 分钟过期：重新 `ts3-manager api enable`。
- Agent 没在运行：先 `ts3-manager agent`，再用 `curl http://127.0.0.1:17880/v1/health` 验证。
- URL 写错：同机默认 `http://127.0.0.1:17880`，不要带 `/v1`。
- 时间偏差过大：Agent 与 WP 所在机器时间差应 < 5 分钟。

### Q3：前台状态卡显示"暂时无法获取状态"

- Agent 未运行或已 `api disable`。
- 节点凭据被改过（`rotate-secret` 后 WP 端未同步）：Settings → Node Registry
  重新填写或重新配对。
- 状态有缓存（默认 10 秒）：稍等或刷新再看。

### Q4：`[ts3_identity]` 绑定一直不完成

- 核验按 `client_description → client_away_message → nickname` 优先级扫描；
  请在 **客户端描述** 里写验证码（避免昵称 30 字符截断与防刷屏）。
- 验证码单次使用、10 分钟过期；过期后重新点"开始绑定"。
- Agent 的 identity worker 需要 `identity.verify.enabled=true`（或身份功能
  配置开启）才会持续轮询。

### Q5：Windows 上 `systemctl` 报错

正常：Windows 自动降级为 Mock ServiceManager，只做模拟，不执行 Linux 命令。

### Q6：备份/恢复

- 恢复是破坏性操作：先 `--dry-run` 预检（校验 manifest/hash/权限，不写盘），
  确认后再 `--force`。
- 开发模式下 `--force` 还需要环境变量 `TS3_MANAGER_ALLOW_DESTRUCTIVE=1`。

### Q7：安全注意事项

- 不要把 Agent 绑定到 `0.0.0.0`；远程模式必须显式 `--remote` + TLS/反代。
- 不要把 TS3 的 master serveradmin 密码作为长期凭据写入插件。
- 日志与诊断页面永远不显示完整凭据。

## 10. 更多文档

- [architecture.md](architecture.md) — 架构
- [../SECURITY.md](../SECURITY.md) — 威胁模型
- [deployment.md](deployment.md) — 生产部署
- [api/agent-api-v1.md](api/agent-api-v1.md) — Agent API 协议
- [../CHANGELOG.md](../CHANGELOG.md) — 变更记录
