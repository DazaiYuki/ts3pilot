# TS3Pilot v0.4.1

本版本修复了生产安装、真实 ServerQuery 和 WordPress 启动路径中未被原有单元测试覆盖的问题。

## 主要修复

- WordPress 发布包现在是有效 ZIP；插件包含自己的类加载器，不再依赖 PHPUnit 的测试加载器。
- WordPress 的 GET 请求签名与实际空请求体一致，避免 Requests 传输层报错和 HMAC 不匹配；配对失败保留原活动节点。
- ServerQuery 正确消费官方双行欢迎横幅、登录及选服响应；并发调用共享握手并按顺序发送。控制字符完整转义，防止换行注入；已解码字段不重复解码。CLI 退出时关闭连接。
- 自更新创建安全的临时工作区，校验 GitHub 官方资产摘要与目标二进制版本，再通过目标文件系统上的原子重命名替换。下载、校验或启动失败保留旧程序。`TS3PILOT_VERSION` 支持固定目标版本；未知更新动作直接拒绝。
- Shell 安装器校验官方 SHA-256、拒绝不受支持的 CPU 和异常档案，支持运行中重装，并保留用户目录。
- 配置文件权限为 0600；自定义配置使用邻近数据目录，root 更新已有配置时保留原所有者。
- Agent systemd unit 使用正确的独立程序路径，允许配置目录原子写入和 AF_UNIX IPC；限制用户、路径与换行注入。服务状态使用 systemd 属性，不依赖本地化文本。
- TS3 安装器默认只开放玩家端口，并在实际安装后保存安装路径；下载按实际流量限制大小。
- 备份修复新目录、长路径、零字节文件、权限和 gzip 完整性处理；拒绝重复/畸形清单以及符号链接恢复越界。
- 独立二进制只使用仍受支持的 Node 24/22 静态目标；所有发布资产附带 SHA-256 文件。

## 验证与兼容性

`npm run verify` 覆盖 Node/PHP 单元测试、类型检查、构建、PHP 语法、独立插件启动和 PHPCS。
`npm run release && npm run verify:release` 检查真实档案、升级成功、摘要/版本错误保护，以及离线 Ubuntu 中的首次安装、运行中重装和用户配置保留。

`npm run test:compat` 以非特权用户检查仍受支持的主要 Linux x86_64 发行版用户空间：Ubuntu、Debian、Rocky Linux、Fedora、openSUSE、Alpine 和 Arch。结果记录在 `dist/release/compatibility-results.json`。容器共享宿主内核；这些结果不是各发行版完整 VM 的 systemd、SELinux 或 TS3 原生二进制认证。

真实联调必须先阅读并接受 TeamSpeak Server 许可，再运行：

```bash
npm run test:integration -- --accept-eula
```

该测试从发布 ZIP 激活 WordPress，连接已有官方 TS3 容器，再在 Ubuntu 24.04 新建官方 TS3 实例，验证两者的配对、状态和频道管理，以及接管只读性。结果记录在 `dist/release/integration-results.json`。没有语音客户端参与；身份核验、踢人/封禁和真实 WebQuery 仍需要相应客户端或单独测试。

## 安装与升级

发布后使用固定版本的安装脚本：

```bash
curl -fsSL https://raw.githubusercontent.com/DazaiYuki/ts3pilot/v0.4.1/scripts/install.sh -o install-ts3pilot.sh
sudo env TS3PILOT_VERSION=0.4.1 bash install-ts3pilot.sh
```

现有独立 CLI 可以运行 `ts3pilot update check`，再运行 `ts3pilot update self`。升级过程中 Agent 继续运行旧进程；确认后重启自己的 Agent 服务。

WordPress 上传 `ts3pilot-wp-v0.4.1.zip`。新建和接管步骤见 [部署文档](deployment.md)。安装器不会代替用户接受 TS3 许可，也不会为既有配置自动切换运行模式。
