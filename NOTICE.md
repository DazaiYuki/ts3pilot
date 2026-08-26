# NOTICE（第三方声明与许可边界）

## 1. TeamSpeak 3

TeamSpeak 3 Server 是第三方软件，其许可条款由 TeamSpeak Systems GmbH 定义
（包括个人/非商业授权与商业授权的区别）。本项目：

- **不重新分发** TeamSpeak Server 二进制或官方安装包；
- **不自动下载** 未经确认的官方来源；
- 用户必须自行从 TeamSpeak 官方渠道获取，并遵守官方许可条款；
- 本项目代码许可（Apache-2.0）与 TeamSpeak 软件许可**严格分离**；
- 是否允许将 TS3 集成进第三方产品、是否可商业发布，以 TeamSpeak 官方
  当前条款为准，本项目不代为声明。

## 2. 运行时依赖

- `@ts3cops/ts3-manager` 运行时零第三方依赖（仅 Node.js 内置模块）。
- WordPress 插件运行时仅依赖 WordPress 核心 API。

## 3. 开发期依赖

TypeScript、ESLint、typescript-eslint、@types/node、PHPUnit、
PHP_CodeSniffer、WordPress Coding Standards 等仅用于开发/测试，不随发布物分发。

## 4. 商标

"TeamSpeak" 与相关商标归其权利人所有；本项目为独立工具，与 TeamSpeak
Systems GmbH 无隶属或背书关系。
