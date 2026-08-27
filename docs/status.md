# 项目状态（STATUS.md）

生成时间：2026-08-28（开发环境：Windows 11 + Node 24.15 + PHP 8.5）

## 1. 当前验证结果（全部绿色）

| 检查 | 结果 |
| --- | --- |
| `npm install`（npm workspaces，缓存于 `.npm-cache`） | 通过（112 包） |
| `composer install`（WP 插件开发依赖） | 通过（30 包） |
| ESLint（ts3-manager src/test） | 通过，0 warning |
| `tsc -p tsconfig.json`（strict，含测试） | 通过 |
| `node --test`（ts3-manager） | 115/115 通过 |
| PHPUnit（WP 插件） | 52 测试 / 137 断言通过 |
| PHP lint（全部 PHP 文件） | 33/33 通过 |
| PHPCS（WordPress-Extra，含豁免项） | 通过 |
| `tsc -p tsconfig.build.json`（dist 产物） | 通过，`dist/cli/index.js` 可运行 |
| CLI 端到端冒烟 | config init / status(mock) / api enable / pair / doctor / logs / backup / restore(dry-run) / agent + /v1/health 全部通过 |
| Agent API 安全测试 | 认证缺失/错误签名/时间窗/nonce 重放/body 篡改/能力拒绝/404/405/413/501/配对/轮换/停用 全部通过 |
| ServerQuery 协议契约 | 假 TCP Server：握手/命令/通知/登录失败测试全部通过 |

## 2. 实际实现的功能（真实可运行）

### ts3-manager（CLI/Agent，`apps/ts3-manager`）

- CLI：`start`、`stop`、`restart`、`status`、`version`、`config
  init/show/get/set/validate/path`、`api enable/disable/status/pair/rotate-secret/unpair`、
  `agent`、`doctor`、`logs`、`backup`、`restore`（dry-run 默认）、`install`（计划模式）、
  `adopt`（只读分析）、`update`（源校验）。
- Agent `/v1` API：health/info/status/clients/channels（list/create/edit/
  delete/move）/kick/ban/move/poke/system start/stop/restart/status/pair/
  rotate-secret/unpair/disable/identity challenge register；maintenance
  backup/restore 真实实现，update 端点诚实返回 501。
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
- 一键安装（本轮）：`services/installer.ts` — 官方源 URL 拼接（默认
  `files.teamspeak-services.com/releases/server/3.13.7/...tar.bz2`，可
  `--version`/`--source-url` 覆盖）、强制 `--accept-eula` 并写入
  `.ts3server_license_accepted`、Linux 下 `tar -xjf` 解压迁移、可选
  `--setup-firewall`（自动检测 ufw/firewalld 放行 9987/30033/10011/10022/
  10080/10443）、安装后自动生成加固 systemd unit；Windows/开发模式走
  Mock（只打印步骤并写 EULA 标记），并有参数校验/URL/Mock/防火墙/校验和
  契约测试。
- 自更新（v0.3.0）：`ts3pilot update [check|self]` — GitHub latest 版本对比、
  下载前 gzip magic 校验、镜像回退链（ghproxy → gh-proxy → 直连，
  `TS3PILOT_GH_MIRROR` 可覆盖）、/tmp 解压、**原子替换 + 自动回滚**
  （旧二进制保留到新二进制通过 `version` 冒烟测试；失败自动恢复，
  避免 Text file busy 与半替换状态）、绿色成功提示；已接入 TUI 菜单 [7]。
- 部署形态识别（v0.3.0）：`ts3.deployment.kind`（auto/native/docker/remote）
  自动检测 + `ts3.query.host`（默认 127.0.0.1）支持远程 ServerQuery；
  `adopt`/`doctor` 输出能力矩阵（serverQuery/filesystem/install），
  Docker 与远程节点给出针对性建议而非误报。
- Adopt 修正：移除 `ts3server_linux_amd64` 检测；`ts3server.ini`、
  `licensekey.dat`、`.ts3server.license` 改为可选（不再误报）。
- TUI 重构：标题改为 `=== TS3Pilot 控制台 ===`，zh 菜单纯中文；新增
  [8] 配置开机自启与守护进程（systemd 生成）、[9] 更改控制台语言（持久化）；
  v0.3.0 起语言菜单在任何当前语言下都保持双语（`[1] English (英文)` /
  `[2] 简体中文 (中文)` + 双语提示与确认），切错也能切回。
- 分发（本轮）：`scripts/install.sh` 一键安装脚本（检测架构 → GitHub
  Releases 拉取最新 **Linux 单文件二进制**（pkg 打包，服务器无需 Node.js）
  → `/opt/ts3pilot` + `/usr/local/bin/ts3pilot` 软链接，全程零系统包安装）；
  CI 新增 Tag（`v*`）触发 GitHub Release 并附加 CLI tar.gz 与 WP zip。
- CI 修复（本轮）：矩阵内改用 `composer update` 按 PHP 版本解析依赖
  （8.1→PHPUnit 10、8.2→11、8.3+→12），修复 PHP 8.1/8.2 因
  composer.lock 锁定 PHPUnit 12 导致的安装失败；新增 install.sh
  shellcheck job；Windows 校验拆分为细粒度步骤便于定位；新增
  `.gitattributes`（eol=lf）修复 Windows 检出 CRLF 导致的 PHPCS 报错。
- 运维底座：`system/backupEngine.ts` 真实 tar.gz 归档（ustar +
  gzip，零依赖）与恢复引擎（manifest 校验、dry-run 预检、路径沙箱、
  拒绝 `..`/绝对路径/符号链接）；`system/systemdGenerator.ts` 生成
  ts3server/ts3-agent 加固 unit（NoNewPrivileges/ProtectSystem=strict/
  PrivateTmp/ProtectHome=read-only 等）；Agent maintenance backup/restore
  已从 501 变为真实实现（restore 需 force + 高风险 capability）。
- 身份核验优化（本轮）：验证源改为 `identity.verify.fields` 多字段优先级
  （client_description → client_away_message → nickname），客户端详情经
  `clientinfo` 获取，避免昵称截断/防刷屏问题。
- CLI 诊断（本轮）：`doctor` 深度检查（端口占用 9987/10011/30033/10080 等、
  目录/文件读写权限、SQLite 文件头与大小、ts3server.ini 可读性、真实
  ServerQuery 登录验证、Agent 健康、provider 可用性）；`adopt` 只读接管
  向导（识别目录结构、解析 ts3server.ini 关键项、端口探测、输出最小改动
  建议如 query_ip_whitelist/受限凭据/先备份，绝不改写文件）。
- systemd 修复（本轮）：`ts3-agent.service` 不再启用
  `MemoryDenyWriteExecute`（Node/V8 JIT 需要可执行内存，否则会崩）；
  该指令仅保留在 `ts3server.service`。
- 多节点（本轮）：WP 侧新增 `NodeRegistry`（node_id/display_name/endpoint/
  credential/timeout/is_active），后台 Node Switcher 一键切换节点，
  Dashboard/Clients/Channels/Maintenance/REST 自动路由到当前节点；每个节点
  凭据独立存储与签名，禁止跨节点复用（隔离契约测试覆盖）；`[ts3_status
  node="..."]` 与 Block 支持指定节点（非法 node_id 回退主节点）；旧版
  单节点设置自动迁移。
- 发布打包（本轮）：`npm run release` 生成
  `dist/release/ts3-manager-v0.1.0.tar.gz`（编译产物 + config.example +
  README/LICENSE）与 `dist/release/ts3pilot-wp-v0.1.0.zip`
  （标准 WP 插件目录结构，剔除 tests/vendor/锁文件）。
- CI（本轮）：`.github/workflows/ci.yml` — Node 22/24 × PHP 8.1/8.2/8.3
  矩阵跑 `npm run verify`；Node 20 跑静态检查（原生 TS 直跑需 22.6+）；
  Windows 节点 24 全量校验；release job 打包并校验产物后上传 artifact。
- 流式备份（本轮）：`readTarGz` 重构为大文件直通流式（不再把整个文件条目
  Buffer.concat 进内存），5MB 大文件契约测试验证多分块流式读取与字节级
  往返；数百 MB files 目录不再有 OOM 风险。
- 发布文档（本轮）：`CHANGELOG.md` 与 `docs/release-notes-v0.1.0.md`。

### ts3pilot-wp（WP 插件，`plugins/ts3pilot-wp`）

- 插件主文件、激活/停用/卸载语义（卸载按设置决定是否删数据）。
- `manage_ts3_*` 六项 capability，激活时默认授予 administrator。
- Agent 客户端：PHP 端 HMAC 协议镜像（跨语言向量一致）、WP HTTP API 封装、
  timeout/sslverify、错误映射、配对流程。
- REST：公开 status（缓存+公共字段投影）、dashboard、clients、kick、
  channels、maintenance/restart；全部带 `permission_callback`。
- 前台：`[ts3_status]` shortcode（属性白名单 + 输出转义 + join policy）；
  动态 Gutenberg Block（服务端渲染，无构建依赖）。
- 后台：Dashboard、Clients（kick/poke/move + admin.js 实时刷新）、Channels
  （完整频道树 + create/edit/move/delete + 二次确认）、Users/Identity
  （绑定状态 + 一次性挑战码 + 状态流转）、Maintenance（restart）、Settings
  （Settings API + 配对向导 + 节点注册表 + **每节点连接测试** + 频道/主题
  选项）、Diagnostics、**Audit Log 只读审计页（v0.3.0）**。
- 插件自更新（v0.3.0）：`GitHubUpdater` 接入 WordPress 标准更新 transient，
  从项目 GitHub Releases 拉取最新 `ts3pilot-wp-v*.zip` 并在后台“插件”页
  显示更新（无需上架 wordpress.org）；`Update URI:` 头 + HTTPS GitHub 资源
  白名单 + 6 小时缓存；/v1/info 新增 deployment 形态，节点连接测试会显示
  native/docker/remote。
- 前台：`[ts3_status]` 支持主题（auto/light/dark）、可折叠频道树、加入链接
  策略；Gutenberg Block 同步支持；全部数据经服务端 Transient 缓存。
- 身份模块：Mapping 状态机（unbound/pending/verified/revoked）+ 一次性
  Challenge（TTL、尝试上限、单次消费）+ **自动化核验闭环**：Agent 轮询
  TS3 客户端昵称匹配验证码 → HMAC webhook → WP `/identity/callback`
  自动置 verified；前台 `[ts3_identity]` 支持用户自主发起绑定。
- 审计日志：有界环形缓冲（500 条），不含凭据。

## 3. 目前仅为接口/测试桩的部分

| 项目 | 状态 | 说明 |
| --- | --- | --- |
| Agent maintenance update | 501 | update 管线仍待已验证官方源；backup/restore 已真实实现 |
| WebQuery 真实请求 | 门控 | 端点映射需对照官方文档验证后打开 `verified=true` |
| ServerQuery 真实联调 | 需验证 | 协议契约测试已通过；与真实 TS3 的最终核对仍待 Docker/实机 |
| install 执行管线 | 已实现 | Linux 真实执行（下载/解压/防火墙/systemd），官方文件名模式需在发布前核对 |
| TS3 server.update 管线 | 501 | CLI 自更新已实现（下载/校验/原子替换/回滚）；TS3 服务端更新仍需已验证官方源（URL+sha256） |
| 服务器配置读写 | capability 已预留 | 尚未开放端点 |
| Bot 私聊验证通道 / away 字段 / 加入链接生成 / 角色同步 | 预留 | `identity.verify.fields` 已支持 client_description / away / nickname；Bot 通道与角色同步后续实现 |
| 多节点 | 已实现 | WP NodeRegistry + 切换器 + 每节点独立凭据与路由隔离 |
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
- 本沙箱无外网：`@yao-pkg/pkg` 无法本地安装，Linux 单文件二进制由
  GitHub Actions（release job）构建并在打包后校验产物；本地
  `npm run release` 需要网络以拉取 pkg 基础二进制。
- glibc 兼容：Release 构建在 `ubuntu-22.04` 上自动探测可用的
  `*-linuxstatic-x64` pkg 目标，并在 `rockylinux:9`（glibc 2.34，与
  CentOS Stream 9 同基线）容器内实机校验二进制（硬门禁，不满足即不发版）；
  目标为 2027 年仍在服务期内的 RHEL9 系系统。

## 6. 下一步建议

1. 在 Linux 主机跑 `doctor` + systemd 冒烟，修复 provider 细节。
2. 对照官方文档验证 WebQuery 端点并补集成测试，打开 `verified=true`。
3. 用 Docker 沙盒（官方镜像验证后）做真实 ServerQuery/WebQuery 联调。
4. 实现 TS3 服务端 update 管线（校验官方源 URL + sha256 + 回滚），
   替换 maintenance update 的 501 占位。
5. 实现 Channels/Server 管理、身份 Bot 通道与加入链接生成。
