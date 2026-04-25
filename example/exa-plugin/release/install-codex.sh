#!/usr/bin/env bash
set -euo pipefail

REPO="${PLUXX_EXA_REPO:-orchidautomation/pluxx}"
REF="${PLUXX_EXA_REF:-main}"
PLUGIN_NAME="exa-research-example"
INSTALL_DIR="${PLUXX_EXA_CODEX_INSTALL_DIR:-$HOME/.codex/plugins/$PLUGIN_NAME}"
MARKETPLACE_PATH="${PLUXX_EXA_CODEX_MARKETPLACE_PATH:-$HOME/.agents/plugins/marketplace.json}"
MARKETPLACE_NAME="${PLUXX_EXA_CODEX_MARKETPLACE_NAME:-$PLUGIN_NAME-local}"
MARKETPLACE_DISPLAY_NAME="${PLUXX_EXA_CODEX_MARKETPLACE_DISPLAY_NAME:-Exa Research Example Local}"
ARCHIVE_URL="${PLUXX_EXA_ARCHIVE_URL:-https://codeload.github.com/$REPO/tar.gz/$REF}"

need_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1" >&2
    exit 1
  fi
}

need_cmd curl
need_cmd mktemp
need_cmd node
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

BUNDLE_DIR="$SOURCE_ROOT/example/exa-plugin/dist/codex"
PLUGIN_MANIFEST="$BUNDLE_DIR/.codex-plugin/plugin.json"

if [[ ! -f "$PLUGIN_MANIFEST" ]]; then
  echo "Built Exa example is missing a Codex plugin manifest." >&2
  exit 1
fi

mkdir -p "$(dirname "$INSTALL_DIR")"
rm -rf "$INSTALL_DIR"
cp -R "$BUNDLE_DIR" "$INSTALL_DIR"

mkdir -p "$(dirname "$MARKETPLACE_PATH")"

export MARKETPLACE_PATH
export PLUGIN_NAME
export MARKETPLACE_NAME
export MARKETPLACE_DISPLAY_NAME

node <<'NODE'
const fs = require('fs')

const filepath = process.env.MARKETPLACE_PATH
const pluginName = process.env.PLUGIN_NAME
const marketplaceName = process.env.MARKETPLACE_NAME
const displayName = process.env.MARKETPLACE_DISPLAY_NAME

let marketplace = {
  name: marketplaceName,
  interface: { displayName },
  plugins: [],
}

if (fs.existsSync(filepath)) {
  marketplace = JSON.parse(fs.readFileSync(filepath, 'utf8'))
  marketplace.name ||= marketplaceName
  marketplace.interface ||= { displayName }
  marketplace.plugins = Array.isArray(marketplace.plugins) ? marketplace.plugins : []
}

const nextPlugins = marketplace.plugins.filter((plugin) => plugin.name !== pluginName)
nextPlugins.push({
  name: pluginName,
  source: {
    source: 'local',
    path: './.codex/plugins/' + pluginName,
  },
  policy: {
    installation: 'AVAILABLE',
    authentication: 'ON_INSTALL',
  },
  category: 'Productivity',
})

fs.writeFileSync(
  filepath,
  JSON.stringify(
    {
      name: marketplace.name,
      interface: marketplace.interface,
      plugins: nextPlugins,
    },
    null,
    2,
  ) + '\n',
)
NODE

echo "Installed $PLUGIN_NAME to $INSTALL_DIR"
echo "Updated Codex marketplace catalog at $MARKETPLACE_PATH"
echo "Optional: export EXA_API_KEY for higher limits."
echo "If Codex is already open, use Plugins > Refresh if available, otherwise restart Codex."
