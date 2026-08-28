#!/usr/bin/env bash
#
# TS3Pilot — one-line Linux installer (standalone binary, zero system deps).
#   curl -sSL https://raw.githubusercontent.com/DazaiYuki/ts3pilot/main/scripts/install.sh | sudo bash
#   curl -sSL https://cdn.jsdelivr.net/gh/DazaiYuki/ts3pilot@main/scripts/install-cn.sh | sudo bash
#
# This script NEVER installs system packages and NEVER modifies existing
# runtime libraries (safe for aaPanel/Baota style environments).
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
GH_PROXY_PREFIXES=(
	"https://gh-proxy.com/"
	"https://mirror.ghproxy.com/"
)

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
npmmirror_url=""

github_asset_for_version() {
	printf '%s' "https://github.com/${REPO}/releases/download/v${1}/ts3pilot-linux-x64-v${1}.tar.gz"
}

resolve_github_asset_from_api() {
	log "Fetching latest release metadata from GitHub..."
	local api
	api="$(curl -fsSL --max-time 20 "https://api.github.com/repos/${REPO}/releases/latest")" || return 1
	asset_url="$(printf '%s' "$api" |
		grep -oE '"browser_download_url"[[:space:]]*:[[:space:]]*"[^"]*ts3pilot-linux-x64-v[^"]*\.tar\.gz"' |
		sed -E 's/.*"[[:space:]]*:[[:space:]]*"//; s/"$//' |
		head -n1 || true)"
	[ -n "$asset_url" ]
}

resolve_asset() {
	if [ "$MIRROR" = "jsdelivr" ]; then
		log "Fetching release metadata via jsDelivr..."
		local info version
		info="$(curl -fsSL --max-time 20 "https://cdn.jsdelivr.net/gh/${REPO}@main/scripts/latest.json" || true)"
		version="$(printf '%s' "$info" |
			grep -oE '"version"[[:space:]]*:[[:space:]]*"[^"]*"' |
			sed -E 's/.*"[[:space:]]*:[[:space:]]*"//; s/"$//' |
			head -n1 || true)"
		npmmirror_url="$(printf '%s' "$info" |
			grep -oE '"npmmirror"[[:space:]]*:[[:space:]]*"[^"]*"' |
			sed -E 's/.*"[[:space:]]*:[[:space:]]*"//; s/"$//' |
			head -n1 || true)"
		if [ -n "$version" ]; then
			# Deterministic GitHub asset URL built from the version, so the
			# China path never depends on api.github.com being reachable.
			asset_url="$(github_asset_for_version "$version")"
			return 0
		fi
		log "Mirror metadata unavailable; falling back to GitHub."
		resolve_github_asset_from_api
		return $?
	fi
	resolve_github_asset_from_api
}

download_with_fallback() {
	local candidate
	for candidate in "$@"; do
		if [ -z "$candidate" ]; then
			continue
		fi
		log "Downloading: ${candidate}"
		if curl -fSL --max-time 600 "$candidate" -o "$tmp/ts3pilot.tar.gz"; then
			return 0
		fi
		log "Download failed; trying the next source..."
	done
	return 1
}

if ! resolve_asset; then
	die "无法获取 Release 信息，请检查网络或仓库是否存在。"
fi

if [ -z "$asset_url" ]; then
	die "未在最新 Release 中找到 ts3pilot-linux-x64-v*.tar.gz 发布包。"
fi

tmp="$(mktemp -d)"
# shellcheck disable=SC2016
trap 'rm -rf "$tmp"' EXIT

if [ "$MIRROR" = "jsdelivr" ]; then
	download_with_fallback \
		"$npmmirror_url" \
		"${GH_PROXY_PREFIXES[0]}${asset_url}" \
		"${GH_PROXY_PREFIXES[1]}${asset_url}" \
		"$asset_url" ||
		die "所有下载源均失败：npm 包未发布、ghproxy 不可用或 GitHub 直连超时。可稍后重试，或改用直连安装：curl -sSL https://raw.githubusercontent.com/${REPO}/main/scripts/install.sh | sudo bash"
else
	download_with_fallback "$asset_url" || die "下载失败。"
fi

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
