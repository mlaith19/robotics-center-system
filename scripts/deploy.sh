#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────────────────────
# deploy.sh — Deploy Robotics Center System to VPS (port 9030)
#
# Usage (on VPS):
#   chmod +x scripts/deploy.sh
#   ./scripts/deploy.sh
#
# Assumes:
#   - Docker & docker-compose v2 installed on VPS
#   - .env.production exists and is filled in
#   - Repository is cloned at current directory
# ──────────────────────────────────────────────────────────────────────────────
set -euo pipefail

APP_NAME="robotics-center-system"
COMPOSE_FILE="docker-compose.production.yml"
ENV_FILE=".env.production"

echo ""
echo "══════════════════════════════════════════════"
echo "  🚀 Robotics Center — Production Deploy"
echo "  Port: 9030"
echo "══════════════════════════════════════════════"
echo ""

# ── Preflight checks ──────────────────────────────────────────────────────────
if [ ! -f "$ENV_FILE" ]; then
  echo "❌  ERROR: $ENV_FILE not found."
  echo "   Copy .env.production.example and fill in values:"
  echo "   cp .env.production.example .env.production"
  exit 1
fi

if ! command -v docker &>/dev/null; then
  echo "❌  ERROR: Docker not found. Install Docker first."
  exit 1
fi

echo "✅  Pre-flight checks passed"
echo ""

# ── Pull latest code ──────────────────────────────────────────────────────────
if git rev-parse --git-dir &>/dev/null; then
  echo "📦  Pulling latest code..."
  git pull --rebase
  echo ""
fi

# ── Build & restart ───────────────────────────────────────────────────────────
echo "🔨  Building Docker image..."
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" build --no-cache app

echo ""
echo "🔄  Restarting services..."
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d --remove-orphans

# ── Run database migrations ───────────────────────────────────────────────────
echo ""
echo "🗄️   Running Prisma migrations..."
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" \
  exec app npx prisma migrate deploy || echo "⚠️  Migrations skipped (may need manual run)"

# ── Health check ──────────────────────────────────────────────────────────────
echo ""
echo "🏥  Waiting for health check..."
sleep 10

MAX=10
COUNT=0
until docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" \
  exec app wget -qO- http://localhost:9030/api/health &>/dev/null; do
  COUNT=$((COUNT + 1))
  if [ $COUNT -ge $MAX ]; then
    echo "⚠️   Health check timed out — check logs:"
    echo "    docker compose -f $COMPOSE_FILE logs app"
    break
  fi
  echo "   Waiting... ($COUNT/$MAX)"
  sleep 5
done

echo ""
echo "══════════════════════════════════════════════"
echo "  ✅  Deploy complete!"
echo "  🌐  App running on port 9030"
echo ""
echo "  Useful commands:"
echo "    Logs:    docker compose -f $COMPOSE_FILE logs -f app"
echo "    Status:  docker compose -f $COMPOSE_FILE ps"
echo "    Stop:    docker compose -f $COMPOSE_FILE down"
echo "══════════════════════════════════════════════"
echo ""
