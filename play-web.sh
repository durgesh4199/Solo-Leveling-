#!/usr/bin/env bash
# One-click web build + launch for Hunter Protocol.
# Usage: ./play-web.sh   (double-clickable in most Linux/macOS file managers
# if marked executable; otherwise run it from a terminal)
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js is required but wasn't found. Install it from https://nodejs.org/ and try again." >&2
  exit 1
fi

if [ ! -d node_modules ]; then
  echo "Installing dependencies (first run only)..."
  npm install
fi

echo "Building the web version..."
npm run build

echo "Starting local server and opening the game in your browser..."
npm run play
