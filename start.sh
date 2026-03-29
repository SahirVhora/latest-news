#!/usr/bin/env bash
set -e
ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT/frontend"
if [ ! -d node_modules ]; then npm install; fi
echo ""
echo "🌐  LatestNews dev server → http://localhost:5173"
echo ""
exec npm run dev
