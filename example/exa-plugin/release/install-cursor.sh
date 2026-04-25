#!/usr/bin/env bash
set -euo pipefail

REPO="${PLUXX_EXA_REPO:-orchidautomation/pluxx}"
REF="${PLUXX_EXA_REF:-main}"
PLUGIN_NAME="exa-research-example"
INSTALL_DIR="${PLUXX_EXA_CURSOR_INSTALL_DIR:-$HOME/.cursor/plugins/local/$PLUGIN_NAME}"
ARCHIVE_URL="${PLUXX_EXA_ARCHIVE_URL:-https://codeload.github.com/$REPO/tar.gz/$REF}"

need_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1" >&2
    exit 1
  fi
}

need_cmd curl
need_cmd mktemp
need_cmd npm
need_cmd rm
need_cmd tar

TMP_DIR="$(mktemp -d)"
cleanup() {
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT

echo "Downloading $REPO@$REF ..."
ARCHIVE_PATH="$TMP_DIR/pluxx.tar.gz"
curl -fsSL "$ARCHIVE_URL" -o "$ARCHIVE_PATH"
tar -xzf "$ARCHIVE_PATH" -C "$TMP_DIR"

SOURCE_ROOT="$(find "$TMP_DIR" -mindepth 1 -maxdepth 1 -type d -name 'pluxx-*' | head -n1)"
if [[ -z "$SOURCE_ROOT" ]]; then
  echo "Could not locate extracted Pluxx source." >&2
  exit 1
fi

echo "Building Pluxx ..."
(cd "$SOURCE_ROOT" && npm ci && npm run build)

echo "Building Exa Research Example ..."
(cd "$SOURCE_ROOT/example/exa-plugin" && node ../../bin/pluxx.js build)

BUNDLE_DIR="$SOURCE_ROOT/example/exa-plugin/dist/cursor"
PLUGIN_MANIFEST="$BUNDLE_DIR/.cursor-plugin/plugin.json"

if [[ ! -f "$PLUGIN_MANIFEST" ]]; then
  echo "Built Exa example is missing a Cursor plugin manifest." >&2
  exit 1
fi

mkdir -p "$(dirname "$INSTALL_DIR")"
rm -rf "$INSTALL_DIR"
cp -R "$BUNDLE_DIR" "$INSTALL_DIR"

echo "Installed $PLUGIN_NAME to $INSTALL_DIR"
echo "Optional: export EXA_API_KEY for higher limits."
echo "If Cursor is already open, use Developer: Reload Window or restart Cursor."
