#!/usr/bin/env sh
# lazyvec installer
#
# Detects the current OS/arch, downloads the latest release tarball from
# GitHub, verifies its SHA256, and installs the binary to ~/.local/bin
# (or $LAZYVEC_INSTALL_DIR if set).
#
# Usage:
#   curl -sSf https://raw.githubusercontent.com/armgabrielyan/lazyvec/main/install.sh | sh
#   LAZYVEC_VERSION=v0.2.0 curl -sSf ... | sh      # pin a version
#   LAZYVEC_INSTALL_DIR=/usr/local/bin curl ... | sh

set -eu

REPO="armgabrielyan/lazyvec"
INSTALL_DIR="${LAZYVEC_INSTALL_DIR:-$HOME/.local/bin}"
VERSION="${LAZYVEC_VERSION:-}"

log() { printf '\033[1;34m==>\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33mwarning:\033[0m %s\n' "$*" >&2; }
fail() { printf '\033[1;31merror:\033[0m %s\n' "$*" >&2; exit 1; }

require() {
  command -v "$1" >/dev/null 2>&1 || fail "$1 is required but was not found in PATH"
}

require curl
require tar
require uname

detect_target() {
  os=$(uname -s | tr '[:upper:]' '[:lower:]')
  arch=$(uname -m)

  case "$os" in
    darwin) os_name="darwin" ;;
    linux)  os_name="linux"  ;;
    *)      fail "Unsupported OS: $os (Windows users: download the zip from GitHub Releases)" ;;
  esac

  case "$arch" in
    x86_64|amd64) arch_name="x64"   ;;
    arm64|aarch64) arch_name="arm64" ;;
    *)             fail "Unsupported architecture: $arch" ;;
  esac

  # Prebuilt Intel macOS binaries are not shipped — install from source on those hosts.
  if [ "$os_name" = "darwin" ] && [ "$arch_name" = "x64" ]; then
    fail "Intel macOS prebuilt binaries are not available. Install from source: https://github.com/armgabrielyan/lazyvec#-from-source"
  fi

  # Linux arm64 is supported but less tested — warn but continue.
  if [ "$os_name" = "linux" ] && [ "$arch_name" = "arm64" ]; then
    warn "linux-arm64 builds are provided but not routinely tested"
  fi

  printf '%s-%s' "$os_name" "$arch_name"
}

resolve_version() {
  if [ -n "$VERSION" ]; then
    printf '%s' "$VERSION"
    return
  fi
  # Follow the /releases/latest redirect to find the tag.
  tag=$(curl -sSfIL "https://github.com/${REPO}/releases/latest" \
    | awk 'tolower($1)=="location:" {print $2}' \
    | tail -n1 \
    | tr -d '\r\n' \
    | sed 's|.*/tag/||')
  [ -n "$tag" ] || fail "Could not resolve the latest release tag"
  printf '%s' "$tag"
}

target=$(detect_target)
tag=$(resolve_version)
version="${tag#v}"
archive="lazyvec-${version}-${target}.tar.gz"
base_url="https://github.com/${REPO}/releases/download/${tag}"

tmp=$(mktemp -d 2>/dev/null || mktemp -d -t lazyvec)
trap 'rm -rf "$tmp"' EXIT INT TERM

log "Target:   ${target}"
log "Version:  ${tag}"
log "Download: ${base_url}/${archive}"

curl -fSL --progress-bar "${base_url}/${archive}" -o "${tmp}/${archive}"
curl -fSL "${base_url}/SHA256SUMS.txt" -o "${tmp}/SHA256SUMS.txt"

log "Verifying checksum"
expected=$(grep " ${archive}\$" "${tmp}/SHA256SUMS.txt" | awk '{print $1}')
[ -n "$expected" ] || fail "Checksum for ${archive} not found in SHA256SUMS.txt"

if command -v sha256sum >/dev/null 2>&1; then
  actual=$(sha256sum "${tmp}/${archive}" | awk '{print $1}')
elif command -v shasum >/dev/null 2>&1; then
  actual=$(shasum -a 256 "${tmp}/${archive}" | awk '{print $1}')
else
  fail "Neither sha256sum nor shasum is available for checksum verification"
fi

[ "$expected" = "$actual" ] || fail "Checksum mismatch: expected $expected, got $actual"

log "Extracting"
tar -xzf "${tmp}/${archive}" -C "${tmp}"

mkdir -p "${INSTALL_DIR}"
install_path="${INSTALL_DIR}/lazyvec"
mv "${tmp}/lazyvec" "${install_path}"
chmod +x "${install_path}"

log "Installed to ${install_path}"

case ":${PATH}:" in
  *":${INSTALL_DIR}:"*) ;;
  *)
    warn "${INSTALL_DIR} is not in your PATH"
    printf '  Add this to your shell profile:\n    export PATH="%s:$PATH"\n' "${INSTALL_DIR}"
    ;;
esac

printf '\nRun \033[1mlazyvec\033[0m to get started.\n'
