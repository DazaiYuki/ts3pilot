# TS3Pilot v0.5.0

This release improves adoption of existing TeamSpeak servers extracted from the official tar archive and started with the official script, and expands the WordPress frontend and administration controls.

## Changes

- Send diagnostic logs to stderr so service commands keep stdout as valid JSON.
- Run the official server script from its installation directory and correctly detect running and stopped states. Automatic provider selection preserves existing configured systemd units and selects the script provider for local standalone installations.
- Keep adoption read-only, preserving the existing database, license and uploaded files. Run service control under the same unprivileged account as the server.
- Fix Gutenberg block registration timing so the editor and dynamic renderer can access the block.
- Add native `ts3server://` join links, configurable labels and visibility policies, actual WordPress role checks, the standalone `[ts3_join]` shortcode, a classic widget, and Gutenberg inspector controls with preview. Status shortcodes inherit global display settings.
- Add dashboard metrics, service status, and start/stop/restart forms. Credential fields no longer display the full secret, and display options can be unchecked correctly.
- Prevent request bodies from substituting a different service action across authenticated route capabilities. Fix body-free GET service status and per-node cache isolation.

## Upgrade

Install the SHA-256-verified CLI release and upload the new WordPress plugin ZIP. Preserve existing configuration, Query credentials and paired nodes. For script-managed servers, confirm the installation directory, service account and provider using the [deployment guide](https://github.com/DazaiYuki/ts3pilot/blob/main/docs/deployment.md). Restart requires the Agent's explicit `server.restart` capability; WordPress permissions are separate from TeamSpeak permissions.

The Linux release bundles its Node runtime. GitHub Releases and the npm registry are published separately. As checked on October 10, 2026, the npm registry still contains version 0.4.0; use the GitHub Release assets for this version.

## Validation

All 130 Node tests, 63 PHP tests and release/installer checks passed. CI covers Node 22/24, PHP 8.2–8.5, Windows development checks and 17 maintained Linux userlands. Container compatibility checks cover CLI user space rather than every distribution's systemd/SELinux configuration or the third-party TeamSpeak binary.

[Real TS3 and WordPress acceptance](https://github.com/DazaiYuki/ts3pilot/actions/runs/38023795211) passed: new installation on Ubuntu 24.04; adoption of an independently extracted, script-started server; identical all-file hashes during stopped-server read-only adoption; CLI and authenticated WordPress form start/stop/restart; invalid-nonce rejection; Query reconnection; preserved channels and uploaded files; and actual block, widget and settings-page rendering.

[Release CI](https://github.com/DazaiYuki/ts3pilot/actions/runs/38024041177) passed. Public assets were downloaded again and matched against GitHub asset digests and the attached SHA-256 files. Installation and self-update checks also passed using the downloaded public archives.
