#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
EXTENSION_DIR="$ROOT_DIR/extension"
DIST_DIR="$ROOT_DIR/dist"
VERSION="$(
  node -e 'const fs = require("fs"); const manifest = JSON.parse(fs.readFileSync(process.argv[1], "utf8")); process.stdout.write(manifest.version);' \
    "$EXTENSION_DIR/manifest.json"
)"
ARCHIVE="$DIST_DIR/drive-preview-link-copier-$VERSION.zip"

mkdir -p "$DIST_DIR"

(
  cd "$EXTENSION_DIR"
  zip -r -FS "$ARCHIVE" . \
    -x "icons/icon-source.png" \
    -x "*.DS_Store"
)

echo "$ARCHIVE"
