=== TS3 Operations ===
Contributors: ts3-community-ops
Tags: teamspeak, ts3, server, status, control plane
Requires at least: 6.0
Tested up to: 6.7
Requires PHP: 8.0
Stable tag: 0.1.0
License: Apache-2.0
License URI: https://www.apache.org/licenses/LICENSE-2.0

Optional WordPress control plane for TeamSpeak 3 servers managed by the ts3-manager agent.

== Description ==

TS3 Operations is the WordPress side of the TS3 Community Operations Suite.
It never executes shell commands, never runs as root and never exposes the
agent credential to the browser. All agent communication happens server-side
with HMAC-SHA256 signed requests over the WordPress HTTP API.

Features in this release:
* Status card via [ts3_status] shortcode or the TS3 Status Gutenberg block
* Server-side cached public status (privacy-minimal fields only)
* Client list and kick actions protected by dedicated capabilities
* Pairing wizard for the ts3-manager agent (single-use pairing code)
* Bounded audit log and redacted diagnostics

== Installation ==

1. Upload the plugin directory to /wp-content/plugins/ and activate.
2. Enable and pair the agent: `ts3-manager api enable`, then run the agent,
   then enter the pairing code on the Settings page.
3. Place the shortcode or block on any page.

== Frequently Asked Questions ==

= Is this a remote shell? =
No. The agent exposes a fixed, capability-gated /v1 API. The plugin can only
perform the actions the site administrator grants it.

= Does this change TeamSpeak permissions? =
No. WordPress capabilities and TeamSpeak permissions are completely separate.

== Changelog ==

= 0.1.0 =
* Initial MVP: status, clients, kick, pairing, audit log.
