# 开发文档（DEVELOPMENT.md）

## 1. 环境要求

- Node.js >= 22.6（原生 TypeScript type-stripping；Node 22 需
  `NODE_OPTIONS=--experimental-strip-types`，Node 24 默认开启）
- npm >= 10
- PHP >= 8.0（建议 8.3+）与 Composer（WP 插件测试）
- Git
- 可选：Docker（本地 TS3 集成测试沙盒）

## 2. 安装

```powershell
npm install
composer install --working-dir=plugins/ts3pilot-wp
```

npm 缓存默认放在工作区 `.npm-cache`（见 `.npmrc`），避免污染用户目录。

## 3. 常用命令

| 命令 | 说明 |
| --- | --- |
| `npm run verify` | 全量校验（lint + typecheck + test + build + PHP lint + phpcs） |
| `npm run lint` | ESLint（ts3-manager） |
| `npm run typecheck` | tsc strict（含测试） |
| `npm test` | Node 测试 + PHPUnit |
| `npm run build` | tsc 编译到 `apps/ts3-manager/dist` |
| `npm run cli -- <cmd>` | 直接运行 CLI（源码模式） |
| `composer test --working-dir=plugins/ts3pilot-wp` | PHPUnit |
| `composer phpcs --working-dir=plugins/ts3pilot-wp` | PHPCS |

## 4. 测试矩阵

| 层 | 测试 | 运行位置 |
| --- | --- | --- |
| HMAC 协议 | 静态跨语言向量 | Node + PHP 双端 |
| Agent API | 认证/重放/时间窗/篡改/能力/限流/配对/轮换/停用 | Windows（mock） |
| 配置/校验 | schema、默认值、env 覆盖 | Node |
| TS3 转义 | `\s \p \/ \\` 解析 | Node |
| ServerQuery 协议契约 | 握手/命令/通知/登录失败（假 TCP Server） | Node |
| 备份/恢复 | 往返、manifest 校验和、路径逃逸拒绝 | Node |
| ServiceManager | mock 状态机 | Node |
| WP 服务 | 状态投影/脱敏、离线降级 | PHPUnit（WP 桩） |
| WP 安全 | sanitize、capability、身份 Challenge | PHPUnit |
| Linux/systemd | provider 单测 + 契约；需真实 Linux | Linux CI（计划） |
| 真实 TS3 | WebQuery/ServerQuery 联调 | Docker 沙盒（见下） |

## 5. Docker 集成测试沙盒

`sandbox/docker-compose.ts3.yml` 提供本地 TS3 实例入口。**注意**：镜像 tag 与
许可证环境变量必须对照 TeamSpeak 官方 Docker 文档验证后填写，本仓库不假设
"latest" 或某个固定 tag 永远可用。验证流程：

1. 在官方文档确认镜像名/tag 与许可证接受方式。
2. 更新 compose 文件并记录验证结果到 `sandbox/README.md`。
3. `docker compose -f sandbox/docker-compose.ts3.yml up -d`
4. 配置 ServerQuery 凭据或 WebQuery key 后运行 `npm run cli -- doctor`。

## 6. WordPress 插件开发

插件无构建步骤即可运行（Block 为服务端渲染 + 极简编辑器 JS）。若后续需要
完整 React 编辑器 UI，在 `assets/block/` 下建立标准 `@wordpress/scripts`
构建（`block/src/` + `package.json`），并保持 shortcode 可用。

## 7. 离线/受限环境

无网络时：Node 端零运行时依赖可直接 `node src/cli/index.ts`；`npm test`
使用内置 `node:test`。TypeScript/eslint 等 devDependencies 需要一次在线
`npm install`。

## 8. 发布 @ts3pilot/ts3-manager 到 npm

该包是 **Linux x64 单文件二进制** 的分发通道：`bin.ts3pilot` 指向包内
`ts3pilot` 可执行文件（由 `pkg` 编译），服务器 `npm i -g` 后无需安装
Node.js 即可运行；npmmirror 会自动同步 npmjs，`install-cn.sh` 的
npmmirror 下载源随之生效。

前置条件：

1. npm 账号（https://www.npmjs.com）已注册并验证邮箱。
2. 拥有 `@ts3pilot` scope：账号名须为 `ts3pilot`，或在
   https://www.npmjs.com/org/create 创建名为 `ts3pilot` 的免费组织并把你的
   账号加为成员（`npm login` 后若提示无权发布 scoped 包，多半是这步没做）。

发布（二选一）：

```bash
# 方式 A：直接发布（prepack 会自动执行 tsc 编译 + pkg 打包 + 暂存二进制）
cd apps/ts3-manager
npm config set registry https://registry.npmjs.org
npm publish --access public

# 方式 B：发布 CI/本机构建出的 tarball（无需本机重跑 pkg）
npm publish dist/release/ts3-manager-npm-v0.3.0.tgz --access public
```

如果本机 pkg 下载基础二进制失败（国内网络访问 pkg-fetch 的 GitHub 源常被
拦截），改用 `publish:npm`：直接复用 GitHub Releases 上 CI 构建好的二进制
打包，完全绕开本机 pkg：

```bash
npm run publish:npm
# 或使用已下载好的发布包：
npm run publish:npm -- --archive ./ts3pilot-linux-x64-v0.3.0.tar.gz
npm publish dist/release/ts3-manager-npm-v0.3.0.tgz
```

注意事项：

- 发布产物是 Linux x64 单文件二进制，Linux 服务器 `npm i -g` 即可运行；
  其他平台安装后无法执行该二进制（源码运行需 Node ≥ 22.6）。不在包上声明
  `os/cpu` 限制，是为了保证 Windows 开发机与 CI 能正常 `npm install`
  工作区依赖。
- 发布后 npmmirror 数分钟内同步；版本号以 `apps/ts3-manager/package.json`
  与 `scripts/latest.json` 为准，升级版本时两者要同步更新。
