# Database

CardPing uses a single Supabase (Postgres) project as its only datastore, for both bots and for
file storage (business-card photos, voice notes). The full definition lives in
[`server/db/schema.sql`](../server/db/schema.sql) — this page is a guided tour of it.

Apply it via the Supabase SQL Editor, or `psql "$SUPABASE_DB_URL" -f server/db/schema.sql`. It's
idempotent (every statement is `IF NOT EXISTS` / `ADD COLUMN IF NOT EXISTS` / `CREATE OR REPLACE`
/ guarded by a `pg_constraint`/`pg_type` check), so it's safe to re-run — including directly
against the original CardPing database described in `old-project/schema.md`, where it only adds
what's missing.

## Tables

### `users`

One row per person, reachable over WhatsApp and/or Telegram (a person who uses both ends up as
one row with both `wa_id` and `telegram_id` set — nothing currently links them together
automatically, since there's no shared login; that'd be a natural next feature).

| Column | Notes |
|---|---|
| `id` | Primary key, referenced everywhere else as `user_id` |
| `wa_id` | WhatsApp phone number (E.164, no `+`) — unique |
| `wa_chat_id` | Most recent inbound WhatsApp message id |
| `telegram_id` *(new)* | Telegram numeric user id — unique |
| `telegram_chat_id` *(new)* | Chat id to send replies to |
| `coin_balance` | Defaults to `COINS_STARTER_BALANCE` (env) on signup |
| `active_event_id` / `active_visiting_card_id` | What the bot currently considers "the" event/card in context |
| `user_state` | Pending-conversation marker — see [ARCHITECTURE.md](./ARCHITECTURE.md#conversation-state) |
| `write_email` | Set `true` once Gmail follow-up is connected |
| `full_name` / `email` | Seeded from the channel's profile name on first contact; used as the "from" name in drafted follow-up emails |
| `blocked_at` *(new)* | Set by `admin/`'s Users page. Non-null blocks card scans on both bots (see `bots/*/handlers/{image,photo}.ts`) — doesn't affect anything else the bot does |
| `marketing_opt_in` *(new)* | Defaults `false`. The only gate on `admin/`'s Broadcasts audience — see [ADMIN_APP.md](./ADMIN_APP.md) |
| `plan_id` *(new)* | References `plans.id`. Null = no subscription (trial, if `coin_balance > 0`). Set by `admin/`'s Subscriptions page — no real checkout yet |
| `plan_expires_at` *(new)* | Paired with `plan_id`. Drives `admin/`'s active/expired status and the auto renewal-reminder notification |

`last_login`, already on `users` (updated on every inbound bot message —
`db/repositories/users.repo.ts#touchLastLogin`), is exposed through `user_with_event` as of this
pass too — `admin/`'s Send Message modal uses it to decide whether a WhatsApp message can be free
text (within 24h) or needs an approved template.

### `plans` *(new)*

A real catalog (`id, name, price_inr, period_days, coins_included, is_active`), seeded with the
same three tiers `dashboard/lib/mock/billing.ts` mocks (Starter/Professional/Enterprise).
`description text` and `benefits jsonb` (array of strings) hold whatever eventually renders on the
dashboard's subscription page. Managed from `admin/`'s Subscriptions → Plans tab (add/edit/
deactivate — no hard delete, since a user may already reference one).

### `topup_packages` *(new)*

The coin-top-up equivalent of `plans` (`id, coins, price_inr, description, benefits, is_popular,
is_active`), matching `dashboard/lib/mock/topups.ts`'s `TopUpPackage` shape. Seeded with the same
four mock tiers. Managed from `admin/`'s Subscriptions → Top-ups tab, same add/edit/deactivate
pattern as `plans`.

### `events`

An event is just a label (`name`) a user's scans get grouped under, created via "Set an Event" /
`/setevent`, or from `dashboard/`'s Events page. `users.active_event_id` points at the one
currently in use. `location`, `event_date`, `thumbnail_path`/`thumbnail_public_url` *(new)* are
dashboard-only fields (bots never set them) — see `dashboard/`'s Events UI.

### `visiting_cards`

One row per scanned card. `uploaded_by` is `"whatsapp"` or `"telegram"`. `message_id` is the
inbound message id of the *photo* — used to match a later voice-note reply back to this card
(see `services/voiceNoteService.ts`). `storage_path` / `image_public_url` point at the photo in
Supabase Storage; `voice_note_path` / `voice_note_public_url` at the transcribed voice note, if
any. `extraction_confidence` *(new)* is GPT-4o's own `0.5`–`1.0` confidence score for the scan
(`ExtractedCard.confidence`), persisted since `admin/`'s Cards page uses it to surface
low-confidence scans worth a manual look. `archived` and `tags text[]` *(new)* back
`dashboard/`'s Directory (archive action, tag filter/bulk-tag — GIN-indexed).

### `gmail_tokens`

One row per user who has connected Gmail (via `/oauth/google/callback`). Stores the OAuth
**refresh** token only — access tokens are short-lived and fetched on demand
(`integrations/gmail/oauth.ts#refreshAccessToken`), never persisted.

### `temp_emails`

A drafted follow-up email, written by GPT right after a card is scanned, waiting for the user to
approve it over chat before it becomes a real Gmail draft. `visiting_card_id` ties it back to the
card it's about.

### `transactions`

An audit log of coin/money movements. `type` is one of `card_scan` (−1, recorded automatically on
every scan), `coin_purchase` (+N, from a Cashfree top-up), `coin_bonus`, `refund`,
`admin_adjustment` — a manual balance change made from `admin/`'s Users page — or
`subscription_payment` — a plan purchase, whether assigned manually from `admin/`'s Subscriptions
page or bought for real through `dashboard/`'s billing flow. `amount_inr` and `plan_id`
(references `plans.id`) are only set on `subscription_payment` rows. `account_id uuid null`
*(new, references `accounts.id`)* coexists with the original `user_id` — `user_id` is "which
channel identity triggered this," `account_id` is "whose wallet this affected"; a legacy bot-only
card scan sets only `user_id`, a dashboard billing transaction sets only `account_id`. "Total
earning" on the Subscriptions summary is `sum(amount_inr) where type='subscription_payment' and
status='completed'`, across both.

### `admin_users`, `admin_sessions`, `admin_audit_log` *(new)*

Staff accounts for `admin/` — separate from the customer `users` table, provisioned by hand (one
`INSERT` per person, see [HOSTINGER_VPS_SETUP.md §11](./HOSTINGER_VPS_SETUP.md#11-deploy-the-admin-app)),
not self-service. `admin_sessions` is the same opaque-cookie session pattern as the customer
dashboard's planned auth (bcrypt password hash, revocation is just a row delete — no JWT).
`admin_audit_log` gets one row per consequential action (block/unblock, coin adjustment, card
re-run, env var edit, broadcast send) — see [ADMIN_APP.md](./ADMIN_APP.md).

### `broadcast_campaigns`, `broadcast_recipients` *(new)*

One campaign row per broadcast sent from `admin/`'s Broadcasts page, one recipient row per user it
was sent to (`status`: `pending` → `sent`/`failed`, plus `error` on failure). `audience_filter text`
*(new)* records which narrowing filter (all/subscribed/low_balance/trial — `lib/audienceFilter.ts`)
the campaign used, so **Resend** can re-resolve the same audience fresh rather than reusing a
possibly-stale recipient list. See [ADMIN_APP.md](./ADMIN_APP.md) for the send flow and the
WhatsApp Marketing Template requirement.

### `notification_log` *(new)*

One row per renewal-reminder / low-balance-alert WhatsApp send attempt, auto or manual
(`type`, `triggered_by`, reuses `broadcast_channel`/`broadcast_recipient_status` rather than adding
near-duplicate enums; `admin_user_id` set only for manual sends). See
[ADMIN_APP.md](./ADMIN_APP.md#proactive-whatsapp-notifications).

### `accounts`, `channel_links`, `sessions`, `otp_codes`, `invoices` *(new)*

`dashboard/`'s real identity model — see [DASHBOARD_PLAN.md](./DASHBOARD_PLAN.md) for the full
design. **`accounts`** is a dashboard login (email/password, Google, or verified mobile), with its
own wallet (`coin_balance`, `plan_id`, `plan_expires_at`) — deliberately separate from `users` (a
bot channel identity). `users.coin_balance`/`blocked_at`/`plan_id`/`plan_expires_at` are **not**
vestigial: they stay authoritative forever for any channel identity that never links to an
account, because a brand-new phone number's very first scan happens before any account could
possibly exist. **`channel_links`** is what resolves a `users` row to an `accounts` row once (and
if) someone connects that channel from the dashboard — unique on `(channel, channel_identifier)`
*and* on `users_id` (a channel resolves to at most one account). **`sessions`** is the same
opaque-cookie pattern as `admin_sessions`, plus `device_label`/`user_agent` for the Profile →
Sessions screen. **`otp_codes`** holds sha256-hashed codes for both login OTP and channel-link OTP
(`purpose` distinguishes them; for a Telegram deep-link code, `target` holds the requesting
account's id instead of a phone number, since the inbound `/start <code>` has nothing else to key
on). **`invoices`** is one row per completed billing transaction, PDF generated on the fly and
stored in the private `invoices` bucket (signed URLs only — unlike the public card/voice buckets).

`user_with_event` gained `account_id`, `linked_account_email`, and four `effective_*` columns
(`effective_coin_balance`, `effective_blocked_at`, `effective_plan_id`,
`effective_plan_expires_at`) — each `coalesce(account's value, legacy users value)`. `admin/`
reads and writes through these, not the raw columns, so its Users/Subscriptions pages show and
act on the right value whether a channel is linked or not (see `adminUsers.repo.ts`'s
`resolveAccountId` branch on `setBlocked`/`adjustCoins`).

## Views

### `user_with_event`

The one view both bots actually query day-to-day — a `users` row joined with its active event's
name and active card's name/company, so a single `SELECT` gets everything a message handler
needs. `db/repositories/users.repo.ts` is built entirely around this view.

**This must stay the only `create or replace view public.user_with_event` statement in
`schema.sql`, positioned after every `ALTER TABLE ... ADD COLUMN` it references.** `CREATE OR
REPLACE VIEW` can append trailing columns but can't reorder or drop existing ones — a second,
narrower definition earlier in file-execution order will fail the moment the view already has more
columns than that statement lists (this happened once, while adding the columns above — see the
comment directly above the view definition in `schema.sql`). Extend the one definition at the
bottom of the file instead of adding another.

### `cards_export_view`

A flat, human-readable join of card + owning user + event, meant for building an export/dashboard
feature later (not currently used by the bots themselves).

## RPC functions

### `decrement_coin_balance(user_uuid)`

Floors `coin_balance` at zero (never goes negative) and returns the updated row. Referenced by
the original n8n export but not defined in it — recreated here from its usage.

### `increment_coin_balance(user_uuid, amount)` *(new)*

The top-up counterpart, used by the Cashfree payment webhook to credit coins once a payment link
is paid.

### `admin_adjust_coin_balance(user_uuid, delta, reason)`

Same floor-at-zero behavior, but `delta` can be negative (deduct) or positive (add), and it also
inserts the corresponding `admin_adjustment` transaction row.

### `account_decrement_coin_balance(account_uuid)`, `account_increment_coin_balance(account_uuid, amount)`, `admin_adjust_account_coin_balance(account_uuid, delta, reason)` *(new)*

The same three RPCs above, targeting `accounts` instead of `users` — used once a bot channel
identity is linked (`services/walletService.ts`) or when `admin/`'s Users/Subscriptions actions
resolve to a linked account (`adminUsers.repo.ts#resolveAccountId`).

Assigning a plan (`admin/`'s Subscriptions → "Change plan", or a real purchase through
`dashboard/`'s billing flow) doesn't get its own RPC — it's a few plain statements in
`setUserPlan`/`setAccountPlan`/the Cashfree webhook handler: update `plan_id`/`plan_expires_at`
(extending from the current expiry if it's still in the future, else starting fresh from now),
call the matching `increment_coin_balance` RPC for the plan's `coins_included`, and insert the
`subscription_payment` transaction row.

## Storage buckets

`visiting-cards` and `voice-notes` are public-read with unguessable `{user_id}/{random}...` object
paths (matching the original workflow's approach — see `server/db/schema.sql` for the tradeoff and
how to switch to signed URLs if you'd rather have hard access control instead). `event-thumbnails`
*(new)* is the same public-read pattern, for `dashboard/`'s Events. `invoices` *(new)* is
**private** — invoices carry billing PII, so `GET /api/billing/invoices/:id/pdf` always serves them
via a short-lived `createSignedUrl()`, never a public URL.

## Changes from the original schema

Everything below is additive — nothing from `old-project/schema.md` was removed or renamed.

| Change | Why |
|---|---|
| `users.telegram_id`, `users.telegram_chat_id` | The Telegram bot now shares this table instead of Google Sheets — see [MIGRATION_NOTES.md](./MIGRATION_NOTES.md#1-one-shared-supabase-backend) |
| `user_with_event` view: added `email`, `full_name`, `telegram_id`, `telegram_chat_id` | Needed by both bots' shared code |
| `transactions.status`, `transactions.cashfree_link_id` | Track a payment link from creation to the webhook confirming it, so coins are credited exactly once — see [MIGRATION_NOTES.md](./MIGRATION_NOTES.md#7-new-cashfree-payment-webhook) |
| `increment_coin_balance` RPC | Didn't exist before; needed for the same reason |
| `visiting_cards` `updated_at` trigger | The original schema only wired this trigger on `users`; added it here for `visiting_cards` too since the app updates it (adding a voice note transcript) |
| `idx_cards_message_id` index | The voice-note-matching lookup (`WHERE message_id = ...`) runs on every voice note received |
| `users.blocked_at`, `users.marketing_opt_in`, `visiting_cards.extraction_confidence`, `transaction_type` gains `admin_adjustment`, `admin_users`/`admin_sessions`/`admin_audit_log`, `broadcast_campaigns`/`broadcast_recipients`, `admin_adjust_coin_balance` RPC | The `admin/` super-admin app — see [ADMIN_APP.md](./ADMIN_APP.md) |
| `plans`, `users.plan_id`/`plan_expires_at`, `transaction_type` gains `subscription_payment`, `transactions.amount_inr`/`plan_id`, `notification_log` | `admin/` subscriptions bookkeeping + proactive WhatsApp notifications — see [ADMIN_APP.md](./ADMIN_APP.md#subscriptions--admin-bookkeeping-not-real-checkout) |
| `plans.description`/`benefits`, `topup_packages`, `broadcast_campaigns.audience_filter`, `user_with_event` exposes `last_login` | `admin/` catalog management, broadcast audience filters + resend, 1:1 messaging's 24h-window check — see [ADMIN_APP.md](./ADMIN_APP.md) |
