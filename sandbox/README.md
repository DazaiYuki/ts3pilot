# 真实 TS3 / WordPress 集成验证

先构建发布包，阅读并接受 TeamSpeak Server 官方许可，再显式运行：

```bash
npm run release
npm run test:integration -- --accept-eula
```

`integration.mjs` 创建独立 Docker 网络，使用官方 `teamspeak:3.13.7`、WordPress、MariaDB 和 Ubuntu 24.04 镜像。Agent 以非 root 身份运行，只监听与 WordPress 共享命名空间的回环地址；不向宿主或公网暴露 Agent 端口。测试验证发布 ZIP 激活、单次配对、生产模式真实 ServerQuery、状态/频道管理、前台脱敏、REST 授权，以及原生 Ubuntu 新建和只读接管。

测试凭据只保存在工作区忽略的私有 `tmp/` 中，不打印到日志。脚本只删除自己创建的容器、卷和网络。成功记录 `dist/release/integration-results.json`，包含实际镜像摘要与验证时间；失败不生成成功报告。

原生新建需要官方 `files.teamspeak-services.com` HTTPS 下载权限；受限云环境应在环境设置中允许该域名。可在 GitHub Actions 手动运行 CI，并对当次测试显式勾选 `accept_ts3_license`。不要把网络拒绝当成联调通过。

真实 WebQuery、语音客户端登录/身份核验、踢人和封禁尚需专门场景验证，不能由 Query 状态/频道测试代替。`docker-compose.ts3.yml` 是独立手动沙盒入口，默认不暴露公网管理端口。
