#!/usr/bin/env bash
# TS3Pilot standalone Linux x86_64 installer. Does not install system packages.
# Pin with TS3PILOT_VERSION=x.y.z; optional trusted digest: TS3PILOT_SHA256.
# Offline: TS3PILOT_ARCHIVE=<local tar.gz> requires both version and digest.
set -euo pipefail

REPO="DazaiYuki/ts3pilot"
PREFIX="${TS3PILOT_PREFIX:-/opt/ts3pilot}"
BIN="${TS3PILOT_BIN:-/usr/local/bin/ts3pilot}"
MIRROR="${TS3PILOT_MIRROR:-github}"
log() { printf '%s\n' "$*"; }
die() { log "ERROR: $*" >&2; exit 1; }
[ "$(id -u)" -eq 0 ] || die "Please run as root: sudo bash install.sh"
[ "$(uname -s)" = Linux ] || die "Only Linux is supported"
case "$(uname -m)" in x86_64|amd64) ;; *) die "This release requires x86_64 (64-bit x86)" ;; esac
case "$PREFIX:$BIN" in /*:/*) ;; *) die "PREFIX and BIN must be absolute paths" ;; esac
for command in curl tar sha256sum mktemp chmod mkdir mv ln; do
 command -v "$command" >/dev/null || die "Required command missing: $command"
done

version="${TS3PILOT_VERSION:-}"
local_archive="${TS3PILOT_ARCHIVE:-}"
if [ -n "$local_archive" ] && [ -z "$version" ]; then
 die "Offline installation requires TS3PILOT_VERSION"
fi
if [ -z "$version" ]; then
 if [ "$MIRROR" = jsdelivr ]; then
  metadata="$(curl -fsSL --max-time 30 "https://cdn.jsdelivr.net/gh/${REPO}@main/scripts/latest.json")"
  version="$(printf '%s' "$metadata" | sed -nE 's/.*"version"[[:space:]]*:[[:space:]]*"([0-9.]+)".*/\1/p' | head -n1)"
 else
  metadata="$(curl -fsSL --max-time 30 "https://api.github.com/repos/${REPO}/releases/latest")"
  version="$(printf '%s' "$metadata" | sed -nE 's/.*"tag_name"[[:space:]]*:[[:space:]]*"v([0-9.]+)".*/\1/p' | head -n1)"
 fi
fi
[[ "$version" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]] || die "Invalid release version"
asset="https://github.com/${REPO}/releases/download/v${version}/ts3pilot-linux-x64-v${version}.tar.gz"
expected="${TS3PILOT_SHA256:-}"
if [ -n "$local_archive" ] && [ -z "$expected" ]; then
 die "Offline installation requires a trusted TS3PILOT_SHA256"
fi
if [ -z "$expected" ]; then
 # Obtain the digest from the official release, never from an untrusted mirror.
 checksum="$(curl -fsSL --max-time 30 "${asset}.sha256")" || die "Cannot obtain official SHA-256; supply a trusted TS3PILOT_SHA256"
 expected="${checksum%% *}"
fi
[[ "$expected" =~ ^[a-fA-F0-9]{64}$ ]] || die "Invalid release SHA-256"

tmp="$(mktemp -d)"
staging=""
cleanup() { rm -rf "$tmp"; if [ -n "$staging" ]; then rm -rf "$staging"; fi; }
trap cleanup EXIT
sources=("$asset")
if [ "$MIRROR" = jsdelivr ]; then
 sources=("https://gh-proxy.com/${asset}" "https://mirror.ghproxy.com/${asset}" "$asset")
fi
downloaded=false
if [ -n "$local_archive" ]; then
 [ -f "$local_archive" ] || die "Local archive does not exist: $local_archive"
 cp -- "$local_archive" "$tmp/release.tar.gz"
 (cd "$tmp" && printf '%s  release.tar.gz\n' "$expected" | sha256sum -c -) || die "Local archive checksum failed; installed version preserved"
 downloaded=true
else
for url in "${sources[@]}"; do
 log "Downloading v${version}: $url"
 if curl -fsSL --max-time 600 "$url" -o "$tmp/release.tar.gz" &&
  (cd "$tmp" && printf '%s  release.tar.gz\n' "$expected" | sha256sum -c -); then
  downloaded=true; break
 fi
 log "Download or checksum failed; trying next source"
done
fi
[ "$downloaded" = true ] || die "No source supplied a verified release archive"
# Only the four release files and their optional directory wrapper are allowed.
tar -tzf "$tmp/release.tar.gz" > "$tmp/entries"
while IFS= read -r entry; do
 case "$entry" in ts3pilot|config.example.json|LICENSE|NOTICE.md|ts3pilot/|ts3pilot/ts3pilot|ts3pilot/config.example.json|ts3pilot/LICENSE|ts3pilot/NOTICE.md) ;; *) die "Unexpected archive entry: $entry" ;; esac
done < "$tmp/entries"
tar -tvzf "$tmp/release.tar.gz" | awk 'substr($1,1,1)!="-" && substr($1,1,1)!="d" { bad=1 } END { exit bad }' || die "Release archive contains links or special files"
mkdir "$tmp/extract"
tar -xzf "$tmp/release.tar.gz" -C "$tmp/extract" --no-same-owner
src="$tmp/extract"
if [ -d "$src/ts3pilot" ]; then src="$src/ts3pilot"; fi
[ -f "$src/ts3pilot" ] || die "No binary in release archive"
mkdir -p "$PREFIX" "$(dirname "$BIN")"
staging="$(mktemp -d "$PREFIX/.install-XXXXXX")"
cp "$src/ts3pilot" "$staging/ts3pilot"
chmod 755 "$staging/ts3pilot"
probe="$("$staging/ts3pilot" version)" || die "Binary smoke test failed; installed version preserved"
[ "${probe%%$'\n'*}" = "ts3pilot ${version}" ] || die "Binary version mismatch; installed version preserved"
# Same-filesystem rename preserves a running executable and avoids ETXTBSY.
mv -f "$staging/ts3pilot" "$PREFIX/ts3pilot"
for file in config.example.json LICENSE NOTICE.md; do
 if [ -f "$src/$file" ]; then cp "$src/$file" "$PREFIX/$file"; chmod 644 "$PREFIX/$file"; fi
done
ln -sfn "$PREFIX/ts3pilot" "$BIN"
log "Installed TS3Pilot ${version}. Run: ts3pilot"
