# Local setup

## Prerequisites

- Node.js 20+
- A Supabase project (free tier is fine)
- API keys for whichever features you want active — see [ENVIRONMENT.md](./ENVIRONMENT.md).
  At minimum you need Supabase, a WhatsApp Cloud API or Telegram bot, and an OpenAI key; Gmail
  and Cashfree are optional.
- For receiving webhooks locally: a tunnel tool like [ngrok](https://ngrok.com) or
  [Cloudflare Tunnel](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/)
  — Meta and Telegram both need a public HTTPS URL, they can't call `localhost`.

## 1. Install dependencies

```bash
cd server
npm install
```

## 2. Apply the database schema

In the Supabase SQL Editor (or via `psql`), run [`server/db/schema.sql`](../server/db/schema.sql)
once. See [DATABASE.md](./DATABASE.md) for what it creates.

## 3. Configure environment variables

```bash
cp .env.example .env
```

Fill in `.env` — see [ENVIRONMENT.md](./ENVIRONMENT.md) for what each variable means and where
to get it. Set `PUBLIC_BASE_URL` to your tunnel's HTTPS URL for local development.

## 4. Run it

```bash
npm run dev
```

This starts the server with `tsx watch` (auto-restarts on file changes). Confirm it's up:

```bash
curl http://localhost:3000/health
```

## 5. Point the tunnel at it

```bash
ngrok http 3000
```

Use the `https://...ngrok-free.app` URL ngrok prints as your `PUBLIC_BASE_URL`.

## 6. Register the webhooks

- **Telegram:** `npm run register:telegram-webhook` (reads `PUBLIC_BASE_URL` and
  `TELEGRAM_WEBHOOK_SECRET` from `.env`). To go back to polling/remove it later:
  `npm run unregister:telegram-webhook`.
- **WhatsApp:** configured in the Meta App Dashboard, not via API — see
  [WHATSAPP_TEMPLATES.md](./WHATSAPP_TEMPLATES.md#webhook-configuration).
- **Google OAuth callback / Cashfree webhook:** no registration step, just make sure the URLs
  (`${PUBLIC_BASE_URL}/oauth/google/callback`, `${PUBLIC_BASE_URL}/webhooks/cashfree`) are
  entered in the respective dashboards — see [ENVIRONMENT.md](./ENVIRONMENT.md) and
  [DEPLOYMENT.md](./DEPLOYMENT.md#cashfree-webhook).

## 7. Try it

Message your WhatsApp number or Telegram bot: send a photo of a business card. You should get a
menu on first contact, be asked to set an event, and then get an extracted-fields reply + contact
card once you send a photo.

## Type-checking and building

```bash
npm run typecheck   # tsc --noEmit, no output written
npm run build        # compiles to dist/
npm start             # runs the compiled build (dist/src/index.js)
```
