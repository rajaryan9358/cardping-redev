# Deployment (VPS)

> Deploying to a Hostinger VPS with GitHub Actions doing the deploys for you? Start with
> [HOSTINGER_VPS_SETUP.md](./HOSTINGER_VPS_SETUP.md) for one-time server provisioning, then
> [CI_CD.md](./CI_CD.md) for how the automated deploy works. What follows below is the
> manual/generic version of the same thing (any VPS, deploying by hand) — useful for understanding
> what the automated deploy is actually doing, or if you'd rather not wire up CI/CD at all.

Two ways to run this in production; pick one. Either way, you need:

- A domain (or subdomain) pointed at your VPS, with HTTPS — Meta and Telegram both require HTTPS
  webhook URLs, no exceptions.
- All the environment variables from [ENVIRONMENT.md](./ENVIRONMENT.md) filled in for real
  (production Cashfree keys, a permanent WhatsApp token, etc — not the sandbox/dev values).
- The database schema applied (see [DATABASE.md](./DATABASE.md)) — this is a one-time step
  against your Supabase project, not something either deployment method does for you.

## Option A: PM2 (run directly on the VPS)

```bash
# On the VPS
git clone <your-repo> cardping && cd cardping/server
npm install --omit=dev
npm run build
cp .env.example .env   # then fill it in
npm install -g pm2
pm2 start ecosystem.config.js
pm2 save
pm2 startup            # prints a command to run so PM2 survives a reboot — run it
```

Useful commands: `pm2 logs cardping-server`, `pm2 restart cardping-server` (after a deploy),
`pm2 status`.

## Option B: Docker

```bash
cd cardping/server
cp .env.example .env   # then fill it in
docker compose up -d --build
```

`docker-compose.yml` builds the image from the included `Dockerfile` and runs it on port 3000,
reading config from `.env`. Redeploy with `docker compose up -d --build` after pulling changes.

## Reverse proxy + TLS (both options)

Neither option above terminates TLS itself — put nginx (or Caddy) in front. Example nginx config:

```nginx
server {
    listen 80;
    server_name cardping.example.com;
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Then `sudo certbot --nginx -d cardping.example.com` (via [Certbot](https://certbot.eff.org/)) to
get a free TLS certificate and have nginx listen on 443 automatically.

## After deploying: register the webhooks

- **WhatsApp:** set the webhook URL in the Meta App Dashboard to
  `https://cardping.example.com/webhooks/whatsapp` — see
  [WHATSAPP_TEMPLATES.md](./WHATSAPP_TEMPLATES.md#meta-app-dashboard-setup).
- **Telegram:** from the server (so it reads the production `.env`):
  ```bash
  npm run register:telegram-webhook
  ```
- **Google OAuth:** add `https://cardping.example.com/oauth/google/callback` as an authorized
  redirect URI on the OAuth client in Google Cloud Console.
- **Cashfree webhook:** see below.

## Cashfree webhook

Cashfree Payment Links send their payment-status webhook to whatever URL is configured for your
merchant account, not to a per-link `notify_url`. In the Cashfree dashboard: **Developers →
Webhooks** → add `https://cardping.example.com/webhooks/cashfree`, subscribed to payment-link
events. `routes/cashfreeWebhook.route.ts` verifies the `x-webhook-signature` header against
`CASHFREE_CLIENT_SECRET` before crediting any coins.

## Zero-downtime-ish redeploys

Both PM2 and Docker Compose restart with a brief gap (a few hundred ms to a couple seconds), which
is fine here — Meta and Telegram retry failed webhook deliveries, so a request that lands during a
restart isn't lost, just delayed. If you need truly zero-downtime deploys, put two instances
behind nginx and reload one at a time — not set up by default since it's unlikely to be needed at
this scale.

## Logs

`pino` logs structured JSON to stdout in production (pretty-printed only when `NODE_ENV` isn't
`production`). With PM2: `pm2 logs`. With Docker: `docker compose logs -f app`.
