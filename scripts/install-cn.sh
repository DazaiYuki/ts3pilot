#!/usr/bin/env bash
#
# TS3Pilot — China-friendly one-line installer (jsDelivr + npmmirror).
#   curl -sSL https://cdn.jsdelivr.net/gh/DazaiYuki/ts3pilot@main/scripts/install-cn.sh | sudo bash
#
set -euo pipefail

export TS3PILOT_MIRROR=jsdelivr
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

curl -fsSL "https://cdn.jsdelivr.net/gh/DazaiYuki/ts3pilot@main/scripts/install.sh" -o "$tmp/install.sh" \
	|| { echo "ERROR: 无法从 jsDelivr 获取安装脚本 / failed to fetch installer from jsDelivr" >&2; exit 1; }
bash "$tmp/install.sh"
