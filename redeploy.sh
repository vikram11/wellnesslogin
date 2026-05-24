#!/bin/bash
# ===============================================================
# WellnessLog.in — Full Redeployment Script for Fresh Ubuntu VPS
# ===============================================================
# Usage:
#   1. SSH into your fresh VPS: ssh root@157.173.222.202
#   2. Run: bash <(curl -sL https://raw.githubusercontent.com/vikram11/wellnesslogin/main/redeploy.sh)
#
# Or manually:
#   scp redeploy.sh root@157.173.222.202:/tmp/
#   ssh root@157.173.222.202 "bash /tmp/redeploy.sh"
# ===============================================================

set -e

echo "🌿 WellnessLog.in — Full Redeployment"
echo "======================================"
echo ""

# ---------- Configuration ----------
APP_DOMAIN="wellnesslog.in"
VPS_IP="157.173.222.202"
DEPLOY_PATH="/docker/wellnesslog-in"
COMPOSE_FILE="docker-compose.neon.yml"
IMAGE="ghcr.io/vikram11/wellnesslogin:latest"
GHCR_REPO="vikram11/wellnesslogin"

# ---------- 1. Install Docker ----------
echo "[1/8] Installing Docker..."
if ! command -v docker &>/dev/null; then
  curl -fsSL https://get.docker.com | bash
  systemctl enable docker && systemctl start docker
else
  echo "  Docker already installed."
fi

# ---------- 2. Install Docker Compose plugin ----------
echo "[2/8] Installing Docker Compose plugin..."
if ! docker compose version &>/dev/null; then
  apt-get update -y && apt-get install -y docker-compose-plugin
else
  echo "  Docker Compose already installed."
fi

# ---------- 3. Create directory structure ----------
echo "[3/8] Creating deploy directory..."
mkdir -p "$DEPLOY_PATH"

# ---------- 4. Write docker-compose.yml ----------
echo "[4/8] Writing docker-compose.yml..."
cat > "$DEPLOY_PATH/docker-compose.yml" << 'DOCKERCOMPOSE'
services:
  app:
    image: ghcr.io/vikram11/wellnesslogin:latest
    restart: unless-stopped
    environment:
      DATABASE_URL: postgresql://neondb_owner:npg_bGmIk2FDtL1B@ep-hidden-boat-ajjf9pbs.c-3.us-east-2.aws.neon.tech/neondb?sslmode=require
      OLLAMA_API_KEY: bef1758095114d51be25ebb2d88679f8.BG34PpG7Eze4l82zNuWPA9Vy
      OLLAMA_MODEL: gemma4:31b-cloud
      NEXT_PUBLIC_VAPID_PUBLIC_KEY: BIkgoN9zFHVs5sj0a9vMglYZrCj79gleNUSMPNDfKHqg6N0wsLG_dcveyCyZ-gbua1LVQHTihcojBTagReyRbXU
      VAPID_PRIVATE_KEY: Mc15bCKK8Wu08TDSL6k1-nvOoA_5hL-ZJYPuCbhuX9E
      SMTP_HOST: smtp.hostinger.com
      SMTP_PORT: "465"
      SMTP_USER: update@wellnesslog.in
      SMTP_PASS: "Healthy-2026!"
      EMAIL_FROM: "WellnessLog.in <update@wellnesslog.in>"
      NEXTAUTH_URL: https://wellnesslog.in
    networks:
      - caddy_network
    labels:
      caddy: wellnesslog.in
      caddy.reverse_proxy: "{{upstreams 3000}}"

networks:
  caddy_network:
    external: true
DOCKERCOMPOSE

echo "  docker-compose.yml written."

# ---------- 5. Create external Docker network ----------
echo "[5/8] Creating Docker network 'caddy_network'..."
docker network create caddy_network 2>/dev/null || echo "  Network already exists."

# ---------- 6. Set up Caddy reverse proxy ----------
echo "[6/8] Setting up Caddy reverse proxy..."
if ! docker ps --format '{{.Names}}' | grep -q caddy; then
  cat > "$DEPLOY_PATH/Caddyfile" << 'CADDYFILE'
wellnesslog.in {
    reverse_proxy app:3000
}
CADDYFILE

  docker run -d \
    --name caddy \
    --restart unless-stopped \
    --network caddy_network \
    -p 80:80 \
    -p 443:443 \
    -v "$DEPLOY_PATH/Caddyfile:/etc/caddy/Caddyfile" \
    -v caddy_data:/data \
    -v caddy_config:/config \
    caddy:2
  echo "  Caddy container started."
else
  echo "  Caddy already running."
fi

# ---------- 7. Pull and start the app ----------
echo "[7/8] Pulling and starting the app container..."
cd "$DEPLOY_PATH"
docker compose pull
docker compose down 2>/dev/null || true
docker compose up -d

echo "  App container started."

# ---------- 8. Final setup ----------
echo "[8/8] Running final setup..."

# Wait for container to be ready
sleep 5

# Prisma generate
echo "  Regenerating Prisma client..."
docker exec wellnesslog-in-app-1 npx prisma generate 2>/dev/null || true

# Create Notification table
echo "  Creating Notification table..."
docker exec wellnesslog-in-app-1 sh -c 'node -e "
const { PrismaClient } = require(\"@prisma/client\");
const p = new PrismaClient();
p.\$executeRawUnsafe(\`
  CREATE TABLE IF NOT EXISTS \"Notification\" (
    id VARCHAR NOT NULL DEFAULT gen_random_uuid(),
    label VARCHAR NOT NULL,
    time VARCHAR NOT NULL,
    type VARCHAR NOT NULL DEFAULT '\''custom'\'',
    enabled BOOLEAN NOT NULL DEFAULT true,
    days_of_week VARCHAR NOT NULL DEFAULT '\''[1,2,3,4,5,6,7]'\'',
    created_at TIMESTAMP NOT NULL DEFAULT now(),
    updated_at TIMESTAMP NOT NULL DEFAULT now(),
    PRIMARY KEY (id)
  )
\`).then(() => { console.log(\"  Notification table ready\"); return p.\$disconnect(); }).catch(() => process.exit(0));
"' 2>/dev/null || true

# Set up cron jobs
echo "  Setting up cron jobs..."
CRON_EMAIL="* * * * * docker exec wellnesslog-in-app-1 wget -qO- http://localhost:3000/api/email-scheduled > /dev/null 2>&1"
CRON_NOTIF="* * * * * docker exec wellnesslog-in-app-1 wget -qO- http://localhost:3000/api/notifications/check > /dev/null 2>&1"

(crontab -l 2>/dev/null | grep -v "wellnesslog-in-app-1"; echo "$CRON_EMAIL"; echo "$CRON_NOTIF") | crontab -

echo ""
echo "======================================"
echo "✅ Redeployment Complete!"
echo "======================================"
echo ""
echo "  App:       https://$APP_DOMAIN"
echo "  Container: wellnesslog-in-app-1"
echo "  Caddy:     caddy (port 80/443)"
echo "  DB:        Neon PostgreSQL (external)"
echo ""
echo "  Cron jobs active (every minute):"
echo "    • /api/email-scheduled"
echo "    • /api/notifications/check"
echo ""
echo "  Next: DNS A record for $APP_DOMAIN should point to $VPS_IP"
echo "        (may already be set if DNS wasn't wiped)"
echo ""