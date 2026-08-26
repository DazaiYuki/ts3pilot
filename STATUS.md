# 项目状态（STATUS.md）

生成时间：2026-08-26（开发环境：Windows 11 + Node 24.15 + PHP 8.5）

## 1. 当前验证结果（全部绿色）

| 检查 | 结果 |
| --- | --- |
| `npm install`（npm workspaces，缓存于 `.npm-cache`） | 通过（112 包） |
| `composer install`（WP 插件开发依赖） | 通过（30 包） |
| ESLint（ts3-manager src/test） | 通过，0 warning |
| `tsc -p tsconfig.json`（strict，含测试） | 通过 |
| `node --test`（ts3-manager） | 47/47 通过 |
| PHPUnit（WP 插件） | 15 测试 / 45 断言通过 |
| PHP lint（全部 PHP 文件） | 33/33 通过 |
| PHPCS（WordPress-Extra，含豁免项） | 通过 |
| `tsc -p tsconfig.build.json`（dist 产物） | 通过，`dist/cli/index.js` 可运行 |
| CLI 端到端冒烟 | config init / status(mock) / api enable / pair / doctor / logs / backup / restore(dry-run) / agent + /v1/health 全部通过 |
| Agent API 安全测试 | 认证缺失/错误签名/时间窗/nonce 重放/body 篡改/能力拒绝/404/405/413/501/配对/轮换/停用 全部通过 |
| ServerQuery 协议契约 | 假 TCP Server：握手/命令/通知/登录失败测试全部通过 |

## 2. 实际实现的功能（真实可运行）

### ts3-manager（`packages/ts3-manager`）

- CLI：`start`、`stop`、`restart`、`status`、`version`、`config
  init/show/get/set/validate/path`、`api enable/disable/status/pair/rotate-secret/unpair`、
  `agent`、`doctor`、`logs`、`backup`、`restore`（dry-run 默认）、`install`（计划模式）、
  `adopt`（只读分析）、`update`（源校验）。
- Agent `/v1` API：health/info/status/clients/channels（list/create/edit/
  delete/move）/kick/ban/move/poke/system start/stop/restart/status/pair/
  rotate-secret/unpair/disable；maintenance 三端点诚实返回 501。
- 安全体系：HMAC-SHA256 v1（canonical string + 恒定时间比较）、timestamp 窗口、
  nonce 单次消费、token-bucket 限流、body 上限、无 CORS、错误 envelope、
  capability 模型（高风险能力默认不授予）、配对码一次性/15 分钟/哈希存储。
- 系统抽象：`ServiceManager`（mock/systemd/script）+ 唯一安全进程执行器
  `processRunner`（参数数组，无 shell）；Windows 自动 mock。
- TS3 抽象：`TeamSpeakClient`（mock/webquery/serverquery）；WebQuery 未验证
  端点默认拒绝；ServerQuery 纯协议层 + 长连接层已实现，并用假 TCP Server
  完成握手/命令/通知/登录失败契约测试。
- 备份/恢复：目录复制 + manifest（sha256 校验和）+ 路径逃逸防护 +
  开发模式破坏性操作开关（`TS3_MANAGER_ALLOW_DESTRUCTIVE`）。

### ts3-operations-wp（`packages/ts3-operations-wp`）

- 插件主文件、激活/停用/卸载语义（卸载按设置决定是否删数据）。
- `manage_ts3_*` 六项 capability，激活时默认授予 administrator。
- Agent 客户端：PHP 端 HMAC 协议镜像（跨语言向量一致）、WP HTTP API 封装、
  timeout/sslverify、错误映射、配对流程。
- REST：公开 status（缓存+公共字段投影）、dashboard、clients、kick、
  channels、maintenance/restart；全部带 `permission_callback`。
- 前台：`[ts3_status]` shortcode（属性白名单 + 输出转义 + join policy）；
  动态 Gutenberg Block（服务端渲染，无构建依赖）。
- 后台：Dashboard、Clients（kick 双确认）、Maintenance（restart）、Settings
  （Settings API + 配对向导）、Diagnostics（审计日志 + 脱敏配置）；
  Channels/Users 为明确的占位页。
- 身份模块：Mapping 状态机（unbound/pending/verified/revoked）+ 一次性
  Challenge（TTL、尝试上限、单次消费），Bot 验证通道为未来模块。
- 审计日志：有界环形缓冲（500 条），不含凭据。

## 3. 目前仅为接口/测试桩的部分

| 项目 | 状态 | 说明 |
| --- | --- | --- |
| Agent maintenance update/backup/restore | 501 | CLI backup/restore 已真实可用；Agent 端点留待后续 |
| WebQuery 真实请求 | 门控 | 端点映射需对照官方文档验证后打开 `verified=true` |
| ServerQuery 真实联调 | 需验证 | 协议契约测试已通过；与真实 TS3 的最终核对仍待 Docker/实机 |
| install/update 执行管线 | 计划模式 | 需已验证官方源（URL+sha256）后实现下载/校验/替换/回滚 |
| 频道创建/编辑/删除、服务器配置读写 | capability 已预留 | Mock 未实现对应动作，端点未开放 |
| 身份绑定 Bot 通道 / 加入链接生成 / 角色同步 | 设计+桩 | 需真实协议验证后实现 |
| 多节点 | 单节点已实现 | 配置已按 Node 实体设计，扩展点明确 |
| Gutenberg React 编辑器 UI | 基础动态块 | 标准 block 结构已建，完整 React UI 为后续 |

## 4. 需要真实 Linux / TS3 验证的功能

- systemd provider 行为（unit 解析、启停）。
- script provider（`ts3server_startscript.sh` 参数语义）。
- WebQuery/ServerQuery 端点与转义格式与官方文档逐项核对。
- 官方安装源 URL/校验和与许可证条款核对。
- Docker 沙盒镜像名/tag 与环境变量核对（`sandbox/` 已留 TODO）。

## 5. 当前环境限制

- 无 Docker、WSL 无发行版：真实 TS3 联调未执行，只有 mock 与契约测试。
- PHP zip 扩展未启用：composer 以源码模式安装（已成功）。
- PowerShell 执行策略限制 `npm.ps1`：统一使用 `npm.cmd`。
- Windows 无 systemd：ServiceManager 自动降级 mock（这是设计而非缺陷）。

## 6. 下一步建议

1. 在 Linux 主机跑 `doctor` + systemd 冒烟，修复 provider 细节。
2. 对照官方文档验证 WebQuery 端点并补集成测试，打开 `verified=true`。
3. 用 Docker 沙盒（官方镜像验证后）做真实 ServerQuery/WebQuery 联调。
4. 实现 install/update 执行管线（校验源 + 回滚）与 Agent maintenance 端点。
5. 实现 Channels/Server 管理、身份 Bot 通道与加入链接生成。
