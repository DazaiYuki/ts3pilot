#!/usr/bin/env bash
#
# TS3Pilot — one-line Linux installer.
#   curl -sSL https://raw.githubusercontent.com/DazaiYuki/ts3pilot/main/scripts/install.sh | sudo bash
#
set -euo pipefail
# shellcheck shell=bash

GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'
REPO="DazaiYuki/ts3pilot"
PREFIX="/opt/ts3pilot"
BIN="/usr/local/bin/ts3pilot"

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
		ts3_arch="amd64"
		;;
	aarch64 | arm64)
		ts3_arch="arm64"
		;;
	*)
		ts3_arch="$arch"
		;;
esac
log "Detected architecture: ${arch} (${ts3_arch})"

log "Fetching latest release metadata from GitHub..."
api="$(curl -fsSL "https://api.github.com/repos/${REPO}/releases/latest")" || die "无法获取 Release 信息，请检查网络或仓库是否存在。"
asset_url="$(
	printf '%s' "$api" |
		grep -oE '"browser_download_url"[[:space:]]*:[[:space:]]*"[^"]*ts3-manager-v[^"]*\.tar\.gz"' |
		sed -E 's/.*"[[:space:]]*:[[:space:]]*"//; s/"$//' |
		head -n1 || true
)"
if [ -z "$asset_url" ]; then
	die "未在最新 Release 中找到 ts3-manager-v*.tar.gz 发布包。"
fi

tmp="$(mktemp -d)"
# shellcheck disable=SC2016
trap 'rm -rf "$tmp"' EXIT

log "Downloading: ${asset_url}"
curl -fSL "$asset_url" -o "$tmp/ts3-manager.tar.gz" || die "下载失败。"

mkdir -p "$PREFIX"
tar -xzf "$tmp/ts3-manager.tar.gz" -C "$tmp"

src="$tmp"
for candidate in "$tmp"/*; do
	if [ -d "$candidate" ] && [ "$(basename "$candidate")" != "ts3-manager.tar.gz" ]; then
		src="$candidate"
		break
	fi
done

cp -a "$src"/. "$PREFIX"/
chmod +x "$PREFIX/dist/cli/index.js" 2>/dev/null || true
ln -sfn "$PREFIX/dist/cli/index.js" "$BIN"

log ""
log "${GREEN}✔ TS3Pilot CLI 安装成功 / TS3Pilot CLI installed successfully${NC}"
log "  命令: $(command -v ts3pilot || printf '%s' "$BIN")"
log ""
log "下一步 / Next steps:"
log "  新服务器（New server）:  sudo ts3pilot install --accept-eula"
log "  接管现有（Existing）:    sudo ts3pilot adopt"
log "  诊断（Doctor）:          ts3pilot doctor"
