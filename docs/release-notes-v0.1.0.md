# TS3 Community Operations Suite v0.1.0 — Release Notes

## 版本定位

第一个可独立使用的 MVP：本地 CLI/Agent 与 WordPress 插件解耦，覆盖 TS3
服务器管理、自动化身份绑定、备份恢复与基础安全加固。

## 交付物

- `dist/release/ts3-manager-v0.1.0.tar.gz` — CLI/Agent 独立发布包
  （编译产物 + `config.example.json` + 文档；运行时零第三方依赖）
- `dist/release/ts3pilot-wp-v0.1.0.zip` — WordPress 插件
  （标准插件目录结构，不含 tests/vendor/开发配置）

## 快速开始

```bash
# CLI（Windows 开发 / Linux 生产均可）
npm run cli -- config init
npm run cli -- doctor
npm run cli -- api enable && npm run cli -- agent

# WordPress
# 上传 zip 到 wp-content/plugins/ 并激活，Settings → 配对向导输入配对码。
```

## 验证矩阵

- Node 24（开发/生产基准）+ Node 22（CI，带 type-stripping 标志）
- PHP 8.1 / 8.2 / 8.3（PHPUnit 11/12 自动选择）
- Windows 与 Linux CI 均全绿

## 已知限制（诚实清单）

- TS3 Server 二进制不随项目分发；官方许可条款由用户自行遵守。
- WebQuery 端点映射未在真实服务器上验证（配置门控 `verified=false`）。
- 身份核验挑战存储为 Agent 进程内内存，重启后未消费挑战丢失。
- `server.update` 执行管线仍为 501（需已验证官方源 + checksum + 回滚）。
- Gutenberg 区块为服务端渲染动态块，完整 React 编辑器 UI 尚未实现。

## 下一步候选

1. 真实 TS3/Docker 沙盒联调，消除协议层"待验证"标记。
2. 挑战持久化 + Bot 私聊验证通道。
3. Gutenberg React 编辑器块与多节点健康监控轮询。
