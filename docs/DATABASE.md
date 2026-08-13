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

### `events`

An event is just a label (`name`) a user's scans get grouped under, created via "Set an Event" /
`/setevent`. `users.active_event_id` points at the one currently in use.

### `visiting_cards`

One row per scanned card. `uploaded_by` is `"whatsapp"` or `"telegram"`. `message_id` is the
inbound message id of the *photo* — used to match a later voice-note reply back to this card
(see `services/voiceNoteService.ts`). `storage_path` / `image_public_url` point at the photo in
Supabase Storage; `voice_note_path` / `voice_note_public_url` at the transcribed voice note, if
any.

### `gmail_tokens`

One row per user who has connected Gmail (via `/oauth/google/callback`). Stores the OAuth
**refresh** token only — access tokens are short-lived and fetched on demand
(`integrations/gmail/oauth.ts#refreshAccessToken`), never persisted.

### `temp_emails`

A drafted follow-up email, written by GPT right after a card is scanned, waiting for the user to
approve it over chat before it becomes a real Gmail draft. `visiting_card_id` ties it back to the
card it's about.

### `transactions`

An audit log of coin movements. `type` is one of `card_scan` (−1, recorded automatically on every
scan), `coin_purchase` (+N, from a Cashfree top-up), `coin_bonus`, `refund`.

## Views

### `user_with_event`

The one view both bots actually query day-to-day — a `users` row joined with its active event's
name and active card's name/company, so a single `SELECT` gets everything a message handler
needs. `db/repositories/users.repo.ts` is built entirely around this view.

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

## Storage buckets

Two buckets, `visiting-cards` and `voice-notes`, both public-read with unguessable
`{user_id}/{random}...` object paths (matching the original workflow's approach — see
`server/db/schema.sql` for the tradeoff and how to switch to signed URLs if you'd rather have hard
access control instead).

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
