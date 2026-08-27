# TS3 Community Operations Suite — Quick Start (English)

This guide is for first-time users: installing from scratch, adopting an
existing server, pairing WordPress, deploying front-end widgets, and
troubleshooting.

## 0. Prerequisites

| Item | Requirement | Notes |
| --- | --- | --- |
| Server / PC | Windows or Linux for development; Linux recommended in production | Windows uses a mock provider automatically |
| Node.js | >= 22.6 (24 recommended) | Runs the CLI/Agent |
| TeamSpeak 3 Server | Obtain from the official vendor | This project does not redistribute it |
| WordPress | 6.0+, PHP 8.1+ (optional) | Only needed for the web panel |

## 1. Pick your scenario

- **Scenario A (new)**: no TS3 server yet — start from zero.
- **Scenario B (adopt)**: you already run a TS3 server.

Both end at the same step: **enable the Agent API → get a pairing code →
pair WordPress**.

## 2. Scenario A: install TS3 from scratch

1. Download the official TS3 Server package for your platform.
2. Extract it into a dedicated directory, e.g. `/srv/ts3`:

   ```bash
   mkdir -p /srv/ts3
   tar -xzf teamspeak3-server_linux_amd64-*.tar.gz -C /srv/ts3 --strip-components=1
   cd /srv/ts3
   ```

3. Accept the license as documented by the official instructions. First start
   generates `ts3server.sqlitedb`, `ts3server.ini`, and prints the serveradmin
   password to the log.
4. Verify `./ts3server_startscript.sh start` works.

> You can also use one-shot install: `npm run cli -- install --accept-eula
> --version 3.13.7 --install-path /srv/ts3 --setup-firewall` (on Linux this
> downloads the official archive, extracts with `tar -xjf`, writes
> `.ts3server_license_accepted`, optionally configures UFW/Firewalld and
> generates a systemd unit; Windows/development falls back to a mock flow).
> Read the official TeamSpeak EULA and add `--accept-eula` only if you agree.

## 3. Install and configure ts3-manager

### Option 1: from source (development / self-hosted)

```bash
git clone https://github.com/DazaiYuki/ts3pilot.git
cd ts3pilot
npm install
npm run cli -- config init
```

### Option 2: one-line install (Linux production, recommended)

One-line installer (detects architecture, fetches the latest
`ts3pilot-linux-x64-v*.tar.gz` — a **standalone binary, no Node.js required on
the server** — extracts to `/opt/ts3pilot` and symlinks
`/usr/local/bin/ts3pilot`):

```bash
curl -sSL https://raw.githubusercontent.com/DazaiYuki/ts3pilot/main/scripts/install.sh | sudo bash
ts3pilot config init
```

Can't reach GitHub? Use the jsDelivr mirror:

```bash
curl -sSL https://cdn.jsdelivr.net/gh/DazaiYuki/ts3pilot@main/scripts/install-cn.sh | sudo bash
```

(The mirror uses the npmmirror npm tarball once `@ts3pilot/ts3-manager` is
published to npm; until then it falls back to the GitHub asset.)

### Point it at your TS3 installation

```bash
npm run cli -- config set ts3.installPath /srv/ts3
npm run cli -- doctor
```

`doctor` checks directory permissions, `ts3server.sqlitedb` readability, key
ports and ServerQuery reachability. Fix any `FAIL` before continuing.

## 4. Scenario B: adopt an existing server

```bash
npm run cli -- config set ts3.installPath /srv/ts3
npm run cli -- adopt
```

`adopt` is **read-only**. It reports:

- Detected files (sqlitedb, ini, files, ...).
- Relevant `ts3server.ini` keys (e.g. `query_ip_whitelist`).
- Minimal-change recommendations:
  1. Set `query_ip_whitelist` to `127.0.0.1` (or `127.0.0.1,<lan>`) and
     restart TS3.
  2. Create a **restricted ServerQuery login** (never use the master
     serveradmin long-term) and store it:

     ```bash
     npm run cli -- config set ts3.query.username <username>
     npm run cli -- config set ts3.query.password <password>
     ```
  3. Back up first: `npm run cli -- backup`.

## 5. Enable the Agent API and start it

```bash
npm run cli -- api enable --port 17880
```

Copy the one-time **pairing code** (valid 15 minutes), then run:

```bash
npm run cli -- agent
```

For production, consider systemd:

```bash
npm run cli -- systemd generate ts3-agent --user ts3agent --exec-start "<node> /opt/ts3pilot/dist/cli/index.js agent" --config /etc/ts3pilot/config.json --out /etc/systemd/system/ts3-agent.service
```

Check state anytime with `npm run cli -- api status` (never prints full
credentials).

## 6. WordPress installation and pairing

1. Download `ts3pilot-wp-v*.zip` from **GitHub Releases**
   (https://github.com/DazaiYuki/ts3pilot/releases), then in the WordPress
   admin go to **Plugins → Add New → Upload Plugin**, select the zip, install
   and **activate**.
2. Open **TS3Pilot → Settings**:
   - Agent URL: default `http://127.0.0.1:17880` (same host).
   - Pairing code: paste the code from step 5.
   - Click **Complete pairing**.
3. On success the node appears in **Node Registry**; the top Node Switcher
   switches between nodes.

> Remote agents are an advanced deployment: use explicit `--remote` +
> production mode + HTTPS/reverse proxy. Never expose the Agent to the public
> internet directly.

## 7. Front-end widgets

### Gutenberg block

Search for **TS3 Status** in the editor, insert it, and configure display
fields, theme and node from the sidebar.

### Classic shortcodes (always available, no build step)

```html
[ts3_status]                                     <!-- default active node -->
[ts3_status node="<node-id>" show_channels="true" theme="auto"]
[ts3_identity]                                   <!-- self-service identity binding -->
```

Common `[ts3_status]` attributes:

| Attribute | Values | Default |
| --- | --- | --- |
| `node` | node ID (invalid falls back to active) | empty = active |
| `show_name` / `show_online` / `show_max` / `show_version` | `true`/`false` | first three true |
| `show_channels` | `true`/`false` | follows settings |
| `collapsible` | `true`/`false` | false |
| `theme` | `auto`/`light`/`dark` | follows settings |
| `join_policy` | `hidden`/`public`/`logged_in`/`verified_ts_user`/`role` | hidden |
| `join_role` | role name (when join_policy=role) | empty |

## 8. Command cheatsheet

```bash
ts3-manager status | start | stop | restart
ts3-manager doctor
ts3-manager adopt
ts3-manager backup --dest /srv/backups/ts3-$(date +%F).tar.gz
ts3-manager restore --backup /srv/backups/ts3-xxx.tar.gz --dry-run
ts3-manager restore --backup /srv/backups/ts3-xxx.tar.gz --force
ts3-manager logs --lines 100
ts3-manager update          # check and self-update the CLI binary (no reinstall needed)
ts3-manager update check    # only check for a newer version
ts3-manager api status
ts3-manager identity worker once
```

## 9. FAQ

### Q0: How do I upgrade ts3pilot itself?

- Run `ts3pilot update` (or console menu [7]). It fetches the latest release
  from GitHub, verifies the gzip archive, atomically replaces the binary and
  runs a smoke test, rolling back automatically on failure. A mirror fallback
  chain is used automatically in regions where GitHub is slow.
- Just want to know if a newer version exists? `ts3pilot update check`.
- The WordPress plugin checks GitHub Releases too: open WP Admin → Plugins and
  the standard "update available" notice will appear (no wordpress.org listing
  required).

### Q1: `doctor` reports ports 9987/10011 as closed

- Confirm TS3 is actually running: `./ts3server_startscript.sh status`.
- Check firewall rules: voice 9987/udp, file transfer 30033/tcp, query
  10011/tcp (keep management ports internal).
- The Agent only connects to `127.0.0.1`; these ports do **not** need to be
  public.

### Q2: Pairing fails

- The pairing code expires after 15 minutes: run `ts3-manager api enable` again.
- The Agent is not running: start it, then check
  `curl http://127.0.0.1:17880/v1/health`.
- Wrong URL: same-host default is `http://127.0.0.1:17880` (no `/v1` suffix).
- Clock skew: keep the Agent host and WordPress host within ~5 minutes.

### Q3: The status card shows "temporarily unavailable"

- The Agent is down or `api disable` was run.
- The node credential changed (`rotate-secret`) without updating WordPress:
  fix it in Settings → Node Registry or re-pair.
- Status is cached (default 10s): wait or refresh.

### Q4: `[ts3_identity]` binding never completes

- Verification scans `client_description → client_away_message → nickname`.
  Put the code in the **client description** to avoid the 30-character nickname
  limit and flood protection.
- Codes are single-use and expire after 10 minutes; start a new challenge if
  needed.
- The identity worker must be enabled (`identity.verify.enabled=true`) to poll.

### Q5: `systemctl` errors on Windows

Expected: Windows falls back to the Mock ServiceManager (simulated only).

### Q6: Backup / restore

- Restore is destructive: always run `--dry-run` first (manifest/hash/permission
  preflight, no writes), then `--force`.
- In development mode `--force` also requires
  `TS3_MANAGER_ALLOW_DESTRUCTIVE=1`.

### Q7: Security notes

- Never bind the Agent to `0.0.0.0`; remote mode requires explicit `--remote`
  plus TLS/reverse proxy.
- Never store the TS3 master serveradmin password as a long-term plugin
  credential.
- Logs and diagnostics never show full credentials.

## 10. Further reading

- [architecture.md](architecture.md) — architecture
- [../SECURITY.md](../SECURITY.md) — threat model
- [deployment.md](deployment.md) — production deployment
- [api/agent-api-v1.md](api/agent-api-v1.md) — Agent API protocol
- [../CHANGELOG.md](../CHANGELOG.md) — changelog
