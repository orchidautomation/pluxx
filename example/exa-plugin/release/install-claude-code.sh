#!/usr/bin/env bash
set -euo pipefail

REPO="${PLUXX_EXA_REPO:-orchidautomation/pluxx}"
REF="${PLUXX_EXA_REF:-main}"
PLUGIN_NAME="exa-research-example"
MARKETPLACE_NAME="${PLUXX_EXA_CLAUDE_MARKETPLACE_NAME:-pluxx-local-exa-research-example}"
INSTALL_ROOT="${PLUXX_EXA_CLAUDE_MARKETPLACE_DIR:-$HOME/.claude/plugins/data/$MARKETPLACE_NAME}"
ARCHIVE_URL="${PLUXX_EXA_ARCHIVE_URL:-https://codeload.github.com/$REPO/tar.gz/$REF}"

need_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1" >&2
    exit 1
  fi
}

need_cmd bash
need_cmd claude
need_cmd curl
need_cmd grep
need_cmd mktemp
need_cmd npm
need_cmd rm
need_cmd sed
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

echo "Trust note: this example installs a session-start shell hook (scripts/check-exa-setup.sh)."
echo "The hook only reports whether EXA_API_KEY is set and prints setup guidance, but running this installer means trusting that local hook."

echo "Building Pluxx ..."
(cd "$SOURCE_ROOT" && npm ci && npm run build)

echo "Building Exa Research Example ..."
(cd "$SOURCE_ROOT/example/exa-plugin" && node ../../bin/pluxx.js build)

BUNDLE_DIR="$SOURCE_ROOT/example/exa-plugin/dist/claude-code"
PLUGIN_MANIFEST="$BUNDLE_DIR/.claude-plugin/plugin.json"

if [[ ! -f "$PLUGIN_MANIFEST" ]]; then
  echo "Built Exa example is missing a Claude plugin manifest." >&2
  exit 1
fi

VERSION="$(grep -E '"version"' "$PLUGIN_MANIFEST" | head -n1 | sed -E 's/.*"version"[[:space:]]*:[[:space:]]*"([^"]+)".*/\1/')"
DESCRIPTION="$(grep -E '"description"' "$PLUGIN_MANIFEST" | head -n1 | sed -E 's/.*"description"[[:space:]]*:[[:space:]]*"([^"]+)".*/\1/')"

mkdir -p "$INSTALL_ROOT/.claude-plugin" "$INSTALL_ROOT/plugins"
rm -rf "$INSTALL_ROOT/plugins/$PLUGIN_NAME"
cp -R "$BUNDLE_DIR" "$INSTALL_ROOT/plugins/$PLUGIN_NAME"

cat > "$INSTALL_ROOT/.claude-plugin/marketplace.json" <<JSON
{
  "name": "$MARKETPLACE_NAME",
  "owner": {
    "name": "Orchid Automation"
  },
  "plugins": [
    {
      "name": "$PLUGIN_NAME",
      "source": "./plugins/$PLUGIN_NAME",
      "description": "${DESCRIPTION:-Exa Research Example for Claude Code}",
      "version": "${VERSION:-0.1.0}",
      "author": {
        "name": "Orchid Automation"
      },
      "license": "MIT",
      "homepage": "https://github.com/orchidautomation/pluxx/tree/main/example/exa-plugin"
    }
  ]
}
JSON

if claude plugin marketplace list --json | grep -q "\"name\": \"$MARKETPLACE_NAME\""; then
  claude plugin marketplace update "$MARKETPLACE_NAME" >/dev/null
else
  claude plugin marketplace add "$INSTALL_ROOT" >/dev/null
fi

claude plugin uninstall "${PLUGIN_NAME}@${MARKETPLACE_NAME}" --scope user >/dev/null 2>&1 || true
claude plugin install "${PLUGIN_NAME}@${MARKETPLACE_NAME}" --scope user

echo
echo "Installed ${PLUGIN_NAME}@${MARKETPLACE_NAME} into Claude Code user scope."
echo "Optional: export EXA_API_KEY for higher limits."
echo "If Claude Code is already open, run /reload-plugins."
