# 部署文档（DEPLOYMENT.md）

## 1. Linux 生产部署（目标环境）

### 1.1 最小步骤

```bash
# 1) 安装/接管 TS3（install 输出计划；adopt 只读分析现有实例）
ts3-manager install --execute   # 需要先配置已验证的官方源
ts3-manager adopt               # 接管已有实例（只读）

# 2) 配置并验证
ts3-manager config set ts3.installPath /srv/ts3
ts3-manager doctor

# 3) 开启 Agent（默认 loopback）
ts3-manager api enable --port 17880
ts3-manager agent               # systemd 托管时由 unit 启动
```

### 1.2 systemd 加固示例

`system.unitName` 默认 `ts3server.service`。示例 unit（**参数必须按实际安装
目录调整后验证**，例如 TS3 需要可写的 `files/`、`logs/` 与数据库目录）：

```ini
[Unit]
Description=TS3 Community Operations Agent
After=network.target

[Service]
Type=simple
User=ts3agent
Group=ts3agent
ExecStart=/usr/bin/node /opt/ts3-ops/ts3-manager/dist/cli/index.js agent
Environment=TS3_MANAGER_CONFIG=/etc/ts3-ops/config.json
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=full
ProtectHome=true
ReadWritePaths=/opt/ts3-ops /srv/ts3
Restart=on-failure

[Install]
WantedBy=multi-user.target
```

不要把 Agent 或 TS3 以 root 运行；特权动作（若有）走最小权限 sudo/systemd
policy，而不是 root daemon。

> 注意：`ts3-agent.service` **不启用** `MemoryDenyWriteExecute`——Node.js/V8
> 需要 JIT 可执行内存，开启后 Agent 会直接崩溃；该指令仅用于
> `ts3server.service`（原生二进制）。

## 2. 防火墙

公网只开放玩家端口：Voice UDP 9987、File Transfer TCP 30033（按实际配置）。
ServerQuery（10011/10022）与 WebQuery（10080/10443）管理口默认不对公网开放；
Agent 端口默认只监听 loopback。

## 3. Agent 模式

| 模式 | 监听 | 场景 |
| --- | --- | --- |
| localhost（默认） | `127.0.0.1:17880` | WP 与 Agent 同机 |
| remote（高级） | 显式 `--remote` + 生产模式 | 跨主机；必须 HTTPS/反代、强凭据、来源限制 |

`api status` 显示当前模式；`api disable` 停止监听并吊销凭据。

## 4. WordPress 部署

1. 上传 `ts3-operations-wp` 目录到 `wp-content/plugins/` 并激活。
2. 在 Agent 所在主机执行 `ts3-manager api enable`，复制配对码。
3. WP Settings → 输入 Agent URL（如 `http://127.0.0.1:17880`）与配对码 → 完成配对。
4. 用 shortcode 或 Block 展示状态卡；按需配置 join policy/URL。

停用插件不会删除数据；卸载是否删除数据由 `delete_data_on_uninstall` 设置决定。

## 5. 备份与恢复

```bash
ts3-manager backup --source /srv/ts3 --dest /srv/backups/ts3-2026-01-01
ts3-manager restore --backup /srv/backups/ts3-2026-01-01 --dry-run
ts3-manager restore --backup /srv/backups/ts3-2026-01-01 --force
```

恢复是破坏性操作：生产模式仍要求 `--force`，开发模式额外要求
`TS3_MANAGER_ALLOW_DESTRUCTIVE=1`，且始终写审计日志。

## 6. 升级

更新管线要求 `ts3.install.sourceUrl` + `sha256` + `verified=true`（对照官方
文档验证）；下载后校验、支持回滚。未配置前 `update` 拒绝执行。
