# 快速上手与常见问题

生产部署使用独立 Linux x86_64 二进制，不需要 Node/npm。当前版本为 [v0.4.1](https://github.com/DazaiYuki/ts3pilot/releases/tag/v0.4.1)，npm 官方包目前仍为 0.4.0（2026-10-09 查询）。

## 生产部署顺序

1. 按 [README 安装 CLI](../README.zh-CN.md#安装-cli)；大陆或受限网络使用[大陆安装指南](mainland-install.md)。
2. 按[生产部署文档](deployment.md)创建非 root 账户和专用配置，明确选择 production 模式。
3. **新建**：确认官方 TS3 包摘要并接受许可后安装，再配置服务账户和 systemd。**接管**：设置既有目录、只读运行 `adopt`，保留原服务与数据。
4. 用受保护编辑器填写真实 Query 凭据，用相同 `--config` 运行 `doctor`。
5. 执行 `api enable` 取得单次配对码，按部署文档托管 Agent。
6. WordPress 上传正式插件 ZIP 并激活，在 Settings 填写 Agent 地址及配对码，确认真实在线状态与频道管理。

## 为什么 install 看起来成功，但没有真实 TS3？

默认新配置为 development，安装使用 mock。必须显式设置 production，并在所有命令中使用同一配置。`doctor` 与面板真实 Query 状态比单独的 Agent health 更能确认 TS3 连接成功。

## 配对失败怎么办？

检查 15 分钟有效期、是否已用过配对码、两侧时间同步、Agent 地址及 HTTPS。原生同机可以用 `127.0.0.1`；两个 Docker 容器的回环地址通常不共享。跨主机按照部署文档配置 HTTPS 和来源限制。

## 面板能看状态，不能启停服务？

Query 管理与系统服务控制不同。检查实际 provider、服务名和专用账户的 Polkit 授权；部署文档提供仅允许指定 TS3 unit 启停的规则。不要把 Agent 改为 root 或授予任意 sudo。

## 前台展示怎么做？

使用 TS3 Status 区块，或 `[ts3_status]`、`[ts3_status node="节点ID" show_channels="true"]`。身份入口使用 `[ts3_identity]`。WordPress 权限与 TeamSpeak 权限独立配置。

## 备份和升级？

先停止自己的 TS3 服务再备份，检查备份并试恢复；正式恢复前保留独立备份。`update self` 更新 CLI，不更新第三方 TS3 Server。GitHub API 不可达时使用离线安装器，WordPress 手动上传已校验 ZIP，见[大陆指南](mainland-install.md)。

## 我要修改源码，需要什么？

使用 Node 24；Node 22.6+ 需开启类型擦除。PHP/Composer 用于插件开发测试，不是正式插件安装依赖。

```bash
git clone https://github.com/DazaiYuki/ts3pilot.git
cd ts3pilot
npm ci
npm run cli -- help
```

完整测试和构建见[开发文档](development.md)。源码开发命令不替代生产账户、配置和服务部署流程。
