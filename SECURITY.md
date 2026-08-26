# 安全设计（SECURITY.md）

## 1. 安全原则

- 最小权限：WP 能力、Agent capability、系统用户、systemd hardening 分级授权。
- 最小暴露面：Agent API 默认 loopback、默认关闭；TS3 Query 默认不开放公网。
- 默认拒绝：未知路由 404、未知能力 403、缺失签名 401、超限 413/429。
- 纵深防御：capability ≠ 认证 ≠ nonce；前端隐藏按钮不是安全措施。
- 可审计：所有管理动作写入审计日志；日志绝不包含凭据。

## 2. 威胁模型

| 威胁 | 场景 | 缓解 |
| --- | --- | --- |
| WordPress 漏洞导致 Agent RCE | WP 被入侵后通过插件调用 Agent | Agent 是固定动作枚举的 /v1 API，无任意命令执行；高风险动作需独立 capability |
| 凭据泄露 | DB 被读 / 日志被读 | credential 只存 WP options；日志/审计/错误消息全部脱敏；CLI 只显示一次 |
| SSRF | 低权限用户影响 Agent endpoint | Agent URL 只能由 `manage_options` 在 Settings 修改；Sanitizer 拒绝带凭据 URL；WP HTTP API 仅服务端调用 |
| CSRF | 伪造管理请求 | REST 用 WP nonce；admin-post 用 `check_admin_referer`；真正授权仍由 capability 完成 |
| 权限提升 | 普通用户踢人/重启 | 每个路由 `permission_callback` + 后台二次确认；前端按钮隐藏仅 UX |
| Replay attack | 重放已捕获请求 | timestamp 窗口（默认 300s）+ nonce 单次消费 + HMAC 恒定时间比较 |
| Brute force | 猜测配对码/凭据 | 配对码高熵 8 位 + 15 分钟 TTL + 单次消费 + 专用限流（10/min/IP） |
| Path traversal | 备份/恢复路径逃逸 | 相对路径规范化检查、拒绝 `..`、dest 不得位于源/备份目录内 |
| Command injection | 用户输入进入 shell | 全项目无 shell 执行；`processRunner` 只接受参数数组；WP 侧无 exec |
| SQL injection | WP 数据查询 | 仅使用 WP API/options/usermeta，无手写 SQL |
| XSS / stored XSS | TS3 昵称/频道名注入 | 所有 TS3 派生字符串视为不可信，输出一律 `esc_html`/`esc_attr` |
| Open redirect | join 链接 | join URL 由管理员配置并 `esc_url`；不含任何 secret |
| Credential logging | debug 日志泄露 | Logger 按键名与值特征脱敏；`config show` 输出 [REDACTED] 占位 |
| 敏感数据泄露 | 公开状态卡 | 公共投影只含 online/name/clients/max/version；Clients 列表仅管理员 |
| Agent 暴露公网 | 误绑定 0.0.0.0 | 默认拒绝；`--remote` 显式开关 + 生产模式 + TLS/反代建议 |
| TS3 API key 权限过大 | WebQuery key 有全部权限 | 文档要求最小权限 key；adapter 层隔离；serveradmin 只作初始化凭据 |
| 恶意 WP 管理员 | 滥用管理权限 | 粒度 capability（view/clients/channels/server/maintenance/users），可按角色授予 |
| 恶意 TS3 用户 | 网页/TS3 权限混淆 | 两套权限完全平行，互不自动同步 |
| 被入侵的 Agent | 伪造 node 身份 | 每个请求验证 node 凭据；WP 只信任已配对 node |

## 3. 凭据与秘密处理

- 长期 credential：WP 端只存 `wp_options`（PHP 服务端）；Agent 端存配置文件。
- 绝不进入 URL、查询参数、前端 HTML、Gutenberg 源码或 REST 普通响应。
- 配对码仅存哈希；`api status` / `config show` 不打印任何完整 secret。
- 支持 rotate-secret / unpair / disable 完整生命周期。

## 4. 网络层

- Agent 默认 `127.0.0.1:17880`；与 TS3 端口冲突时 `api enable` 直接拒绝。
- 无 CORS 头（不需要就不开）。
- 无 WebSocket/SSE；前端轮询走后端缓存快照。
- 公网防火墙只开放玩家端口（voice/file transfer），Query 管理口默认不开放。

## 5. 部署加固

- Agent/TS3 使用专用低权限用户；systemd unit 带
  `NoNewPrivileges`、`PrivateTmp`、`ProtectSystem=full`、`ProtectHome=true`（见
  docs/deployment.md，具体参数需按实际安装目录验证）。
- 生产模式要求已验证的 TS3 连接（WebQuery `verified=true` 或 ServerQuery 凭据），
  否则 CLI 拒绝启动。

## 6. 漏洞报告

请通过项目 GitHub Issues（私密安全标签）或邮件联系维护者；不要在公开渠道
披露未修复漏洞细节。
