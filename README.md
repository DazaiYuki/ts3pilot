# TS3Pilot — TeamSpeak 3 management

**English** | [中文](README.zh-CN.md)

Create or adopt a TeamSpeak 3 server on Linux. The independent CLI/Agent manages services, channels, clients and backups; the optional WordPress plugin provides an admin control panel, frontend status and identity verification.

## Choose a distribution

| Goal | Distribution | Install Node.js? |
| --- | --- | --- |
| Linux x86_64 production server | Standalone Release binary | **No**, the runtime is bundled |
| WordPress control panel | `ts3pilot-wp-v0.5.0.zip` from Releases | No Node/npm/Composer; WordPress and PHP are required |
| TypeScript development and tests | Repository and npm dependencies | Node 24, or Node 22.6+ with type stripping enabled |
| Install through npm | `@ts3pilot/ts3-manager` | npm is required for installation; the package contains a standalone Linux x86_64 binary |

**Stable Release: [v0.5.0](https://github.com/DazaiYuki/ts3pilot/releases/tag/v0.5.0).** As checked on 2026-10-09, the official npm package is still **0.4.0**. The npm `.tgz` attached to a GitHub Release does not mean that version has been published to the registry. Third-party registries may also lag.

## Install the CLI

For Linux **x86_64 (64-bit x86)**; no Node, npm or PHP is needed on the CLI server. PHP is needed only for WordPress.

```bash
curl -fsSL https://raw.githubusercontent.com/DazaiYuki/ts3pilot/v0.5.0/scripts/install.sh -o install-ts3pilot.sh
sudo env TS3PILOT_VERSION=0.5.0 bash install-ts3pilot.sh
ts3pilot version
```

The installer verifies SHA-256, installs to `/opt/ts3pilot`, and links `/usr/local/bin/ts3pilot`. Failed verification preserves the existing executable; reinstalling preserves user configuration.

For restricted or mainland China networks, see the [mainland installation and offline transfer guide](docs/mainland-install.md). jsDelivr serves repository files, not GitHub Release binaries. A successful script download does not establish that its binary downloads will work.

## New installation or adoption

Follow the [production deployment guide](docs/deployment.md) to create the service account and `/var/lib/ts3pilot/config.json`, then select `mode=production`. The default development mode uses mocks.

| Deployment | Next step |
| --- | --- |
| New server | Obtain a trusted official TS3 archive digest, explicitly accept its license, run `ts3pilot install`, and configure ownership, Query credentials and service management |
| Existing server | Configure `ts3.installPath`, run read-only `ts3pilot adopt`, and retain the existing account and startup parameters; avoid overwriting it with `install --force` |
| Remote or Docker | Configure Query host and deployment type; filesystem operations require genuinely accessible local data |

Use the same explicit configuration throughout. Edit Query credentials with a protected editor rather than putting passwords in shell history.

```bash
sudo -u ts3 ts3pilot doctor --config /var/lib/ts3pilot/config.json
sudo -u ts3 ts3pilot api enable --config /var/lib/ts3pilot/config.json
```

Copy the single-use pairing code, then start the Agent through systemd as documented. The default listener is `127.0.0.1:17880`; service control requires the documented system authorization. Running `ts3pilot` without arguments opens the bilingual interactive console.

## WordPress control panel

1. Upload the Release plugin ZIP through WordPress's plugin installer and activate it. The repository source ZIP is not an installable plugin.
2. In **TS3Pilot → Settings**, enter the Agent URL and pairing code. Codes expire after 15 minutes and can be used once.
3. Confirm CLI 0.5.0, production mode and a real Query provider, then check status, clients and channel management.
4. Configure display fields, join URL, label and visibility in Settings. Use the **TS3 Status** block with editor controls, the **TS3 Status & Join** classic widget, or `[ts3_status show_channels="true"]`. A standalone button uses `[ts3_join]`; identity verification uses `[ts3_identity]`.

Native same-host deployments can use loopback; separate containers have separate loopback networks. Cross-host connections require the documented HTTPS and source restrictions. Paired local management does not depend on GitHub/npm being reachable; online installation and automatic updates do. A verified plugin ZIP can also be uploaded manually.

## Common commands

| Command | Purpose |
| --- | --- |
| `ts3pilot status / start / stop / restart` | Service state and control |
| `ts3pilot doctor` | Paths, permissions, Query login and Agent diagnostics |
| `ts3pilot adopt` | Read-only adoption analysis |
| `ts3pilot backup --dest backup.tar.gz` | Backup; stop your TS3 service before a production backup |
| `ts3pilot restore --backup backup.tar.gz --dry-run` | Restore preflight; stop the service and retain a separate backup before actual restore |
| `ts3pilot update check / self` | Check/update the CLI, not the third-party TS3 Server |
| `ts3pilot logs --lines 100` | Logs |

Append `--config /var/lib/ts3pilot/config.json`. WordPress role permissions and TeamSpeak permissions are independent. The Agent exposes fixed actions, not an arbitrary shell command endpoint.

## Validation

v0.5.0 passes 129 Node and 63 PHP tests, real official TS3 installation and independent manual tar/script adoption and service control on Ubuntu 24.04, and real WordPress integration. Unprivileged CLI/Agent checks pass on 17 maintained Linux images across Ubuntu, Debian, Rocky Linux, Fedora, openSUSE, Alpine and Arch. Container checks cover user space, not every distribution's systemd/SELinux configuration or third-party TS3 binary.

## Documentation and development

- [Production deployment](docs/deployment.md)
- [Mainland network installation and upgrades (中文)](docs/mainland-install.md)
- [Quick start and FAQ](docs/quickstart-en.md)
- [Development, tests and release](docs/development.md)
- [Architecture](docs/architecture.md) · [Agent API](docs/api/agent-api-v1.md) · [Security](SECURITY.md)
- [Changelog](CHANGELOG.md) · [v0.5.0 notes](docs/release-notes-v0.5.0.md)

Use `npm ci` for source development. Production standalone installs do not require a source build.

## License and maintenance

Project code is [Apache-2.0](LICENSE). TeamSpeak Server is not bundled or redistributed and remains subject to its official license. See [third-party notices](docs/notice.md). This project is not affiliated with or endorsed by TeamSpeak Systems GmbH.

Maintainer: dazaiyuki. AI-assisted development tool: OpenAI Codex CLI.
