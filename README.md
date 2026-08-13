# CardPing

Scan a business card over WhatsApp or Telegram → get the contact details back, saved to
Supabase, with an optional voice-note transcript and an AI-drafted follow-up email.

This repo is a standalone Node.js/TypeScript rewrite of two n8n workflows (`old-project/`) into
one deployable app (`server/`).

- **`server/`** — the app. See [`server/package.json`](server/package.json) for scripts.
- **`docs/`** — full documentation. **Start at [`docs/README.md`](docs/README.md).**
- **`old-project/`** — the original n8n workflow exports and Supabase schema this was rebuilt
  from, kept for reference. See [`docs/MIGRATION_NOTES.md`](docs/MIGRATION_NOTES.md) for exactly
  what changed and why.

## Quick start

```bash
cd server
npm install
cp .env.example .env   # fill in — see docs/ENVIRONMENT.md
npm run dev
```

Then see [`docs/SETUP.md`](docs/SETUP.md) for exposing it to WhatsApp/Telegram locally, and
[`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) when you're ready to put it on a VPS.

## CI/CD

Pushing to `main` runs [`.github/workflows/ci.yml`](.github/workflows/ci.yml) (typecheck + build)
and [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) (deploys to a Hostinger VPS
over SSH). First-time VPS setup: [`docs/HOSTINGER_VPS_SETUP.md`](docs/HOSTINGER_VPS_SETUP.md).
How the pipeline works and which GitHub secrets it needs: [`docs/CI_CD.md`](docs/CI_CD.md).
