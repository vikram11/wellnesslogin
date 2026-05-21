# Health Logger — Self-Hosting Guide (Hostinger VPS)

This guide walks you through deploying the Health Logger app on your own Hostinger VPS with your custom domain.

---

## Prerequisites

- **Hostinger VPS** with Ubuntu 22.04+ (or any Debian-based distro)
- **Domain** pointed to your VPS IP (A record in Hostinger DNS)
- **SSH access** to your VPS
- **Node.js 18+** (LTS recommended)
- **PostgreSQL 14+** (can be on the same VPS or a managed service)
- **An OpenAI API key** (or compatible provider — see LLM section below)

---

## 1. VPS Initial Setup

```bash
# SSH into your VPS
ssh root@YOUR_VPS_IP

# Update system
apt update && apt upgrade -y

# Install Node.js 18 (via NodeSource)
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt install -y nodejs

# Install Yarn
npm install -g yarn

# Install PostgreSQL
apt install -y postgresql postgresql-contrib

# Install Nginx (reverse proxy)
apt install -y nginx

# Install Certbot for HTTPS
apt install -y certbot python3-certbot-nginx

# Install PM2 (process manager)
npm install -g pm2
```

---

## 2. Set Up PostgreSQL

```bash
# Switch to postgres user
sudo -u postgres psql

-- Create database and user
CREATE USER healthlogger WITH PASSWORD 'your_secure_password_here';
CREATE DATABASE healthlogger OWNER healthlogger;
GRANT ALL PRIVILEGES ON DATABASE healthlogger TO healthlogger;
\q
```

Your DATABASE_URL will be:
```
postgresql://healthlogger:your_secure_password_here@localhost:5432/healthlogger
```

---

## 3. Deploy the App

```bash
# Create app directory
mkdir -p /var/www/health-logger
cd /var/www/health-logger

# Extract the package (upload health-logger-selfhost.tar.gz first)
tar xzf /path/to/health-logger-selfhost.tar.gz

# Install dependencies
yarn install

# Generate Prisma client
yarn prisma generate

# Create your .env file
cp .env.example .env
nano .env   # Edit with your values (see section 4)

# Push database schema
yarn prisma db push

# (Optional) Seed initial data
yarn tsx scripts/seed.ts

# Build the app
yarn build

# Start with PM2
pm2 start npm --name "health-logger" -- start
pm2 save
pm2 startup   # Follow the output command to enable auto-start on reboot
```

---

## 4. Environment Variables (.env)

Create a `.env` file with these values:

```env
# === DATABASE ===
DATABASE_URL="postgresql://healthlogger:your_secure_password_here@localhost:5432/healthlogger"

# === LLM API (see section 5 for options) ===
OPENAI_API_KEY="sk-your-openai-api-key"
OPENAI_BASE_URL="https://api.openai.com/v1"

# === PUSH NOTIFICATIONS ===
# Generate new VAPID keys: npx web-push generate-vapid-keys
NEXT_PUBLIC_VAPID_PUBLIC_KEY="your-vapid-public-key"
VAPID_PRIVATE_KEY="your-vapid-private-key"

# === EMAIL (see section 6) ===
SMTP_HOST="smtp.gmail.com"
SMTP_PORT="587"
SMTP_USER="your-email@gmail.com"
SMTP_PASS="your-app-password"
EMAIL_FROM="Health Logger <your-email@gmail.com>"

# === APP URL ===
NEXTAUTH_URL="https://yourdomain.com"
```

---

## 5. LLM API — What Needs to Change

The app currently calls the Abacus AI LLM endpoint. You need to switch it to OpenAI (or any OpenAI-compatible provider like Anthropic via a proxy, OpenRouter, etc.).

**Files to modify:**

### `app/api/chat/route.ts` (line ~529)
Change:
```typescript
const response = await fetch('https://apps.abacus.ai/v1/chat/completions', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${process.env.ABACUSAI_API_KEY}`,
  },
  body: JSON.stringify({
    model: 'claude-sonnet-4-6',
```

To:
```typescript
const response = await fetch(`${process.env.OPENAI_BASE_URL}/chat/completions`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
  },
  body: JSON.stringify({
    model: 'gpt-4o',  // or your preferred model
```

### `app/api/reports/doctor-summary/route.ts` (line ~69)
Same change — replace the Abacus URL/key with your OpenAI ones, and change the model from `gpt-5.4-mini` to `gpt-4o-mini` (or similar).

### `app/layout.tsx`
Remove this line (it's an Abacus-specific script):
```html
<script src="https://apps.abacus.ai/chatllm/appllm-lib.js"></script>
```

---

## 6. Email — What Needs to Change

The app currently uses the Abacus AI notification API for emails. You need to replace it with a standard SMTP approach (Nodemailer).

### Install Nodemailer:
```bash
yarn add nodemailer
yarn add -D @types/nodemailer
```

### Replace `app/api/email-summary/route.ts`
Find the section near line 222 that calls `https://apps.abacus.ai/api/sendNotificationEmail` and replace it with:

```typescript
import nodemailer from 'nodemailer';

// ... (keep all the existing HTML body building code) ...

// Replace the Abacus email fetch with:
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

await transporter.sendMail({
  from: process.env.EMAIL_FROM,
  to: recipientEmail,
  subject: `Health Summary — ${periodLabel}`,
  html: htmlBody,  // the HTML string you already build
});
```

**Gmail tip:** Use an [App Password](https://myaccount.google.com/apppasswords) — not your regular Gmail password.

---

## 7. Push Notification Cron Jobs

The app has 3 daily push reminders (8 AM, 1 PM, 8 PM Central). On Abacus these were scheduled tasks. On your VPS, set them up as cron jobs:

```bash
crontab -e
```

Add these lines (adjust timezone — the VPS should be set to America/Chicago or use TZ):
```cron
# Morning reminder - 8:00 AM Central
0 8 * * * curl -X POST http://localhost:3000/api/push/send -H "Content-Type: application/json" -d '{"title":"Good Morning! ☀️","body":"Time to log your morning BP and meds."}'

# Midday reminder - 1:00 PM Central  
0 13 * * * curl -X POST http://localhost:3000/api/push/send -H "Content-Type: application/json" -d '{"title":"Midday Check-in 🩺","body":"Have you taken your midday medications?"}'

# Evening reminder - 8:00 PM Central
0 20 * * * curl -X POST http://localhost:3000/api/push/send -H "Content-Type: application/json" -d '{"title":"Evening Wrap-up 🌙","body":"Log your evening BP and meds before bed."}'
```

Set your VPS timezone:
```bash
timedatectl set-timezone America/Chicago
```

---

## 8. Nginx Reverse Proxy + HTTPS

```bash
nano /etc/nginx/sites-available/health-logger
```

Paste:
```nginx
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

```bash
# Enable the site
ln -s /etc/nginx/sites-available/health-logger /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx

# Get SSL certificate
certbot --nginx -d yourdomain.com -d www.yourdomain.com
```

---

## 9. Prisma Schema — Fix Output Path

Before running on your VPS, update `prisma/schema.prisma`:

Change:
```prisma
output = "/home/ubuntu/health_logger/nextjs_space/node_modules/.prisma/client"
```

To:
```prisma
output = "../node_modules/.prisma/client"
```

(Or simply remove the `output` line entirely — Prisma defaults to `node_modules/.prisma/client`)

---

## 10. next.config.js — Simplify

The `experimental.outputFileTracingRoot` and `NEXT_DIST_DIR` / `NEXT_OUTPUT_MODE` env vars are Abacus-specific. Simplify `next.config.js` to:

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: false },
  images: { unoptimized: true },
};

module.exports = nextConfig;
```

---

## Summary of Changes Needed

| What | Current (Abacus) | Self-Hosted Replacement |
|---|---|---|
| LLM API | `apps.abacus.ai/v1/chat/completions` | OpenAI / OpenRouter / any OpenAI-compatible |
| LLM models | `claude-sonnet-4-6`, `gpt-5.4-mini` | `gpt-4o`, `gpt-4o-mini` (or equivalent) |
| Email sending | Abacus notification API | Nodemailer + SMTP (Gmail, etc.) |
| Push cron jobs | Abacus scheduled tasks | Linux crontab |
| Database | Abacus-hosted PostgreSQL | Self-hosted PostgreSQL |
| VAPID keys | Abacus .env | Generate new: `npx web-push generate-vapid-keys` |
| Prisma output path | Hardcoded absolute path | Relative `../node_modules/.prisma/client` |
| `next.config.js` | Abacus build flags | Simplified standard config |
| Layout script | `appllm-lib.js` | Remove |

---

## Hostinger DNS Setup

In your Hostinger control panel:
1. Go to **Domains** → your domain → **DNS Zone**
2. Add/edit an **A record**: `@` → your VPS IP address
3. Add an **A record**: `www` → your VPS IP address
4. Wait for propagation (usually 5-15 min with Hostinger)

---

## Ongoing Maintenance

```bash
# View logs
pm2 logs health-logger

# Restart after code changes
cd /var/www/health-logger
yarn build
pm2 restart health-logger

# Database backup (set up as a daily cron)
pg_dump -U healthlogger healthlogger > /backups/healthlogger_$(date +%Y%m%d).sql
```

That's it! 🎉
