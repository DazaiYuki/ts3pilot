# Agent API v1 协议文档

## 1. 通用约定

- Base URL 默认 `http://127.0.0.1:17880`（可配置；远程模式需显式开启 + TLS/反代）。
- 所有响应为 JSON：
  - 成功：`{ "ok": true, "data": ... }`
  - 失败：`{ "ok": false, "error": { "code", "message", "requestId" } }`
- 错误码见 §6；HTTP 状态码与错误码一一对应（400/401/403/404/405/413/429/500/501/502）。
- 除 `/v1/health` 外均要求认证；无 CORS 头；`Cache-Control: no-store`。

## 2. 认证（HMAC-SHA256，协议 v1）

请求头：

| Header | 说明 |
| --- | --- |
| `X-TS3COPS-Timestamp` | Unix 秒（与服务器偏差 ≤ 300s，可配置） |
| `X-TS3COPS-Nonce` | 每次请求唯一；重复使用返回 401 REPLAY_DETECTED |
| `X-TS3COPS-Signature` | HMAC-SHA256 hex，小写 |

canonical string：

```text
TS3COPS-HMAC-SHA256 v1
<timestamp>
<nonce>
<METHOD>
<path>
<sha256-hex(raw body)>
```

`path` 必须是规范化路径（如 `/v1/ts3/status`）。配对请求以配对码为 secret。

## 3. Endpoints

| Method | Path | 认证 | Capability | 说明 |
| --- | --- | --- | --- | --- |
| GET | `/v1/health` | 公开 | — | 健康检查（不泄露 secret） |
| GET | `/v1/info` | HMAC | — | Agent 元信息（nodeId/mode/capabilities/providers） |
| GET | `/v1/ts3/status` | HMAC | `ts3.status` | 服务器状态 |
| GET | `/v1/ts3/clients` | HMAC | `ts3.clients.list` | 在线客户端列表 |
| GET | `/v1/ts3/channels` | HMAC | `ts3.channels.list` | 频道树 |
| POST | `/v1/ts3/channels/create` | HMAC | `ts3.channels.create` | 创建频道 |
| POST | `/v1/ts3/channels/edit` | HMAC | `ts3.channels.edit` | 编辑频道 |
| POST | `/v1/ts3/channels/delete` | HMAC | `ts3.channels.delete` | 删除频道 |
| POST | `/v1/ts3/channels/move` | HMAC | `ts3.channels.move` | 移动频道 |
| POST | `/v1/ts3/clients/kick` | HMAC | `ts3.clients.kick` | 踢出客户端 |
| POST | `/v1/ts3/clients/ban` | HMAC | `ts3.clients.ban` | 封禁客户端 |
| POST | `/v1/ts3/clients/move` | HMAC | `ts3.clients.move` | 移动客户端 |
| POST | `/v1/ts3/clients/poke` | HMAC | `ts3.clients.poke` | 私聊消息 |
| POST | `/v1/system/start` | HMAC | `server.start` | 启动服务 |
| POST | `/v1/system/stop` | HMAC | `server.stop` | 停止服务 |
| POST | `/v1/system/restart` | HMAC | `server.restart`（高风险） | 重启服务 |
| GET | `/v1/system/status` | HMAC | `server.status` | 服务状态 |
| POST | `/v1/maintenance/update` | HMAC | `server.update`（高风险） | 501 NOT_IMPLEMENTED（MVP） |
| POST | `/v1/maintenance/backup` | HMAC | `server.backup` | 创建真实 tar.gz 备份 + manifest |
| POST | `/v1/maintenance/restore` | HMAC | `server.restore`（高风险） | 恢复/预检（dry-run），需 force=true |
| POST | `/v1/agent/pair` | 配对码 | `agent.pair` | 完成配对，返回长期 credential（一次性） |
| POST | `/v1/agent/rotate-secret` | HMAC | `agent.rotate-secret` | 轮换 credential |
| POST | `/v1/agent/unpair` | HMAC | `agent.unpair` | 吊销 credential |
| POST | `/v1/agent/disable` | HMAC | `agent.api.disable` | 停止监听并吊销 |
| POST | `/v1/identity/challenge` | HMAC | `identity.challenge.register` | 注册一次性身份绑定挑战（WP 发起） |

路由表与代码一致性由 `test/routeTable.test.ts` 强制（`DOCUMENTED_ENDPOINTS`）。

## 4. 请求/响应 schema

### POST /v1/ts3/clients/kick

```json
{ "clientId": 3, "reason": "spam", "kickFrom": "channel" }
```

`kickFrom` ∈ {`channel`, `server`}。成功：`{ "ok": true }`。

### POST /v1/ts3/channels/create

```json
{ "name": "New Lobby", "parentId": 1, "order": 5 }
```

成功：`{ "ok": true, "data": { "channelId": 10 } }`。

### POST /v1/ts3/channels/edit

```json
{ "channelId": 10, "name": "Renamed", "topic": "hello" }
```

`name`/`topic`/`description` 均可选；至少提供一项。成功：`{ "ok": true }`。

### POST /v1/ts3/channels/delete

```json
{ "channelId": 10, "force": true }
```

### POST /v1/ts3/channels/move

```json
{ "channelId": 10, "parentId": 2, "order": 1 }
```

### POST /v1/maintenance/backup

```json
{ "destPath": "/srv/backups/ts3-2026-01-01.tar.gz" }
```

成功：`{ "ok": true, "data": { "archivePath": "...", "manifest": { ... } } }`。
默认备份 `ts3server.sqlitedb`、`ts3server.ini`、`files/`、license 文件；
manifest 记录 sha256/大小/TS3 版本/时间戳。

### POST /v1/maintenance/restore

```json
{ "archivePath": "/srv/backups/ts3-2026-01-01.tar.gz", "destPath": "/srv/ts3", "dryRun": true }
```

`dryRun: true` 只做 manifest/hash/权限预检，不写盘；真实恢复需
`"force": true`（且 capability `server.restore` 需显式授予）。恢复目标必须
位于配置的 TS3 安装根目录内；路径穿越/符号链接条目一律拒绝。

### POST /v1/agent/pair

```json
{ "pairingCode": "VS3MJNTZ" }
```

成功：`{ "ok": true, "data": { "nodeId": "...", "credential": "...", "protocolVersion": 1 } }`

credential 只返回这一次。

### POST /v1/identity/challenge

```json
{
  "wpUserId": 42,
  "code": "A1B2C3D4",
  "expiresAt": 1735000000000,
  "webhookUrl": "https://example.test/wp-json/ts3-operations/v1/identity/callback",
  "webhookSecret": "long-random-secret"
}
```

成功：`{ "ok": true, "data": { "ok": true, "expiresAt": 1735000000000 } }`。

- 挑战码单次消费、10 分钟默认过期（可自定义 `expiresAt`）、尝试次数超限即锁定。
- Agent 的 Challenge Verification Worker 轮询 TS3 在线客户端，在昵称（或
  `away` 字段）中匹配验证码；成功后通过 HMAC 签名的 webhook 回调 WP。

## 5. Capability 模型

完整列表见 `src/domain/capabilities.ts`。默认授予除高风险
（`server.update`、`server.restore`、`server.restart`）外的全部能力；
`api enable --high-risk` 显式授予。能力不足返回 403 `PERMISSION_DENIED`。

## 6. 错误码

| Code | HTTP | 说明 |
| --- | --- | --- |
| VALIDATION_ERROR | 400/405/413 | 参数/方法/体积 |
| AUTH_FAILED | 401 | 签名/时间窗/凭据 |
| REPLAY_DETECTED | 401 | nonce 重放 |
| PERMISSION_DENIED | 403 | capability 不足 |
| NOT_FOUND | 404 | 未知端点 |
| RATE_LIMITED | 429 | 限流 |
| CONFIG_ERROR / INTERNAL_ERROR / SYSTEM_COMMAND_ERROR | 500 | 配置/内部/系统错误 |
| NOT_IMPLEMENTED / TS3_API_UNVERIFIED / TS3_FEATURE_UNSUPPORTED | 501 | 未实现/未验证/不支持 |
| TS3_ERROR / NETWORK_TIMEOUT | 502 | TS3/上游错误 |

## 7. 版本与兼容性

- 路径以 `/v1/` 前缀版本化；新增端点只增不改；破坏性变更必须升级版本。
- `protocolVersion` 字段随响应返回；WP 端把协议版本视为正式依赖。
- 跨语言向量固定于 `test/hmac.test.ts` 与 `tests/ProtocolTest.php`。
