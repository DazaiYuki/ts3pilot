# TS3Pilot v0.5.0

本版完善官方 tar 解压、直接运行脚本的现有服务器接管，以及 WordPress 展示和后台管理。

## 变化

- 诊断日志写入 stderr，保持服务命令的 stdout 为可解析 JSON。
- 脚本管理使用正确工作目录，识别官方脚本的运行/停止输出；本地 auto 管理保留现有 systemd unit，否则选择可执行的官方脚本。
- 只读 adopt 保留数据库、许可证和上传文件；服务控制使用同一个非特权服务器账户。
- 修复 Gutenberg 区块注册时机，使真实编辑器和动态渲染可以获取区块。
- WordPress 状态卡继承全局设置，加入原生 ts3server 链接、可配置文字和角色可见性；提供独立 `[ts3_join]`、经典小工具及 Gutenberg 侧栏和预览。
- 后台增加状态指标、服务状态查询和启停/重启操作；凭据输入不回显完整 secret，显示字段可以正确取消勾选。
- 修复服务 API 请求体改写操作的权限边界、无请求体 GET 状态查询，以及活动节点缓存隔离。

## 升级

安装经过 SHA-256 校验的 CLI Release，并上传新版插件 ZIP；保留现有配置、Query 登录和已配对节点。脚本旧服按 [部署指南](deployment.md) 核对目录、账户与 provider。服务重启需显式授予 Agent `server.restart`；WordPress 权限不等同于 TS3 权限。

Linux 发布包内置 Node 运行时。npm registry 与 GitHub Release 分开发布，生产安装使用 Release 附件。大陆或离线安装见 [安装指南](mainland-install.md)。发行版容器兼容测试覆盖 CLI 用户空间，不代表所有发行版的 systemd/SELinux 或官方 TS3 二进制已完整验证。
