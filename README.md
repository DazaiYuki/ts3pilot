# TS3Pilot — TS3 Community Operations Suite

[English](README.md) | [中文](README.zh-CN.md)

A decoupled, secure TeamSpeak 3 management suite with an independent CLI/Agent
host control plane and optional WordPress integration.

> This project does **not** redistribute TeamSpeak Server binaries. You must
> obtain them from the official vendor and comply with its license terms. The
> project code itself is Apache-2.0 and is fully separate from TeamSpeak
> licensing.

## Architecture (CLI + Agent + WP)

```
┌──────────────────┐      ┌────────────────────────┐      ┌─────────────────┐
│  Browser/Frontend │      │  ts3pilot Agent         │      │   TeamSpeak 3   │
│  (status/shortcode)│      │  (Host Control Plane)  │      │   (Service)     │
└────────┬─────────┘      └───────────┬────────────┘      └────────┬────────┘
         │ HTTP(S)                    │ HMAC-SHA256 /v1            │ TS3 protocol
         ▼                            ▼                            ▼
┌──────────────────┐      ┌────────────────────────┐      ┌─────────────────┐
│  WordPress plugin │ ───▶ │  ts3pilot CLI           │ ───▶ │  Voice/Query/   │
│  (optional Web CP)│      │  (local management)     │      │  FileTransfer   │
└──────────────────┘      └────────────────────────┘      └─────────────────┘
```

- **CLI/Agent (required)**: `apps/ts3-manager`, TypeScript, zero runtime deps.
- **WordPress plugin (optional)**: `plugins/ts3pilot-wp`, paired via HMAC.
- Both sides only expose fixed action enums — **no arbitrary command execution**.

## 5-Minute Quick Start

### Scenario A: new server owner

1. Install the CLI (Linux, one line):

   ```bash
   curl -sSL https://raw.githubusercontent.com/DazaiYuki/ts3pilot/main/scripts/install.sh | sudo bash
   ```

   Can't reach GitHub? Use the jsDelivr mirror:

   ```bash
   curl -sSL https://cdn.jsdelivr.net/gh/DazaiYuki/ts3pilot@main/scripts/install-cn.sh | sudo bash
   ```

2. One-shot TS3 Server install (official download, extraction, EULA marker,
   optional firewall):

   ```bash
   sudo ts3pilot install --accept-eula --install-path /srv/ts3 --setup-firewall
   ```

3. `ts3pilot doctor`, then `ts3pilot api enable` and copy the **pairing code**.
4. `ts3pilot agent` (use systemd in production).
5. Download `ts3pilot-wp-v*.zip` from **GitHub Releases**, upload to WordPress,
   activate and pair.

### Scenario B: adopt an existing server

```bash
ts3pilot config set ts3.installPath /srv/ts3
ts3pilot adopt          # read-only analysis, never modifies files
ts3pilot doctor
ts3pilot api enable && ts3pilot agent
```

### WordPress pairing & frontend

1. **TS3Pilot → Settings**: Agent URL `http://127.0.0.1:17880` (same host) +
   pairing code → **Complete pairing**.
2. Frontend: use the **TS3 Status** Gutenberg block, or classic shortcodes
   `[ts3_status]`, `[ts3_status node="..." show_channels="true"]`,
   `[ts3_identity]`.

Running `ts3pilot` without arguments opens the **interactive bilingual console**
(English / 简体中文).

## CLI Cheatsheet

| Command | Purpose |
| --- | --- |
| `ts3pilot status / start / stop / restart` | Service state & control |
| `ts3pilot doctor` | Deep diagnostics (ports/permissions/SQLite/Query auth) |
| `ts3pilot adopt` | Read-only adopt analysis |
| `ts3pilot install --accept-eula --setup-firewall` | One-shot official install |
| `ts3pilot backup [--dest x.tar.gz]` | Real tar.gz backup + manifest |
| `ts3pilot restore --backup x.tar.gz --dry-run` | Restore preflight (no writes) |
| `ts3pilot restore --backup x.tar.gz --force` | Real restore (destructive) |
| `ts3pilot logs --lines 100` | View logs |
| `ts3pilot api enable / status / disable` | Agent API lifecycle |
| `ts3pilot identity worker once` | Identity verification scan |
| `ts3pilot systemd generate ts3server` | Generate hardened systemd unit |

## WordPress Capabilities

`manage_ts3_view`, `manage_ts3_clients`, `manage_ts3_channels`,
`manage_ts3_server`, `manage_ts3_maintenance`, `manage_ts3_users` — granted to
administrator by default, assignable per role. WordPress permissions and
TeamSpeak permissions are **completely independent**.

## Security Highlights

- Agent API defaults to loopback `127.0.0.1:17880`, never sharing TS3 ports.
- HMAC-SHA256 v1 + timestamp window + nonce replay protection; pairing codes are
  single-use with a 15-minute TTL.
- Per-node credentials are isolated; restore/extract has a path sandbox.

## Docs

- [docs/quickstart-zh.md](docs/quickstart-zh.md) — 中文保姆级上手 + FAQ
- [docs/quickstart-en.md](docs/quickstart-en.md) — English quick start + FAQ
- [docs/architecture.md](docs/architecture.md) — architecture
- [SECURITY.md](SECURITY.md) — threat model
- [docs/development.md](docs/development.md) — development
- [docs/deployment.md](docs/deployment.md) — deployment & systemd
- [docs/api/agent-api-v1.md](docs/api/agent-api-v1.md) — Agent API protocol
- [CHANGELOG.md](CHANGELOG.md) — changelog

## License & Notices

Code: Apache-2.0 ([LICENSE](LICENSE)). Third-party and TeamSpeak license
boundaries: [docs/notice.md](docs/notice.md).

## Authors & Credits

- **Architecture & Maintainer:** dazaiyuki
- **AI-assisted development tool:** OpenAI Codex CLI
