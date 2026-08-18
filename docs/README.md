# CardPing — Documentation

CardPing turns a photo of a business card, sent to a WhatsApp or Telegram bot, into a saved
contact — with an optional voice-note transcript and an AI-drafted follow-up email. This is a
from-scratch Node.js/TypeScript rewrite of what used to be two separate n8n workflows (one per
channel), unified onto a single Supabase backend.

This directory is the full documentation set. Start here, then go to whichever page matches
what you're trying to do:

| Doc | Read this when you want to... |
|---|---|
| [ARCHITECTURE.md](./ARCHITECTURE.md) | Understand how the system is put together, and why it's shaped this way |
| [MIGRATION_NOTES.md](./MIGRATION_NOTES.md) | See exactly what changed vs. the original n8n workflows, and why |
| [DATABASE.md](./DATABASE.md) | Understand the Supabase schema — every table, view, and function |
| [ENVIRONMENT.md](./ENVIRONMENT.md) | Look up what an environment variable does |
| [SETUP.md](./SETUP.md) | Get the project running locally |
| [DEPLOYMENT.md](./DEPLOYMENT.md) | Ship it to a VPS (manual/generic instructions) |
| [HOSTINGER_VPS_SETUP.md](./HOSTINGER_VPS_SETUP.md) | One-time setup of a bare Hostinger VPS |
| [CI_CD.md](./CI_CD.md) | How the GitHub Actions CI/CD pipeline works, and what secrets it needs |
| [WHATSAPP_TEMPLATES.md](./WHATSAPP_TEMPLATES.md) | Configure the Meta App / WhatsApp Cloud API side |
| [ADMIN_APP.md](./ADMIN_APP.md) | Understand `admin/`, the staff-only app for managing users, cards, events, bot health, broadcasts, and env vars |

## The 30-second version

- **Three apps, one repo.** `server/` (the two bots + webhooks), `dashboard/` (the customer-facing
  Next.js app), and `admin/` (the staff-only Next.js app — see [ADMIN_APP.md](./ADMIN_APP.md)) are
  independently deployed processes, not a shared monorepo package setup — each has its own
  `package.json`, builds, and pm2 process.
- **One codebase, two bots.** `server/src/bots/whatsapp` and `server/src/bots/telegram` are thin,
  channel-specific layers (parsing the inbound payload, sending replies in that channel's
  format). Everything that isn't channel-specific — OCR extraction, coin balance, event
  tracking, email drafting — lives once in `server/src/services` and is shared.
- **One backend.** Both bots read/write the same Supabase Postgres database. The original
  Telegram workflow wrote to Google Sheets instead; that's gone; see
  [MIGRATION_NOTES.md](./MIGRATION_NOTES.md#1-one-shared-supabase-backend).
- **Meta's WhatsApp Cloud API only.** No Twilio anywhere in this codebase, by design — see
  [MIGRATION_NOTES.md](./MIGRATION_NOTES.md#2-whatsapp-transport).
- **Plain webhooks, not queues.** Both bots are `POST /webhooks/...` handlers in one Express app.
  There's no n8n-style paused execution waiting for the user's next message — instead, a small
  bit of state on the `users` row (`user_state`) remembers what the bot is expecting next. See
  [ARCHITECTURE.md](./ARCHITECTURE.md#conversation-state) for why that's necessary and how it
  works.
