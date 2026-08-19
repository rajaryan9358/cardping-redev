# Environment variables

Copy [`server/.env.example`](../server/.env.example) to `server/.env` and fill it in. Validated
at startup by `server/src/config/env.ts` — if anything required is missing or malformed, the
process exits immediately with a list of exactly what's wrong (rather than failing confusingly
later, mid-request).

## Server

| Variable | Required | Notes |
|---|---|---|
| `PORT` | No (default `3000`) | Port the Express app listens on |
| `PUBLIC_BASE_URL` | Yes | The publicly-reachable base URL of this server (e.g. `https://cardping.example.com`), no trailing slash. Used to build the Google OAuth redirect URI and to log webhook URLs on startup |
| `LOG_LEVEL` | No (default `info`) | `pino` log level (`debug`, `info`, `warn`, `error`) |

## Supabase

| Variable | Required | Notes |
|---|---|---|
| `SUPABASE_URL` | Yes | Your Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | **Service-role** key — full DB + Storage access, bypasses row-level security. Only ever used server-side; never expose it to a client |
| `SUPABASE_STORAGE_BUCKET_CARDS` | No (default `visiting-cards`) | Bucket card photos are uploaded to |
| `SUPABASE_STORAGE_BUCKET_VOICE` | No (default `voice-notes`) | Bucket voice notes are uploaded to |

## WhatsApp Cloud API

| Variable | Required | Notes |
|---|---|---|
| `WHATSAPP_ACCESS_TOKEN` | Yes | A **permanent** token for a Meta System User (Business Settings → System Users → Generate Token). A temporary 24h token from the API Setup page will expire and break the bot |
| `WHATSAPP_VERIFY_TOKEN` | Yes | Any string you choose — must match the "Verify token" you enter when configuring the webhook in the Meta App Dashboard |
| `WHATSAPP_PHONE_NUMBER_ID` | Yes | Default phone number id to send from for server-initiated sends (e.g. the Cashfree payment-confirmation message). Normal replies use the `phone_number_id` from the inbound webhook automatically, so this matters less than it sounds |
| `WHATSAPP_APP_SECRET` | Recommended | Meta App secret, used to verify the `X-Hub-Signature-256` header on every inbound webhook. If unset, signature verification is skipped (logged as a warning) — fine for local dev, not for production |
| `WHATSAPP_GRAPH_API_VERSION` | No (default `v23.0`) | Graph API version segment used in every URL |
| `WHATSAPP_BUSINESS_ACCOUNT_ID` | Optional | The WABA ID (Meta Business Manager → WhatsApp Manager → API Setup) — **distinct from `WHATSAPP_PHONE_NUMBER_ID`**. `server/` itself never reads this; it's read out of this file by `admin/` (via `appEnvFiles`, same mechanism as every other cross-app secret read) to populate the template dropdown on the Broadcasts and Send Message screens. Until it's set, those screens fall back to manual template-name entry — nothing breaks, it's just not autocompleted |

See [WHATSAPP_TEMPLATES.md](./WHATSAPP_TEMPLATES.md) for the Meta App Dashboard setup this
depends on.

## Telegram Bot API

| Variable | Required | Notes |
|---|---|---|
| `TELEGRAM_BOT_TOKEN` | Yes | From [@BotFather](https://t.me/BotFather) |
| `TELEGRAM_WEBHOOK_SECRET` | Yes | Any string you choose. Sent back by Telegram in `X-Telegram-Bot-Api-Secret-Token` on every webhook call, so the route can reject calls that don't have it. Set via `npm run register:telegram-webhook` (see [DEPLOYMENT.md](./DEPLOYMENT.md)) |

## OpenAI

| Variable | Required | Notes |
|---|---|---|
| `OPENAI_API_KEY` | Yes | Used for card extraction, voice transcription, and email copywriting |
| `OPENAI_VISION_MODEL` | No (default `gpt-4o`) | Model used to extract card fields from a photo |
| `OPENAI_TRANSCRIBE_MODEL` | No (default `whisper-1`) | Model used to transcribe voice notes |
| `OPENAI_EMAIL_MODEL` | No (default `gpt-4o`) | Model used to draft follow-up emails |

## Coins / billing

| Variable | Required | Notes |
|---|---|---|
| `COINS_PER_CARD_SCAN` | No (default `1`) | Coins charged per card scan |
| `COINS_STARTER_BALANCE` | No (default `5`) | Coins a brand-new user starts with — also the onboarding trial grant on a new dashboard account (see below) |

## dashboard/ auth (see docs/DASHBOARD_PLAN.md)

Email/password login and Telegram channel-linking work with no extra setup. Google login and
WhatsApp OTP login/channel-linking are each optional as a group — leave their variables blank and
`GET /api/auth/config` reports them disabled, so the dashboard renders those buttons
disabled-with-a-tooltip instead of a dead click.

| Variable | Required | Notes |
|---|---|---|
| `SESSION_COOKIE_NAME` | No (default `cardping_session`) | Distinct from admin/'s `cardping_admin_session` — the two apps' sessions never collide |
| `SESSION_TTL_HOURS` | No (default `720`, i.e. 30 days) | |
| `GOOGLE_DASHBOARD_OAUTH_REDIRECT_URI` | For Google login | A **second** "Authorized redirect URI" on the same Google OAuth client used above for Gmail — must be distinct from `GOOGLE_OAUTH_REDIRECT_URI`, e.g. `https://your-domain/api/auth/google/callback` |
| `WHATSAPP_LOGIN_OTP_TEMPLATE_NAME` | For WhatsApp OTP | Name of a Meta Business Manager **Authentication**-category template, approved for sending login codes |
| `WHATSAPP_CHANNEL_LINK_OTP_TEMPLATE_NAME` | No | Defaults to `WHATSAPP_LOGIN_OTP_TEMPLATE_NAME` — only set separately if Meta's review requires a distinct template for channel-linking vs. login |
| `TELEGRAM_BOT_USERNAME` | For Telegram channel linking | The bot's public `@username`, without the `@` — used to build the `t.me/<bot>?start=<code>` deep link |
| `DASHBOARD_BASE_URL` | No | Defaults to `PUBLIC_BASE_URL` — base URL for the "complete your account" link the bot sends a WhatsApp/Telegram user with no linked dashboard account yet (sent on every message until they link). Only needs overriding in a local setup where `dashboard/` runs on a different port with no shared reverse proxy |

`dashboard/`'s own env (`dashboard/.env.example`) only needs `SERVER_API_BASE_URL` — everything
else above lives in `server/.env` since `server/` is what actually calls Meta/Google/Cashfree.

## Google OAuth (Gmail follow-up drafts)

Optional as a group — leave both `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` blank and the
Gmail follow-up feature is simply skipped (no draft email is offered after a scan; "Connect
Gmail" in Account Settings tells the user it isn't configured).

| Variable | Required | Notes |
|---|---|---|
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | For this feature | From a Google Cloud OAuth 2.0 Client ID (type "Web application") with the Gmail API enabled |
| `GOOGLE_OAUTH_REDIRECT_URI` | No | Defaults to `${PUBLIC_BASE_URL}/oauth/google/callback`. Must exactly match an "Authorized redirect URI" on the OAuth client — only set this explicitly if you need it to differ from the default |

Required scope: `https://www.googleapis.com/auth/gmail.compose` (drafts only — this app never
sends email on the user's behalf without them reviewing it first).

## Cashfree Payment Links (coin top-up)

Optional as a group — leave `CASHFREE_CLIENT_ID`/`CASHFREE_CLIENT_SECRET` blank and "Buy Credits"
tells the user top-ups aren't configured yet.

| Variable | Required | Notes |
|---|---|---|
| `CASHFREE_CLIENT_ID` / `CASHFREE_CLIENT_SECRET` | For this feature | From the Cashfree merchant dashboard |
| `CASHFREE_BASE_URL` | No (default sandbox) | `https://sandbox.cashfree.com/pg` for testing, `https://api.cashfree.com/pg` for production — **the original workflow shipped with sandbox/test keys; switch this before taking real payments** |
| `CASHFREE_API_VERSION` | No (default `2025-01-01`) | Cashfree API version header |
| `CASHFREE_RETURN_URL` | For this feature | Where Cashfree redirects the payer's browser after paying (a simple thank-you page — not the webhook) |
| `COIN_TOPUP_AMOUNT_INR` | No (default `1000`) | Amount charged per top-up link, in INR |
| `COIN_TOPUP_COINS` | No (default `50`) | Coins credited per successful top-up |
