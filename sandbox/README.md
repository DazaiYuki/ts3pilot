# TS3 集成测试沙盒

## 已验证版本记录

本仓库**尚未**在真实 TS3 实例上完成 WebQuery/ServerQuery 联调验证，因此：

- `docker-compose.ts3.yml` 中的镜像名/tag 与环境变量是占位符（TODO），
  必须对照官方文档验证后使用；
- WebQuery 客户端默认拒绝执行（`ts3.query.webQuery.verified=false`）；
- ServerQuery 客户端已实现转义/解析与命令映射，但同样需要真实实例联调验证。

## 验证步骤（验证后请更新此文件与 compose）

1. 确认官方镜像与许可证接受方式，更新 compose。
2. `docker compose -f sandbox/docker-compose.ts3.yml up -d`
3. 用 ServerQuery/WebQuery 获取初始 serveradmin 凭据（按官方文档）。
4. 创建低权限登录（不要使用 master serveradmin 作为长期凭据）。
5. 配置 `ts3.query.username/password`（或 WebQuery key + `verified=true`）。
6. `npm run cli -- doctor` 确认端口与 Agent 状态。
7. 运行 `npm test` 中的集成测试并记录结果。

## 记录模板

| 日期 | 镜像 tag | TS3 版本 | WebQuery 验证 | ServerQuery 验证 | 备注 |
| --- | --- | --- | --- | --- | --- |
| — | 未验证 | — | 否 | 否 | 待官方文档核对 |
