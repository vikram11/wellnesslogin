# WellnessLog.in — Project Summary

> *Your health, simplified. Your day, supported.*

WellnessLog.in is a gentle, intelligent companion for anyone managing a health condition — whether it's blood pressure, medications, physical therapy, or just staying on top of daily well-being. Think of it as a caring corner of the internet where your health data lives alongside you, not in a cold hospital portal.

**No account setup required.** Open the site, set a password once, and you're in. Log your morning BP reading, tap off which medications you took, chat with an AI that knows your health context, and customize push reminders that buzz your phone at exactly the right moment — "Time for your midday meds" or "Don't forget your PT exercises." A daily email summary keeps your doctor or family in the loop without them needing an account either.

Built for real people — caregivers, parents, patients — who need something that *just works* on a phone, that doesn't ask for an app store download, that respects privacy with a simple password, and that sends reliable push notifications on schedule. No fluff. No data sold. Just a well-made tool for the hardest job there is: taking care of yourself or someone you love.

---

## Overview

WellnessLog.in is a **Next.js** single-page application designed to help manage daily wellness tracking — primarily for medication adherence, BP readings, health observations, and AI-assisted check-ins. It's deployed via Docker on a Hostinger VPS with a Neon PostgreSQL database and Caddy reverse proxy.

---

## Architecture

| Layer | Technology | Details |
|---|---|---|
| **Frontend** | Next.js (React, TypeScript, Tailwind) | Client-rendered `'use client'` SPA with tab-based navigation |
| **Backend** | Next.js API Routes (server in same container) | CRUD endpoints for BP, medications, observations, chat, notifications, email |
| **Database** | Neon PostgreSQL (serverless) | Prisma ORM, ~8 tables |
| **AI Chat** | Ollama (`gemma4:31b-cloud`) | Chat API with system prompt, medical context, vision support |
| **Push Notifications** | Web Push API (VAPID) | Service worker + `web-push` library for browser push |
| **Email** | Hostinger SMTP (`update@wellnesslog.in`) | Daily summary reports |
| **Auth** | NextAuth.js (credentials-only) | Basic login by email |
| **Deployment** | GitHub Container Registry → Docker Compose → VPS | Automated CI/CD via GitHub Actions |
| **Reverse Proxy** | Caddy | Auto-TLS/SSL, proxy to port 3000 |

---

## Database Models (8 tables)

1. **BpReading** — BP readings (systolic, diastolic, pulse, context, notes)
2. **Medication** — Medication definitions (name, dosage, timeSlot, active dates)
3. **MedicationLog** — Daily medication compliance logs (which meds taken per time slot)
4. **Observation** — Text observations/notes with category and severity
5. **DailyNote** — Free-form daily notes
6. **PushSubscription** — Browser push notification subscriptions (endpoint, p256dh, auth)
7. **SavedRecipient** — Email recipient addresses for daily summaries
8. **UserProfile** — User profile content for AI context
9. **ChatMessage** — Chat history (user + assistant, with optional image data)
10. **DailyEmailSchedule** — Email schedule config (enabled, sendTime, recipientIds)
11. **Notification** — Push notification schedule (label, time, type, enabled, daysOfWeek)

---

## Features Delivered

### Before This Session (already existing)
- BP reading entry and charting
- Medication tracking with AM/MID/PM compliance logging
- Observations & daily notes
- AI chat with medical context / vision support (Ollama)
- Email summary panel (CRUD recipients, toggle)
- Push notification subscription (browser permission)
- Daily email cron job (every minute → sends at scheduled time)
- Password gate (basic localStorage-based lock)
- Dark mode toggle
- Reports tab

### Built / Fixed in This Session

| Feature | What Changed |
|---|---|
| 🔧 **Docker CI/CD** | Fixed `.github/workflows/docker-publish.yml` — was checking out wrong context, missing build-args |
| 🔧 **NEXT_PUBLIC VAPID Key** | Added as Docker build arg + GitHub secret. Previously was runtime-only, so client JS couldn't find it → push subscription failed silently |
| 🔔 **Notification Drawer** | Slide-up drawer (mobile-first) replacing the old bell toggle. Shows 3 fixed medication reminders + custom ones |
| ⏰ **Notification Scheduling** | New `Notification` DB table + CRUD API + `/api/notifications/check` endpoint fired every minute by cron |
| 🔧 **Email Daily Summary** | Fixed Prisma `@map` annotations for `send_time` → `sendTime` mapping. Toggle now works properly |
| 🔧 **Email Cron Fix** | Changed crontab from `curl localhost:3000` (port not exposed) to `docker exec` |
| 🔐 **One-Time Password** | Password now stores a `trusted_device` flag in localStorage. Enter once, never asked again (until cache cleared) |
| 🚫 **noindex SEO** | Added `<meta name="robots" content="noindex">` to `<head>` — prevents search engines indexing |
| 🔧 **PasswordGate unlock regression** | Fixed `setUnlocked(true)` that was being called with wrong ref |
| 🔧 **Dockerfile build failure** | Fixed `cd` vs `COPY` issue in Dockerfile stages |

---

## Deployment Pipeline

```
Push to main → GitHub Actions build → Push image to ghcr.io/vikram11/wellnesslogin:latest
                                      → VPS cron pulls new image every minute
                                      → Caddy reverse proxies wellnesslog.in → container:3000
```

**Cron jobs on VPS (every minute):**
```
docker exec wellnesslog-in-app-1 wget -qO- http://localhost:3000/api/email-scheduled
docker exec wellnesslog-in-app-1 wget -qO- http://localhost:3000/api/notifications/check
```

---

## File Structure (nextjs_space/)

```
nextjs_space/
├── app/
│   ├── api/
│   │   ├── chat/          # AI chat endpoint
│   │   ├── email-schedule/ # Email schedule CRUD
│   │   ├── email-scheduled/ # Cron check for email sending
│   │   ├── notifications/  # Notification CRUD + /check sub-route
│   │   ├── push/           # Push subscription + send
│   │   ├── user-profile/   # User profile CRUD
│   │   └── ...
│   ├── layout.tsx          # Root layout (password gate + app shell)
│   └── ...
├── components/
│   ├── app-shell.tsx       # Main app container (tabs, header, drawer)
│   ├── notification-drawer.tsx  # Slide-up drawer for notification settings
│   ├── password-gate.tsx   # One-time password screen
│   ├── chat-panel.tsx
│   ├── email-panel.tsx
│   └── ...
├── lib/
│   ├── prisma.ts           # Prisma client singleton
│   └── system-prompt.ts    # AI system prompt
├── prisma/schema.prisma    # Database schema
├── Dockerfile              # Multi-stage build
└── package.json
```

---

## VPS Server

- **IP:** 157.173.222.202
- **User:** root
- **Key:** `wellnesslogin_deploy`
- **Deploy path:** `/docker/wellnesslog-in/`
- **Reverse proxy:** Caddy (external `caddy_network` net)
- **Database:** Neon PostgreSQL (ep-hidden-boat-ajjf9pbs)
- **AI:** Ollama cloud instance

---

## Key Environment Variables

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Neon PostgreSQL connection string |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | Web Push public key (embedded in client JS at build) |
| `VAPID_PRIVATE_KEY` | Web Push private key (server-side only) |
| `OLLAMA_API_KEY` | Ollama cloud API key |
| `OLLAMA_MODEL` | `gemma4:31b-cloud` |
| `SMTP_HOST/PORT/USER/PASS` | Hostinger SMTP for email |
| `NEXTAUTH_URL` | `https://wellnesslog.in` |

---

## What Was Recovered

This project was partially built by an "Abacus Agent" on another platform, then handed off. The GitHub repo existed at `github.com/vikram11/wellnesslogin` but needed authentication re-established (SSH key `wellnesslogin_github`). The local checkout was recovered in `c:\Users\Vikram\OneDrive\Apps\Wellnesslog.in` and reconnected to origin. From there all fixes, features, and deployments were completed.

---

*Generated: May 23, 2026*