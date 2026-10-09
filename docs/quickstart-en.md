# Quick start and FAQ

Production uses the standalone Linux x86_64 binary: Node/npm are not required. The stable Release is [v0.4.1](https://github.com/DazaiYuki/ts3pilot/releases/tag/v0.4.1); npm's published package remains 0.4.0 as checked on 2026-10-09.

## Production sequence

1. [Install the CLI](../README.md#install-the-cli); for restricted networks see the [mainland/offline guide](mainland-install.md).
2. Follow [production deployment](deployment.md) to create the service account and explicit configuration, then select production mode.
3. **New server**: confirm the official TS3 archive digest, explicitly accept its license, install and configure ownership and systemd. **Existing server**: configure its directory, run read-only `adopt`, and retain the existing service and data.
4. Edit real Query credentials with a protected editor and run `doctor` using the same `--config`.
5. Enable the API for a single-use pairing code and manage the Agent through the documented service unit.
6. Upload the formal WordPress plugin ZIP, activate it, pair in Settings and confirm real server status and channel management.

## Why did install succeed without installing TS3?

New configurations default to development mode, which uses mock installation. Select production explicitly and use the same configuration for every command. Agent health alone does not prove successful Query authentication.

## Pairing fails

Check code expiry (15 minutes), prior use, clock synchronization, URL and HTTPS. Native same-host deployments can use loopback; separate Docker containers usually cannot share `127.0.0.1`. Cross-host deployment requires the documented HTTPS and source restrictions.

## Status works but service control fails

Query operations and operating-system service control have different permissions. Check the provider, unit name and dedicated account's Polkit rule as documented. Do not run the Agent as root or grant unrestricted sudo.

## Frontend widgets

Use the TS3 Status block or `[ts3_status]` and `[ts3_status node="node-id" show_channels="true"]`. Identity verification uses `[ts3_identity]`. WordPress and TeamSpeak permissions are configured independently.

## Backups and upgrades

Stop your TS3 service before a production backup; inspect and trial-restore it. Keep a separate backup before an actual restore. CLI self-update does not update the third-party TS3 Server. If GitHub API access is unavailable, use the verified offline installer and upload a verified WordPress ZIP manually.

## Source development

Use Node 24, or Node 22.6+ with type stripping enabled. PHP/Composer are needed for plugin development tests, not for installing the formal plugin ZIP.

```bash
git clone https://github.com/DazaiYuki/ts3pilot.git
cd ts3pilot
npm ci
npm run cli -- help
```

See [development instructions](development.md) for tests and packaging. Source commands do not replace the production account, configuration and service setup.
