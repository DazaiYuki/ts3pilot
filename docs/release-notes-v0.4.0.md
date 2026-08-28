# TS3Pilot v0.4.0 — Release Notes

发布日期：2026-08-28

## 修复

- **身份验证指引与 Agent 实际行为对齐**：WP 前台/REST 的绑定说明改为优先把
  一次性验证码填入 TeamSpeak 客户端的「个人描述（Description）」或「离开消息
  （Away Message）」，昵称仅作最后手段。此前文案仍让用户改昵称，会触发昵称
  30 字符截断、防刷屏限制与全服可见的改名广播。
- **前台频道树失败即空**：`get_channels_snapshot` 在 Agent 不可达时返回空数组
  而非带 `error` 键的列表，避免内部错误标志混入公开投影契约。
- **Windows 本机发布修复**：`bundle.mjs` 改经 Node 入口调用 pkg，绕开
  `pkg.cmd` EINVAL；配合 `npm run publish:npm` 可完全跳过本机 pkg。
- **国内安装脚本回退链**：jsdelivr 模式按 npmmirror → ghproxy → GitHub 顺序
  尝试，npm 包未发布或 404 时不再中断。

## 新增

- `npm run publish:npm`：直接复用 GitHub Releases 上的 CI 构建二进制打 npm 包，
  网络受限环境下无需本机 pkg。
- Agent `/v1/health`、`/v1/info` 新增 `cliVersion`，WP 节点连接测试会显示
  CLI 版本。
- `TS3PILOT_VERSION=<ver>` 环境变量可固定安装/更新到指定版本。

## 升级方式

- CLI：`ts3pilot update`（或控制台 [7]）。
- 全新安装：`curl -sSL https://raw.githubusercontent.com/DazaiYuki/ts3pilot/main/scripts/install.sh | sudo bash`
  （国内：`install-cn.sh`）。
- WordPress：WP 后台 → 插件 → 更新（GitHub Releases 检查器）。
- npm：`npm run publish:npm && npm publish dist/release/ts3-manager-npm-v0.4.0.tgz`
