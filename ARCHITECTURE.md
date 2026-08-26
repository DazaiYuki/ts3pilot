# 架构文档（ARCHITECTURE.md）

## 1. 总体分层

产品由四个解耦的 Plane 组成，任何组件都不强依赖另一个组件才能完成自己的
基础工作：

1. **Local Management Tool（本地管理工具）** — `ts3-manager` CLI，可独立运行。
2. **Agent（受控的 Host Control Plane）** — 同一进程内的可选 HTTP 服务，仅在
   `api enable` 后监听。
3. **WordPress（可选的 Web Control Plane）** — `ts3-operations-wp` 插件。
4. **TeamSpeak 3（Service Plane）** — 真实 TS3 Server（或开发用 Mock）。

```
┌──────────────┐     ┌──────────────────────┐     ┌───────────────────┐
│  WordPress   │     │  ts3-manager Agent   │     │   TeamSpeak 3     │
│  (Web CP)    │ ───▶│  (Host CP, /v1 API)  │ ───▶│  Server (Service) │
│  PHP 服务端  │HMAC │  loopback 默认监听    │ TS3 │  Voice/Query/etc  │
└──────────────┘     └──────────────────────┘     └───────────────────┘
        ▲                     ▲
        │ 可选                 │ 同进程
   ┌────┴────┐          ┌─────┴─────┐
   │ 浏览器  │          │ ts3-manager CLI │
   └─────────┘          └───────────┘
```

## 2. 组件边界

### 2.1 ts3-manager（CLI/Agent，`apps/ts3-manager`）

- `src/cli/` — 命令解析与分发（无第三方依赖）。
- `src/domain/` — 错误码、动作枚举、Capability 常量、领域模型、运行时 schema 校验。
- `src/config/` — 集中配置（默认端口全部在此层，业务代码不硬编码端口）。
- `src/security/` — HMAC 协议、配对、nonce、令牌桶限流、secret 生成。
- `src/system/` — `ServiceManager` 接口 + `mock` / `systemd` / `script` provider；
  唯一的进程执行入口 `processRunner.ts` 只接受固定参数数组，绝不使用 shell。
- `src/ts3/` — `TeamSpeakClient` 接口 + `mock` / `webquery` / `serverquery`
  实现；WebQuery 端点映射在未对照官方文档验证前一律拒绝执行。
  ServerQuery 拆分为纯协议层（命令组装/响应解析/通知分离）与长连接层
  （banner/login/use 握手、串行命令队列、通知回调、重连骨架），并用
  假 TCP Server 完成契约测试。
- `src/agent/` — HTTP 服务器、路由表、HMAC 认证、能力守卫。
- `src/services/` — 端口探测、日志读取、备份/恢复（含 manifest 与校验和）。

### 2.2 ts3-operations-wp（WP 插件，`plugins/ts3-operations-wp`）

- `src/Agent/` — PHP HMAC 协议镜像 + WordPress HTTP API 客户端 + 配对。
- `src/Rest/` — REST 路由，全部带 `permission_callback`。
- `src/Services/` — 服务端状态快照（transient 缓存、离线降级、公共字段投影）。
- `src/Frontend/` — `[ts3_status]` shortcode 与动态 Gutenberg Block（服务端渲染）。
- `src/Admin/` — 管理页面与 `admin-post` 动作（capability + nonce 双检查）。
- `src/Identity/` — 用户身份映射状态机与一次性 Challenge（可选模块）。
- `src/Audit/` — 有界审计日志（环形缓冲，绝不记录凭据）。

插件**从不**执行 shell、**从不**要求 root，**从不**把 Agent 凭据输出到浏览器。

## 3. 端口与监听模型

端口集中在配置层（`src/domain/schemas.ts`），默认值：

| 用途 | 默认端口 | 归属 |
| --- | --- | --- |
| TS3 Voice (UDP) | 9987 | TS3 |
| TS3 File Transfer (TCP) | 30033 | TS3 |
| TS3 ServerQuery Raw (TCP) | 10011 | TS3 |
| TS3 ServerQuery SSH (TCP) | 10022 | TS3 |
| TS3 WebQuery HTTP (TCP) | 10080 | TS3 |
| TS3 WebQuery HTTPS (TCP) | 10443 | TS3 |
| **Agent API（本项目）** | **17880（仅 loopback）** | 本项目 |

Agent API **绝不**与 TS3 WebQuery 共用监听地址/端口：`api enable` 会拒绝使用
TS3 保留端口。默认只监听 `127.0.0.1`；绑定 `0.0.0.0`/`::` 必须显式 `--remote`，
并要求生产模式下配合 TLS/反代。文档与 UI 始终明确当前处于
`localhost` 还是 `remote` 模式。

## 4. 认证与配对

### 4.1 请求签名（协议 v1）

canonical string：

```text
TS3COPS-HMAC-SHA256 v1
<timestamp>
<nonce>
<METHOD>
<path>
<sha256-hex(raw body)>
```

签名 = `HMAC-SHA256(secret, canonical)` 的 hex。请求头：
`X-TS3COPS-Timestamp`、`X-TS3COPS-Nonce`、`X-TS3COPS-Signature`。

验证端（Node 与 PHP 双实现）使用同一静态测试向量
（`test/hmac.test.ts` 与 `tests/ProtocolTest.php`），保证跨语言一致。

### 4.2 配对流程

1. `ts3-manager api enable` 生成一次性配对码（8 位、15 分钟有效、仅存哈希），
   并生成 `node_id`。
2. WP 后台输入 Agent URL + 配对码；WP 以配对码为 secret 签名
   `POST /v1/agent/pair`。
3. Agent 校验配对码与签名，原子消费配对码，生成长期 credential（32 字节
   base64url）并返回一次。
4. WP 服务端保存 credential（`wp_options`，仅 PHP 可见）。

`rotate-secret` / `unpair` / `disable` 提供凭据轮换、吊销与停止监听。

## 5. 权限模型

### 5.1 Agent Capability

每个端点声明所需 capability（见 [Agent API 文档](docs/api/agent-api-v1.md)）。
默认授予除高风险外的全部能力；`server.update`、`server.restore`、
`server.restart` 需要 `--high-risk` 显式开启。凭据只绑定一份能力列表。

### 5.2 WordPress Capability

`manage_ts3_view`、`manage_ts3_clients`、`manage_ts3_channels`、
`manage_ts3_server`、`manage_ts3_maintenance`、`manage_ts3_users`。
激活时默认授予 administrator，站长可自定义。

### 5.3 两套权限平行

WP 用户在网站上的 capability 决定网页端操作；TS3 Server Group 只决定 TS3
客户端内的权限。两者**绝不强制同步**。身份映射（User Mapping）是可选未来
能力，用于"证明玩家身份"，而不是合并管理员权限。

## 6. 数据流

### 6.1 公开状态卡片

```
访客浏览器 → WP（shortcode/block）→ StatusService
          → transient 缓存（默认 10s）→ Agent /v1/ts3/status
          → 公共字段投影（online/name/clients/max/version）
```

前端**从不直接调用 Agent**；缓存避免公开页面打爆 Agent/TS3。Agent 不可达时
返回"暂时无法获取状态"，绝不输出 PHP warning/stack trace。

### 6.2 管理动作（以 Kick 为例）

```
管理员 → WP Clients 页 → REST POST /clients/kick
      → permission_callback（manage_ts3_clients）
      → Agent POST /v1/ts3/clients/kick（HMAC + capability ts3.clients.kick）
      → Mock/ServerQuery/WebQuery → 审计日志
```

## 7. Windows Mock 架构

平台判断只发生在两个工厂里（`system/factory.ts`、`ts3/factory.ts`），业务层
只面向接口。Windows 开发环境：

- `ServiceManager` → `MockServiceManager`（状态持久化到 dataDir，跨进程可见）；
- `TeamSpeakClient` → `MockTeamSpeakClient`（确定性 fixture，字段完整）。

Mock 返回**结构真实**的数据（显式 `mock: true`），不会用假成功掩盖逻辑错误；
Agent API 测试在 Windows 上真实跑通完整 HMAC/能力/限流/配对链路。

## 8. 单节点与多节点

配置围绕 Node 实体设计（`node_id`、endpoint、credential、capabilities）。
当前 MVP 为单节点；多节点版仅需把 WP 设置从单个 URL/凭据扩展为 node 数组，
Agent 侧无需改动。来自 Agent 的请求必须验证 node 身份，不能跨 node 信任。

## 9. 发布与升级策略

- CLI/Agent 与 WP 插件分开发、独立构建、独立发布；插件包不捆绑 daemon。
- Agent API 以 `/v1/` 版本化；协议版本作为正式依赖（`X-*` 头 + `protocolVersion`）。
- 更新机制必须可验证（checksum/signature）并支持回滚；未配置已验证官方源时
  拒绝执行，不猜测官方 URL。

## 10. Design Decisions / Deviations（设计决策与对原始要求的修正）

1. **WebQuery 端点映射不预设**：原需求要求实现 WebQuery；受"不得凭记忆编造
   官方 API"约束，我们提供 adapter + `verified` 门控。未验证前返回
   `TS3_API_UNVERIFIED`，验证后只需打开配置开关并补充集成测试。
2. **维护类操作（update/backup/restore）在 Agent API 中返回 501**：备份/恢复
   由 CLI 本地实现（已可用），Agent 端点保留但诚实标记 NOT_IMPLEMENTED，
   避免"看起来能用"的假接口。
3. **端口 0 用于测试**：Agent 服务器支持 `listenPort` 覆盖（仅测试/开发），
   便于 CI 使用临时端口；生产配置仍强制 1–65535。
4. **psr-4 文件结构**：WP 插件使用命名空间 + 自动加载，而非 WordPress 传统
   `class-*.php` 命名；phpcs 中显式豁免 `WordPress.Files.FileName` 并记录原因。
5. **TS3 Server 安装/更新执行管线暂不实现**：install 输出完整计划并校验
   `verified` 源；执行下载/替换需要对照官方文档验证源 URL 与校验和，列为
   下一里程碑，而不是伪造一个官方 URL。
6. **ServerQuery 以契约测试先行**：握手、命令组装、响应解析、`notify*`
   事件分发先用"说同一线格式的假 TCP Server"验证；SSH（10022）传输层涉及
   完整 SSH 客户端实现，列为后续里程碑，不在本轮伪造。
