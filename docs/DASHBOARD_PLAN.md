# CardPing Dashboard — v1 plan

Desktop-only web dashboard on top of the existing `server/` backend. This is the planning
document — no dashboard code exists yet. Screens are being designed first (see
[DASHBOARD_STITCH_PROMPT.md](./DASHBOARD_STITCH_PROMPT.md)) before implementation starts.

## Context

The bots scan cards into Supabase but there's no way for a user to see or work what they've
scanned, and no unified way to pay. This plan adds a desktop web dashboard: full multi-method
login, an account that can have both a WhatsApp and a Telegram channel linked to it, a directory
of scanned contacts with tagging/bulk actions, event management, and subscription/coin billing —
plus minimum super-admin tooling. It reuses `server/`'s existing Supabase backend, WhatsApp
client, and Cashfree integration. Tarun is concurrently doing Telegram→Supabase migration and bot
reliability work against the same database, so schema changes stay additive, and the one place
this plan *does* need to touch existing bot-charging code (moving coins from per-channel to
per-account) is called out explicitly below as needing coordination with him, not a silent change.

Decisions already confirmed:
- **Frontend**: separate Next.js app, calling `server/` as a JSON API.
- **Login-triggered OTP delivery (WhatsApp)**: sent directly from `server/` via the Meta API, no
  n8n — but this requires an approved WhatsApp **Authentication** Message Template (a business
  can't cold-send free text to a number that's never messaged it; Authentication templates are
  Meta's purpose-built exception for OTP). `whatsappClient.sendTemplate` already exists for this;
  creating and getting the template approved in Meta Business Manager is a one-time setup
  dependency, not a code gap.
- **Billing**: manual-renewal (one-time Cashfree Payment Links extend an expiry date), not
  auto-charge subscriptions — reuses the exact pattern already built for coin top-ups.
- **Wallet scope**: coins/plan live on the new `accounts` table (one wallet per account, shared
  across linked channels), not per-channel. This means `coinService` needs to resolve which
  account (if any) a bot-side scan belongs to — see [Wallet migration](#wallet-migration) below
  for how that's kept low-risk against Tarun's parallel work.
- **Telegram channel linking**: not a typed OTP (Telegram bots can't message someone who hasn't
  pressed "Start" first) — a deep-link (`t.me/<bot>?start=<code>`) the dashboard shows, which the
  user taps; the bot confirms the link server-side when that `/start` arrives. WhatsApp linking
  *is* a real typed OTP (same Authentication-template mechanism as login).

## Identity model

Two separate concepts, deliberately not merged:

- **`users`** (existing table, untouched schema) — a *channel* identity: one row per WhatsApp
  number or Telegram account that has ever messaged a bot. This is what `visiting_cards`,
  `events`, and the bots' own state (`active_event_id`, `user_state`, ...) hang off, exactly as
  today. A person can have zero, one, or two `users` rows (WhatsApp and/or Telegram) without ever
  touching the dashboard at all — the bots keep working standalone.
- **`accounts`** (new table) — a *dashboard login* identity: email/password, Google, and/or
  verified-mobile-OTP, plus the wallet (`coin_balance`, `plan_id`, `plan_expires_at`) and role.
  An account links to zero or more `users` rows via `channel_links`.
- **`channel_links`** (new table) — `id, account_id, users_id (fk → users.id), channel
  ('whatsapp'|'telegram'), channel_identifier, verified_at, created_at`, with a **unique
  constraint on `(channel, channel_identifier)`** — this is what makes "already connected to
  another account" a database-enforced fact, not just an app-level check: linking fails fast, the
  dashboard shows *"this WhatsApp number is already connected to another CardPing account —
  disconnect it there first"*, and a disconnect action (only usable from the account that
  currently holds the link) removes the row so it can be relinked elsewhere.

No cross-method account merging in v1: each login method (email, google_id, mobile) looks up or
creates an account by its own key, independently. If the same person signs up once via Google and
later via mobile OTP, that's two accounts. Flagging this as a known v1 limitation rather than
solving identity merging now — it's a real feature, not a quick add.

## Wallet migration

`coinService.hasEnoughCoinsForScan` / `chargeForCardScan` currently read/write `users.coin_balance`
directly, called from both bots' scan handlers. Rather than rewriting those call sites (touching
files Tarun is actively working in), this plan adds one new module, `services/walletService.ts`,
that `coinService`'s two functions delegate to internally:

```
walletService.getBalance(botUserId)   // resolves account via channel_links; if linked, reads
                                       // accounts.coin_balance; if not linked, falls back to
                                       // the legacy users.coin_balance
walletService.charge(botUserId)       // same resolution, decrements wherever the balance lives
```

This keeps every existing bot file's diff to "a couple of lines in `coinService.ts`" rather than
threading account-resolution logic through `bots/whatsapp/handlers/image.ts` and
`bots/telegram/handlers/photo.ts` — and a bot user who never touches the dashboard keeps working
exactly as today, on their legacy per-`users` balance. This needs a short sync with Tarun before
landing (small diff, but it's in a file his reliability work likely also touches) — flagging as a
coordination step in the build order, not skipping it.

## Data model additions (all additive)

**New tables:**
- `accounts` — `id, email, email_verified_at, password_hash, google_id, mobile,
  mobile_verified_at, full_name, avatar_url, role ('user'|'admin'), blocked_at, onboarded_at,
  coin_balance, plan_id, plan_expires_at, created_at, updated_at`.
- `channel_links` — see above.
- `sessions` — `id, account_id, device_label, user_agent, created_at, last_seen_at, expires_at`.
  `device_label` (parsed from user-agent at creation) is what the "active sessions" list in
  Profile shows, so a user can tell which session is which before logging one out.
- `otp_codes` — `id, purpose ('login'|'channel_link'), target (mobile or channel identifier),
  code_hash, expires_at, attempts, consumed_at, created_at`. One table, `purpose` distinguishes a
  login OTP from a WhatsApp-channel-link OTP (same delivery mechanism, different consequence on
  verify).
- `plans` — `id, name, price_inr, period_days, coins_included, is_active`. A real table so pricing
  changes don't need a deploy; seeded with 1–2 rows for v1. Upgrade/downgrade is just "buy a
  different plan" (new payment link, `plan_id`/`plan_expires_at` overwritten on success) — no
  proration logic in v1.
- `invoices` — `id, account_id, transaction_id, invoice_number, buyer_gstin, amount, tax_amount,
  pdf_path, created_at`. `pdf_path` → new private Supabase Storage bucket `invoices`.

**`transactions`** (existing): extend `transaction_type` enum (additive) with
`'subscription_payment'` and `'admin_adjustment'`; add `account_id uuid null` alongside the
existing `user_id` (a purchase belongs to an account, not a channel identity).

**`visiting_cards`** (existing) gains:
- `archived boolean not null default false`
- `tags text[] not null default '{}'` (GIN index) — free-text, per-card, no separate tags table;
  supports filter (`tags @> ARRAY[...]`) and bulk-tag without a tag-management CRUD surface.
- `extraction_confidence numeric null` — GPT-4o vision already returns `confidence`
  (`ExtractedCard.confidence`) that's currently extracted and discarded; wiring it into
  `visitingCardsRepo.create` is what makes super-admin "low-confidence review" possible.

**`events`** (existing) gains: `location text null`, `event_date date null`, `thumbnail_path text
null`, `thumbnail_public_url text null` (same Supabase Storage upload pattern as card photos, new
`event-thumbnails` bucket).

**`users`** (existing) — no schema change. Blocking is enforced at the `accounts` level
(`accounts.blocked_at`); the bots additionally check "is this channel linked to a blocked
account" via `channel_links` at their existing entry-point gates, one small check added alongside
the coin-balance gate that's already there.

## API surface (new: `server/src/routes/api/`)

All behind `requireSession` (cookie → `sessions` row → `req.account`); admin routes additionally
require `role === 'admin'`; content routes (home/directory/events, not auth/billing) additionally
require `requireActivePlanOrTrial`.

- **Auth** — `POST /api/auth/signup`, `POST /api/auth/login` (email+password);
  `GET/POST /api/auth/google/start`, `GET /api/auth/google/callback` (separate route + separate
  redirect URI from the existing `routes/googleOAuth.route.ts`, which is the unrelated
  Gmail-follow-up-draft feature — same Google Cloud OAuth client, different scope/callback, so
  they don't collide); `POST /api/auth/otp/request`, `POST /api/auth/otp/verify`;
  `POST /api/auth/logout`; `POST /api/auth/logout-all`; `GET/DELETE /api/auth/sessions`;
  `GET /api/auth/me`; `POST /api/auth/password` (set/change — only meaningful once `password_hash`
  is set or being set for the first time, which is exactly the "as per the logged-in method"
  conditional UI in the spec).
- **Onboarding** — `GET /api/onboarding/status`, `POST /api/onboarding/complete` (idempotent —
  grants trial coins + `onboarded_at` exactly once, safe to call multiple times).
- **Channels** — `POST /api/channels/whatsapp/otp/request` + `/verify`,
  `POST /api/channels/telegram/link-code` (returns the `t.me` deep-link + code), a Telegram bot
  webhook addition that resolves a `/start <code>` payload to a pending link and confirms it,
  `GET /api/channels`, `DELETE /api/channels/:id` (disconnect — only the linked account can do
  this to its own link).
- **Home** — `GET /api/home/summary`.
- **Directory** — `GET /api/cards` (search + event/tag/archived filters + pagination),
  `GET /api/cards/export.csv`, `PATCH /api/cards/bulk` (ids[] + tags-to-add/event/archived),
  `DELETE /api/cards/bulk`.
- **Contact detail** — `GET /api/cards/:id`, `PATCH /api/cards/:id`, `DELETE /api/cards/:id`.
- **Events** — `GET/POST/PATCH /api/events` (name, location, date, thumbnail upload).
- **Billing** — `GET /api/plans`, `POST /api/billing/subscribe`, `POST /api/billing/coins/topup`,
  `GET /api/billing/invoices`, `GET /api/billing/invoices/:id/pdf` (view or download — same
  endpoint, browser decides). `routes/cashfreeWebhook.route.ts` gets a new branch: on
  `subscription_payment` success, extend `accounts.plan_expires_at` + generate invoice; on
  `coin_purchase` success (now account-scoped), credit `accounts.coin_balance`.
- **Admin** — `GET /api/admin/users`, `POST /api/admin/users/:id/block`/`/unblock`,
  `POST /api/admin/users/:id/coins`, `GET /api/admin/cards?lowConfidence=true`,
  `POST /api/admin/cards/:id/rerun`, `GET /api/admin/health`.

## Build order

1. **Schema + wallet migration** — all additive tables/columns; `walletService`; sync with Tarun
   on the `coinService` delegation before merging.
2. **Auth + sessions** — all 3 login methods, session list/logout/logout-all, `dashboard/`
   skeleton with login/signup screens.
3. **Onboarding + channel linking** — onboarding screen, WhatsApp OTP link (needs the Meta
   Authentication template approved), Telegram deep-link/`Start` confirmation, collision
   detection + disconnect.
4. **Core dashboard** — Home, Directory (search/filter/tags/bulk actions/CSV/channel icons),
   Contact detail (edit/tags/archive/move/voice playback/delete).
5. **Events** — create/manage with location/date/thumbnail, Miscellaneous auto-bucket.
6. **Billing** — plans, upgrade/downgrade, coin recharge, webhook extension, invoices +
   purchase history with status + view/download.
7. **Paywall enforcement** — turn on `requireActivePlanOrTrial` once billing works end-to-end.
8. **Super admin** — user list/block/coin-adjust, card review/re-run, health page.
9. **Deploy** — second Next.js PM2 process + nginx server block + `deploy-dashboard.yml` on the
   existing VPS, subdomain under the same parent domain as the API (cookie stays same-site).

## Verification

- Each phase: `npm run typecheck && npm run build` in `server/`, equivalent in `dashboard/`.
- Identity: create one account, link both a WhatsApp and a Telegram number to it, scan a card on
  each channel, confirm both appear in one Directory and draw from one coin balance.
- Collision: try linking a WhatsApp number already linked to account A while logged into account
  B — confirm it's rejected with the warning, not silently re-linked.
- Sessions: log in from two "devices" (two browsers), confirm both appear in the session list,
  confirm "logout all" invalidates both.
- Billing: sandbox Cashfree end-to-end (plan purchase → webhook → `plan_expires_at` extended,
  invoice row + PDF present; coin top-up → webhook → `accounts.coin_balance` credited) before
  switching to production keys.
- Admin: confirm a blocked account is rejected by `/api/*` *and* by sending a photo through the
  actual bot on a channel linked to that account.
- Regression: confirm an un-linked, dashboard-never-touched WhatsApp/Telegram user can still scan
  cards exactly as before (legacy per-channel balance path in `walletService` untouched).
