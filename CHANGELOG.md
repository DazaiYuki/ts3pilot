# Changelog

All notable changes to TS3 Community Operations Suite are documented here.

## [Unreleased]

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
