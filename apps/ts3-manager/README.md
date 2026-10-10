# @ts3pilot/ts3-manager

Local-first TeamSpeak 3 management CLI and controlled Host Control Plane agent.

The npm package contains a standalone **Linux x86_64 binary** with its own Node runtime. npm is needed to install this package; the executable does not require a separately installed Node.js. TypeScript source development does require Node 22.6+ (type stripping enabled) or Node 24.

As checked on 2026-10-10, npm's latest published version is 0.4.0, while the current GitHub Release is 0.5.0. A release's npm tarball attachment is not automatically published to the npm registry. Use the [official Release](https://github.com/DazaiYuki/ts3pilot/releases/tag/v0.5.0) for the current production binary or WordPress plugin.

See the [project README](https://github.com/DazaiYuki/ts3pilot#readme) and [production deployment](https://github.com/DazaiYuki/ts3pilot/blob/main/docs/deployment.md).

## License & trademark notice

- This package is **not affiliated with or endorsed by TeamSpeak Systems GmbH**.
  "TeamSpeak" and related marks belong to their respective owners.
- This package does **not** redistribute or bundle the TeamSpeak 3 Server
  binary. Users obtain and license the server themselves from TeamSpeak's
  official channels and remain responsible for complying with TeamSpeak's
  license terms.
- This package's code is licensed under Apache-2.0, which is separate from any
  TeamSpeak software license.
- The distributed `ts3pilot` binary targets **Linux x64**; on other platforms,
  run from source (Node.js >= 22.6) instead.
