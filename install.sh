#!/bin/sh
set -eu

PACKAGE="tarsen-cli"
VERSION="latest"
MANAGER="${TARSEN_PM:-}"
DRY_RUN=0

usage() {
  cat <<'EOF'
Install the Tarsen CLI from npm.

Usage: install.sh [--manager npm|pnpm|yarn|bun] [--version VERSION] [--dry-run]

Environment:
  TARSEN_PM       Preferred package manager.
  TARSEN_VERSION  Version to install (default: latest).
EOF
}

VERSION="${TARSEN_VERSION:-$VERSION}"
while [ "$#" -gt 0 ]; do
  case "$1" in
    --manager) [ "$#" -ge 2 ] || { echo "Missing value for --manager" >&2; exit 2; }; MANAGER="$2"; shift 2 ;;
    --version) [ "$#" -ge 2 ] || { echo "Missing value for --version" >&2; exit 2; }; VERSION="$2"; shift 2 ;;
    --dry-run) DRY_RUN=1; shift ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown option: $1" >&2; usage >&2; exit 2 ;;
  esac
done

case "$VERSION" in
  *[!A-Za-z0-9._+-]*) echo "Invalid version: $VERSION" >&2; exit 2 ;;
esac

if ! command -v node >/dev/null 2>&1; then
  echo "Tarsen requires Node.js 20 or newer: https://nodejs.org" >&2
  exit 1
fi

NODE_MAJOR=$(node -p "Number(process.versions.node.split('.')[0])")
if [ "$NODE_MAJOR" -lt 20 ]; then
  echo "Tarsen requires Node.js 20 or newer; found $(node --version)." >&2
  exit 1
fi

if [ -z "$MANAGER" ]; then
  for candidate in npm pnpm yarn bun; do
    if command -v "$candidate" >/dev/null 2>&1; then MANAGER="$candidate"; break; fi
  done
fi

SPEC="$PACKAGE"
[ "$VERSION" = "latest" ] || SPEC="$PACKAGE@$VERSION"

case "$MANAGER" in
  npm)  set -- npm install --global "$SPEC" ;;
  pnpm) set -- pnpm add --global "$SPEC" ;;
  yarn) set -- yarn global add "$SPEC" ;;
  bun)  set -- bun add --global "$SPEC" ;;
  "") echo "No supported package manager found (npm, pnpm, yarn, or bun)." >&2; exit 1 ;;
  *) echo "Unsupported package manager: $MANAGER" >&2; exit 2 ;;
esac

echo "Installing $SPEC with $MANAGER..."
if [ "$DRY_RUN" -eq 1 ]; then
  printf 'Would run:'
  printf ' %s' "$@"
  printf '\n'
  exit 0
fi

"$@"
echo "Tarsen installed. Run: tarsen check react"
