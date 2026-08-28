# Changelog

All notable changes to TS3 Community Operations Suite are documented here.

## [0.3.0] - 2026-08-28

### Added

- TUI language menu is now fully bilingual no matter which language is active
  (`[1] English (英文)` / `[2] 简体中文 (中文)` + bilingual prompt), so users who
  switch by accident can always switch back. Language switches show a
  confirmation in both languages.
- Self-update hardening (`ts3pilot update`): downloaded archives are verified
  as gzip before extraction; binary replacement is atomic with automatic
  rollback (the old binary is kept until the new one passes a `version` smoke
  test); downloads fall back across two mirrors then direct GitHub, and
  `TS3PILOT_GH_MIRROR` can override the mirror list.
- Deployment profile detection: the CLI now recognises `native`, `docker` and
  `remote` TS3 deployments (`ts3.deployment.kind` / auto-detection) and exposes
  a capability matrix (serverQuery / filesystem / install). Docker and remote
  nodes get explicit guidance in `adopt` and `doctor` instead of false alarms.
- Remote ServerQuery support: new `ts3.query.host` config (default
  `127.0.0.1`); ServerQuery client, doctor and adopt now honour it.
- WordPress: per-node "Test connection" action (authenticated `/v1/info`
  probe, nonce + `manage_options`), view-only Audit Log page (bounded ring
  buffer, escaping everywhere), and fixed the plugin version constant that was
  stuck at 0.1.0.
- WordPress updates: `GitHubUpdater` feeds the standard WordPress update
  transients from the project's GitHub Releases page, so the plugin can be
  updated from the WP admin dashboard without being listed on wordpress.org
  (adds `Update URI:` header; package URL restricted to HTTPS GitHub assets;
  release metadata cached 6 h).
- Agent `/v1/info` now reports the detected deployment profile
  (`native`/`docker`/`remote`/`unknown` + capability flags), so the WP node
  test shows how the TS3 instance is deployed.

### Changed

- `apps/ts3-manager/src/cli/index.ts` now awaits async commands (`install`,
  `update`) so errors surface through the normal error path.
- npm distribution: `@ts3pilot/ts3-manager` is now publishable as a Linux x64
  standalone binary package (`bin.ts3pilot` → the pkg-built binary, `os`/
  `cpu` restricted to linux/x64, `prepack` builds and stages it). `npm run
  release` also produces a `ts3-manager-npm-v<version>.tgz` artifact that can
  be published with `npm publish <tgz> --access public`; once published,
  npmmirror auto-syncs and the `install-cn.sh` fast path works for real.

### Fixed

- `scripts/install.sh` (and therefore `install-cn.sh`): the China mirror path
  no longer aborts when the `@ts3pilot/ts3-manager` npm tarball is not yet
  published (404). The installer now builds the GitHub asset URL from
  `latest.json` and downloads from the first working source in this order:
  npmmirror npm tarball → gh-proxy.com → mirror.ghproxy.com → direct GitHub.

## [0.2.0] - 2026-08-27

### Changed

- Global rebrand from `ts3cops` to **TS3Pilot**: npm scope `@ts3pilot/*`,
  WordPress plugin `ts3pilot-wp`, option/transient prefix `ts3pilot_*` (with
  legacy `ts3cops_*` read fallback), REST namespace `ts3pilot/v1`, HMAC protocol
  `TS3PILOT-HMAC-SHA256 v1`.
- Root documentation consolidated into `docs/` (architecture/deployment/
  development/status/notice + bilingual quick starts).
- CI: Node engines relaxed to >= 22.6, PHPUnit 10.5+ added for PHP 8.1,
  `engine-strict` removed.
- Installer: one-shot `ts3pilot install` engine (official download, EULA gate,
  tar extraction, optional UFW/Firewalld, systemd generation) and a one-line
  Linux installer (`scripts/install.sh`).
- Releases: CI creates a GitHub Release with assets when a `v*` tag is pushed.
- CI hardening: `scripts/install.sh` passes shellcheck (preinstalled on the
  runner); Windows verify split into granular steps for faster diagnosis.
- Line endings: added `.gitattributes` (`eol=lf`) so PHPCS/shellcheck stay
  green on Windows checkouts (CRLF was breaking WordPress line-ending rules).
- Interactive TUI: running `ts3pilot` without arguments opens a bilingual
  (English / 简体中文) numbered console; first run asks for language and
  persists it (`config.language`).
- Distribution: `scripts/install-cn.sh` + `scripts/latest.json` provide a
  jsDelivr/npmmirror path for users who cannot reach GitHub.
- Docs: README split into default-English `README.md` and `README.zh-CN.md`
  with top language switcher.
- Distribution: CLI now ships as a Linux-only standalone binary built with
  `pkg` (`ts3pilot-linux-x64-v*.tar.gz` containing the single `ts3pilot`
  executable + `config.example.json`); production servers need no Node.js and
  the installer never touches system packages.
- Compatibility: release builds now run on `ubuntu-22.04` and target
  a self-probing static pkg target (`node18/20/22-linuxstatic-x64`); the CI
  `release` job runs the binary inside a `rockylinux:9` container (glibc 2.34,
  same baseline as CentOS Stream 9) as a hard gate, so a build that still
  requires newer glibc cannot be published. Fixes `GLIBC_2.38` /
  `GLIBCXX_3.4.30` errors on RHEL9 / CentOS Stream 9.
- Self-update: `ts3pilot update [check|self]` checks the GitHub latest release,
  supports the ghproxy mirror (`--mirror` default / `--no-mirror`), downloads
  to /tmp, and replaces the running binary atomically (rm then move, avoiding
  "Text file busy"); wired into the interactive TUI as menu item 7.
- Adopt: `ts3server_linux_amd64` removed from detection; `ts3server.ini`,
  `licensekey.dat`, `.ts3server.license` are now optional (no false warnings).
- TUI: de-styled to `=== TS3Pilot 控制台 ===` with pure-Chinese `zh` menu;
  added menu item 8 (autostart/systemd generation) and item 9 (switch language
  with persistence).

## [0.1.0] - 2026-08-26

### Added

- **Monorepo structure**: `apps/ts3-manager` (TypeScript CLI + Agent, zero
  runtime dependencies) and `plugins/ts3pilot-wp` (WordPress plugin).
- **CLI / Agent**
  - Commands: config, service start/stop/restart/status, api lifecycle
    (enable/disable/status/pair/rotate-secret/unpair), agent, doctor, adopt,
    logs, backup, restore, install plan, update source validation, identity,
    systemd generator.
  - Agent `/v1` API: health/info/status/clients/channels (CRUD)/kick/ban/move/
    poke/system control/maintenance backup+restore/pairing/identity challenge.
  - HMAC-SHA256 v1 auth (canonical string, timestamp window, nonce replay
    protection, constant-time compare), capability model with high-risk
    capabilities opt-in, rate limiting, body limits, no CORS.
  - ServerQuery protocol layer (whitelisted command builder, escaped response
    parser, notifications, long-lived TCP connection) with fake-TCP contract
    tests; WebQuery adapter gated behind explicit verification.
  - Real backup engine (ustar + gzip, manifest with sha256, path-traversal
    sandbox, dry-run preflight, streaming large files) and hardened systemd
    unit generator (agent unit intentionally omits MemoryDenyWriteExecute for
    the V8 JIT).
  - Doctor deep diagnostics (ports, permissions, SQLite header, Query auth)
    and read-only adopt wizard.
- **WordPress plugin**
  - Capabilities (manage_ts3_view/clients/channels/server/maintenance/users),
    HMAC agent client via WP HTTP API, pairing wizard.
  - Admin: Dashboard, live Clients (kick/poke/move), Channels tree management,
    Users/Identity (challenge codes + status transitions), Maintenance,
    Settings (incl. node registry), Diagnostics (audit log).
  - Front-end: `[ts3_status]` shortcode + dynamic Gutenberg block with
    adaptive theming, collapsible channel tree, join policies; `[ts3_identity]`
    self-service binding; all data via server-side transient cache.
  - Automated identity verification: agent worker matches one-time codes in
    client description/away/nickname (priority order), signed webhook marks the
    mapping verified.
  - Multi-node registry with per-node credentials, node switcher, per-node
    routing and credential-isolation tests; legacy settings auto-migrate.
- **Engineering**
  - `npm run verify` (ESLint, tsc strict, Node tests, PHPUnit, PHPCS, PHP lint,
    build) and `npm run release` (CLI tar.gz + WP plugin zip).
  - GitHub Actions CI: Node 22/24 × PHP 8.1/8.2/8.3, Node 20 static checks,
    Windows verify, release artifact validation.
  - Cross-language HMAC test vector shared between Node and PHP.

### Security

- Credentials stored per node and never logged/printed in full; pairing codes
  are single-use with short TTL; callback signatures verified with clock skew
  and node identity checks; path traversal and symlink entries rejected during
  restore; no arbitrary command execution surfaces anywhere.

### Notes

- TeamSpeak Server binaries are not redistributed; users must obtain and
  license them from the official vendor. WebQuery endpoint mappings remain
  unverified against a live server (config-gated).
