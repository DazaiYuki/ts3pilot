#!/usr/bin/env bash
#
# TS3Pilot — one-line Linux installer (standalone binary, zero system deps).
#   curl -sSL https://raw.githubusercontent.com/DazaiYuki/ts3pilot/main/scripts/install.sh | sudo bash
#
# This script NEVER installs system packages and NEVER modifies existing
# runtime libraries (safe for aaPanel/宝塔 style environments).
#
set -euo pipefail
# shellcheck shell=bash

GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'
REPO="DazaiYuki/ts3pilot"
PREFIX="/opt/ts3pilot"
BIN="/usr/local/bin/ts3pilot"
MIRROR="${TS3PILOT_MIRROR:-github}"

log() {
	printf '%b\n' "$*"
}

die() {
	log "${RED}ERROR${NC} $*"
	exit 1
}

if [ "$(id -u)" -ne 0 ]; then
	die "请以 root 运行：sudo bash install.sh  /  Please run as root: sudo bash install.sh"
fi

arch="$(uname -m)"
case "$arch" in
	x86_64 | amd64)
		ts3_arch="x64"
		;;
	*)
		log "WARN: 官方二进制为 x86_64；当前架构 ${arch} 可能无法运行 / official binary targets x86_64."
		ts3_arch="x64"
		;;
esac
log "Detected architecture: ${arch} (${ts3_arch})"

asset_url=""
resolve_asset() {
	if [ "$MIRROR" = "jsdelivr" ]; then
		log "Fetching release metadata via jsDelivr..."
		info="$(curl -fsSL "https://cdn.jsdelivr.net/gh/${REPO}@main/scripts/latest.json" || true)"
		mirror_url="$(
			printf '%s' "$info" |
				grep -oE '"npmmirror"[[:space:]]*:[[:space:]]*"[^"]*"' |
				sed -E 's/.*"[[:space:]]*:[[:space:]]*"//; s/"$//' |
				head -n1 || true
		)"
		if [ -n "$mirror_url" ]; then
			asset_url="$mirror_url"
			return 0
		fi
		log "Mirror metadata unavailable; falling back to GitHub."
	fi

	log "Fetching latest release metadata from GitHub..."
	api="$(curl -fsSL "https://api.github.com/repos/${REPO}/releases/latest")" || die "无法获取 Release 信息，请检查网络或仓库是否存在。"
	asset_url="$(
		printf '%s' "$api" |
			grep -oE '"browser_download_url"[[:space:]]*:[[:space:]]*"[^"]*ts3pilot-linux-x64-v[^"]*\.tar\.gz"' |
			sed -E 's/.*"[[:space:]]*:[[:space:]]*"//; s/"$//' |
			head -n1 || true
	)"
}
resolve_asset

if [ -z "$asset_url" ]; then
	die "未在最新 Release 中找到 ts3pilot-linux-x64-v*.tar.gz 发布包。"
fi

tmp="$(mktemp -d)"
# shellcheck disable=SC2016
trap 'rm -rf "$tmp"' EXIT

log "Downloading: ${asset_url}"
curl -fSL "$asset_url" -o "$tmp/ts3pilot.tar.gz" || die "下载失败。"

mkdir -p "$PREFIX"
tar -xzf "$tmp/ts3pilot.tar.gz" -C "$tmp"

src="$tmp"
for candidate in "$tmp"/*; do
	if [ -d "$candidate" ] && [ -f "$candidate/ts3pilot" ]; then
		src="$candidate"
		break
	fi
done

cp -a "$src"/. "$PREFIX"/
chmod +x "$PREFIX/ts3pilot"
ln -sfn "$PREFIX/ts3pilot" "$BIN"

log ""
log "${GREEN}安装成功！请直接输入 \`ts3pilot\` 回车，进入交互式控制台进行首次运行与配置。${NC}"
log "${GREEN}Installed! Type \`ts3pilot\` and press Enter to start the interactive console.${NC}"
