#!/usr/bin/env bash
set -euo pipefail

# ──────────────────────────────────────────────────────────────────────────
# Smoke test for QA TimeOff
# Usage:
#   SMOKE_BASE_URL=https://qatimeoff.ru ./scripts/smoke-test.sh
#   SMOKE_BASE_URL=http://localhost:8080                    \
#     SMOKE_EMAIL=admin@test.ru SMOKE_PASSWORD=pass123     \
#     ./scripts/smoke-test.sh --auth
#
# Options:
#   --auth   run authenticated checks (requires SMOKE_EMAIL, SMOKE_PASSWORD)
# ──────────────────────────────────────────────────────────────────────────

BASE_URL="${SMOKE_BASE_URL:-http://localhost:8080}"
PASS=0
FAIL=0

pass() { PASS=$((PASS + 1)); echo "  ✅ $1"; }
fail() { FAIL=$((FAIL + 1)); echo "  ❌ $1"; }

check_http() {
  local desc="$1" url="$2" expect="$3"
  local body
  body=$(curl -sS --max-time 10 "$url" 2>&1) || { fail "$desc — curl error: $body"; return; }
  if echo "$body" | grep -q "$expect"; then
    pass "$desc"
  else
    fail "$desc — expected \"$expect\", got: $(echo "$body" | head -c 200)"
  fi
}

check_status() {
  local desc="$1" url="$2" expect="${3:-200}"
  local code
  code=$(curl -sS -o /dev/null -w '%{http_code}' --max-time 10 "$url" 2>&1) || { fail "$desc — curl error"; return; }
  if [ "$code" = "$expect" ]; then
    pass "$desc (HTTP $code)"
  else
    fail "$desc — expected HTTP $expect, got $code"
  fi
}

echo ""
echo "🧪 QA TimeOff — smoke test"
echo "   BASE_URL = $BASE_URL"
echo ""

# ── 1. Health endpoint ──────────────────────────────────────────────────

echo "═══ 1. Health checks ═══"

check_http  "/health returns ok"   "$BASE_URL/health"   "ok"
check_http  "/health has database" "$BASE_URL/health"   '"database"'

# ── 2. Frontend ─────────────────────────────────────────────────────────

echo ""
echo "═══ 2. Frontend ═══"

check_status "/ — index.html"       "$BASE_URL/"       200
check_http   "/ has root div"       "$BASE_URL/"       '<div id="root"></div>'
check_status "/login — login page"  "$BASE_URL/login"  200

# ── 3. API without auth ─────────────────────────────────────────────────

echo ""
echo "═══ 3. Public API ═══"

check_http  "/health — full JSON"  "$BASE_URL/health"  '"status":"ok"'
check_status "/health — method GET" "$BASE_URL/health"  200

# ── 4. Auth ─────────────────────────────────────────────────────────────

echo ""
echo "═══ 4. Auth ═══"

if [ "${SMOKE_EMAIL:-}" ] && [ "${SMOKE_PASSWORD:-}" ]; then
  echo "  Logging in as $SMOKE_EMAIL …"

  LOGIN_RESP=$(curl -sS --max-time 10 \
    -X POST "$BASE_URL/api/auth/login" \
    -H 'Content-Type: application/json' \
    -d "{\"email\":\"$SMOKE_EMAIL\",\"password\":\"$SMOKE_PASSWORD\"}" 2>&1) || {
    fail "/auth/login — curl error: $LOGIN_RESP"
    exit 1
  }

  ACCESS_TOKEN=$(echo "$LOGIN_RESP" | grep -o '"accessToken":"[^"]*"' | head -1 | cut -d'"' -f4)
  if [ -z "$ACCESS_TOKEN" ]; then
    fail "/auth/login — no accessToken in response: $(echo "$LOGIN_RESP" | head -c 300)"
    exit 1
  fi
  pass "/auth/login — got accessToken"

  # ── /auth/me ────────────────────────────────────────────────────────
  ME_RESP=$(curl -sS --max-time 10 \
    "$BASE_URL/api/auth/me" \
    -H "Authorization: Bearer $ACCESS_TOKEN" 2>&1)
  if echo "$ME_RESP" | grep -q '"id"'; then
    pass "/auth/me — profile loaded"
  else
    fail "/auth/me — expected id field: $(echo "$ME_RESP" | head -c 200)"
  fi

  # ── /dashboard ──────────────────────────────────────────────────────
  DASH_RESP=$(curl -sS --max-time 10 \
    "$BASE_URL/api/dashboard" \
    -H "Authorization: Bearer $ACCESS_TOKEN" 2>&1)
  if echo "$DASH_RESP" | grep -q '"balance"'; then
    pass "/dashboard — dashboard loaded"
  else
    fail "/dashboard — expected balance field: $(echo "$DASH_RESP" | head -c 200)"
  fi
else
  echo "  ↪ Skipping authenticated checks — set SMOKE_EMAIL / SMOKE_PASSWORD"
  echo "    ./scripts/smoke-test.sh              (public checks only)"
  echo "    SMOKE_EMAIL=… SMOKE_PASSWORD=… ./scripts/smoke-test.sh --auth  (full)"
fi

# ── Summary ─────────────────────────────────────────────────────────────

echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "  ✅ $PASS passed, ❌ $FAIL failed"
echo "═══════════════════════════════════════════════════════════════"
echo ""

if [ "$FAIL" -gt 0 ]; then
  exit 1
fi
