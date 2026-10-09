# 生产部署

## 支持范围

CLI/Agent 发布包面向 Linux **x86_64**，包含静态 Node 运行时，无需在服务器安装 Node。开发源码需要 Node 22.6+（Node 22 开启 type stripping）或 Node 24。主要仍受支持的发行版由 `npm run test:compat` 验证，具体镜像、摘要和结果在生成的兼容性报告中。

CLI 可在 glibc 和 musl 用户空间运行。**TeamSpeak Server 是独立第三方程序**：其二进制和库必须匹配目标系统；默认下载是官方 Linux amd64 包。Alpine 等 musl 系统应使用经过验证的官方对应包或官方容器，不应把 glibc 运行库随意替换进去。systemd 指引适用于 systemd 发行版；其他 init 系统可以使用 `system.provider=script` 或自行托管 Agent。

容器测试验证 CLI 用户空间兼容性、实际 Agent HTTP 健康响应和退出，不代表在各发行版完整系统中验证了 systemd/SELinux。真实 TS3 的 Ubuntu 24.04 新建与既有实例联调由 `sandbox/integration.mjs` 验证。

## 安装 CLI

大陆或受限网络请先看[镜像、可信摘要与离线安装指南](mainland-install.md)。独立 CLI 无需安装 Node；npm 包版本与 GitHub Release 不一定同步。

发布 v0.4.1 后：

```bash
curl -fsSL https://raw.githubusercontent.com/DazaiYuki/ts3pilot/v0.4.1/scripts/install.sh -o install-ts3pilot.sh
sudo env TS3PILOT_VERSION=0.4.1 bash install-ts3pilot.sh
/opt/ts3pilot/ts3pilot version
```

安装器验证官方 Release 的 SHA-256 后安装至 `/opt/ts3pilot`，创建 `/usr/local/bin/ts3pilot`。镜像下载必须匹配同一个摘要；无法获取官方摘要时，需从可信发布渠道取得并通过 `TS3PILOT_SHA256` 提供，不要关闭验证。安装器保留用户文件，不安装或替换系统运行库。

## 创建独立配置

创建非 root 服务账户（若已存在则复用它），为该实例创建专用目录：

```bash
sudo useradd --system --user-group --home-dir /srv/ts3 --shell /usr/sbin/nologin ts3
sudo install -d -m 0700 -o ts3 -g ts3 /var/lib/ts3pilot
sudo -u ts3 /opt/ts3pilot/ts3pilot config init --config /var/lib/ts3pilot/config.json
sudo -u ts3 /opt/ts3pilot/ts3pilot config set mode production --config /var/lib/ts3pilot/config.json
```

以下命令均显式使用 `--config /var/lib/ts3pilot/config.json`。默认新配置是 `development`，未切换模式的 `install` 是 mock，不是实际安装。配置文件包含 Query 与 Agent 凭据，权限保持 0600；不要粘贴到工单、公开日志或 shell 历史。

## 场景一：新建原生 TS3

阅读并同意官方 TS3 许可后，在可信官方 HTTPS 来源确认版本和 SHA-256。示例选择 3.13.7；按实际获准版本调整：

```bash
sudo /opt/ts3pilot/ts3pilot install --accept-eula --version 3.13.7 \
  --install-path /srv/ts3 --expected-sha256 '<官方包的可信SHA-256>' \
  --config /var/lib/ts3pilot/config.json
sudo chown -R ts3:ts3 /srv/ts3
sudo /opt/ts3pilot/ts3pilot systemd generate ts3server --user ts3 --group ts3 \
  --install-path /srv/ts3 --out /etc/systemd/system/ts3server.service \
  --config /var/lib/ts3pilot/config.json
sudo systemctl daemon-reload
sudo systemctl enable --now ts3server.service
```

首次启动产生初始管理员凭据；安全地创建权限足够且尽量受限的 ServerQuery 登录，不把 master serveradmin 当作长期账号。官方服务器可能需要系统的 `libstdc++` 等运行库；安装相应发行版受支持的包，不覆盖已有库。

可选 `--setup-firewall` 只添加默认玩家端口 UDP 9987 和 TCP 30033。自定义端口应由管理员按实际配置开放。Query 和 Agent 管理端口不默认对公网开放。

## 场景二：接管现有 TS3

不运行 `install --force` 覆盖旧服务器。先设置现有目录并只读检查：

```bash
sudo -u ts3 /opt/ts3pilot/ts3pilot config set ts3.installPath /现有/TS3目录 --config /var/lib/ts3pilot/config.json
sudo -u ts3 /opt/ts3pilot/ts3pilot adopt --config /var/lib/ts3pilot/config.json
```

调整账户、目录所有权和 `system.unitName` 以匹配现有服务，保留既有数据库、许可证、文件和启动参数。对于远程或 Docker 实例配置 `ts3.query.host`、Query 端口和部署类型；文件操作需要正确的本地数据目录，不能把远程路径当作本机目录。

## 配置 Query 和 Agent

用本机的受保护编辑器修改 `/var/lib/ts3pilot/config.json`，填写 `ts3.query.username/password` 和实际 `ts3.query.host/rawPort`。生产模式没有有效 Query 配置时不会静默使用 mock。仅有 `/v1/health` 正常不代表 TS3 已连通；还要用 `doctor` 的 Query 登录检查和面板上的真实状态确认。

```bash
sudo -u ts3 /opt/ts3pilot/ts3pilot api enable --config /var/lib/ts3pilot/config.json
sudo /opt/ts3pilot/ts3pilot systemd generate ts3-agent --user ts3 --group ts3 \
  --out /etc/systemd/system/ts3-agent.service --config /var/lib/ts3pilot/config.json
sudo systemctl daemon-reload
sudo systemctl enable --now ts3-agent.service
sudo -u ts3 /opt/ts3pilot/ts3pilot doctor --config /var/lib/ts3pilot/config.json
```

Agent 默认只监听 `127.0.0.1:17880`。配置目录及 `dataDir` 必须存在并由服务账户写入，供凭据轮换与原子写入使用。Agent unit 允许 AF_UNIX 访问本机 IPC，且不启用会阻断 V8 JIT 的 `MemoryDenyWriteExecute`。

若要从面板启停 **systemd** 管理的 TS3，需要额外的最小权限 Polkit 授权，Agent 不能作为 root 运行。具备 Polkit 的主机可为专用账户创建 `/etc/polkit-1/rules.d/50-ts3pilot.rules`：

```javascript
polkit.addRule(function(action, subject) {
  if (subject.user === "ts3" &&
      action.id === "org.freedesktop.systemd1.manage-units" &&
      action.lookup("unit") === "ts3server.service" &&
      ["start", "stop", "restart"].indexOf(action.lookup("verb")) !== -1) {
    return polkit.Result.YES;
  }
});
```

账户名和 unit 必须对应实际部署。先以该账户验证授权，再开放所需 Agent capability。未设置授权时，状态/Query 功能仍可使用，系统服务操作会被系统拒绝；不要授予任意 sudo 权限。

## WordPress 控制面板

1. 上传正式 `ts3pilot-wp-v0.4.1.zip` 并激活。
2. 在 TS3Pilot 设置中填写 Agent URL 和刚生成的单次配对码，15 分钟内完成配对。
3. 验证连接测试返回 CLI 0.4.1、production 模式和真实 Query provider；检查状态、频道和在线列表。
4. 页面可添加 `[ts3_status]` 或 TS3 Status 区块。WordPress 管理权限和 TS3 权限相互独立；仅给需要的角色授权。

同机推荐回环连接。Docker 中“同机”不代表共享 `127.0.0.1`：需要共享网络命名空间或受限网络与适当的 TLS 反代。跨主机部署需要显式 remote 模式、HTTPS 和来源限制，不能直接公开裸 Agent 端口。本版本的集成测试让 WordPress 与 Agent 共享容器网络命名空间，Agent 仍只监听回环。

## 备份与升级

备份前停止自己的 TS3 服务，避免数据库正在写入；生成的备份必须先检查和试恢复，再作为生产恢复依据：

```bash
sudo systemctl stop ts3server.service
sudo -u ts3 /opt/ts3pilot/ts3pilot backup --dest /var/lib/ts3pilot/backups/ts3.tar.gz --config /var/lib/ts3pilot/config.json
sudo systemctl start ts3server.service
sudo -u ts3 /opt/ts3pilot/ts3pilot restore --backup /var/lib/ts3pilot/backups/ts3.tar.gz --dry-run --config /var/lib/ts3pilot/config.json
```

实际恢复使用 `--force`，会覆盖目标文件，必须先停止服务并保留独立备份。备份/恢复不跟随符号链接；无法由 ustar 表示的路径会明确报错，不生成可静默损坏的备份。

`sudo ts3pilot update self --config /var/lib/ts3pilot/config.json` 更新的是 CLI 本身，**不会升级第三方 TS3 Server**。独立 CLI 更新通过 GitHub 官方资产摘要校验、候选版本验证和原子替换完成；随后重启自己的 Agent 服务。WordPress 通过 Release 更新检查器或上传 ZIP 更新。镜像不可用时可以走官方源或提供可信摘要，不能关闭 TLS/校验和保护。
