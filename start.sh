#!/usr/bin/env bash
set -e

ROOT="$(cd "$(dirname "$0")" && pwd)"

echo ""
echo "🌐  LatestNews — startup"
echo ""

# ── Python virtualenv ──────────────────────────────────────────────────────
VENV="$ROOT/.venv"
if [ ! -f "$VENV/bin/activate" ]; then
  echo "   Creating Python venv…"
  python3 -m venv "$VENV"
fi
source "$VENV/bin/activate"
pip install -q flask flask-cors

# ── Frontend build (if dist is missing or stale) ──────────────────────────
DIST="$ROOT/frontend/dist/index.html"
if [ ! -f "$DIST" ]; then
  echo "   Building frontend…"
  cd "$ROOT/frontend"
  if [ ! -d node_modules ]; then npm install --silent; fi
  npm run build --silent
  cd "$ROOT"
fi

echo "   ✓ Frontend ready"
echo ""
echo "   Open: http://localhost:5000"
echo "   API:  http://localhost:5000/api/search?q=<topic>"
echo ""

# ── Launch Flask ───────────────────────────────────────────────────────────
cd "$ROOT"
exec python backend/app.py
