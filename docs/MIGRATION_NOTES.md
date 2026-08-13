# Migration notes: from n8n to this codebase

This page is for anyone comparing `old-project/*.json` (the original n8n exports) against
`server/src`. It explains what changed, and — more importantly — *why*, since several changes
were deliberate simplifications rather than 1:1 ports.

## Source material

`old-project/` contains:

- `CardPing_WhatsApp_Bot.json` — the main WhatsApp bot (46 nodes) + `WhatsApp_Sub_0*.json`, six
  n8n sub-workflows it called over HTTP (image processing, voice notes, event changes, Google
  OAuth refresh, Cashfree top-up, Supabase image upload).
- `CardPing_Telegram_Bot.json` — the Telegram bot (73 nodes), backed by Google Sheets/Drive
  instead of Supabase.
- `schema.md` — the Supabase schema the WhatsApp bot already used.
- `README_CardPing_Bots_Handoff.md` — the original developer handoff notes, including a list of
  hardcoded secrets to rotate and an explicitly **unresolved** dependency (see
  [§4](#4-the-email-follow-up-webhook-was-never-exported) below).

## 1. One shared Supabase backend

The WhatsApp bot already used Supabase. The Telegram bot used two Google Sheets tabs
("Visiting Card Data" and "Event manager") plus Google Drive for photos/voice notes, entirely
separate from the WhatsApp bot's data.

This rebuild puts both bots on the same `users` / `events` / `visiting_cards` tables (see
[DATABASE.md](./DATABASE.md)). The only schema addition needed was `users.telegram_id` /
`users.telegram_chat_id`, alongside the existing `users.wa_id` / `users.wa_chat_id` — so a
`users` row now represents "a person," reachable over WhatsApp and/or Telegram, rather than
being channel-specific.

## 2. WhatsApp transport

None of the exported workflow files actually used Twilio — every WhatsApp send in
`old-project/*.json` already goes through either the n8n `whatsApp` node or a direct
`graph.facebook.com` HTTP call (Meta's Cloud API). The handoff README mentions a *parallel*
Twilio-based migration existed in the source n8n instance, but those workflows were never
exported into this package.

So: there was no Twilio code to remove. What this rebuild does is make sure it stays that way —
`server/src/integrations/whatsapp/client.ts` is the *only* place that talks to WhatsApp, and it
only ever calls `graph.facebook.com`. There's no Twilio SDK in `package.json`, and there shouldn't
be one added later without a deliberate decision to reintroduce it.

## 3. One extraction engine

The two original bots extracted card data two different ways:

- **WhatsApp bot:** GPT-4o vision, given the photo directly, returns strict JSON matching a
  fixed schema (`WhatsApp_Sub_01_Image-Processing_w-process-image.json`, node "Analyze image").
- **Telegram bot:** Google Vision OCR (raw text extraction) → a LangChain agent (backed by
  DeepSeek) that reads the OCR text plus a natural-language system prompt and decides what to
  write into which Google Sheet column, with tool access to a date/time helper and the Sheets
  API itself.

The original handoff README's own recommendation #2 was to standardise on one engine. This
rebuild uses the WhatsApp bot's approach (`integrations/openai/vision.ts`) for both channels:
it's deterministic (same schema every time, no agent improvisation), doesn't depend on
DeepSeek/LangChain/Google Vision credentials, and was already proven out in production for the
WhatsApp bot.

## 4. The email follow-up webhook was never exported

Both original bots POST to a webhook path `w-email-operation` after processing a card. The
handoff README flags this explicitly as **unresolved**: the only matching workflow in the source
n8n instance had been rewired to a *different* path (`email-operation-twilio`) as part of an
in-progress Twilio migration, and its own upstream (`ai-email-flow`, the AI email writer) was
never exported either.

What *was* included, inside `CardPing_WhatsApp_Bot.json` itself, are the nodes for the other
half of that feature — turning an already-drafted email (read from the `temp_emails` table) into
a real Gmail draft, once the user approves it over WhatsApp (`Find Visiting Card ID` → `Get a
row` → `Fetch Token` → `Call Google OAuth Refresh Workflow` → `Get Email Address` → `Send Email`).
The schema's `temp_emails` and `gmail_tokens` tables exist for exactly this.

This rebuild fills the missing half itself: `services/emailFollowUpService.ts#prepareFollowUpDraft`
calls GPT-4o (a generalised version of the copywriting prompt — see
[§5](#5-the-telegram-bots-per-operator-growth-automation-was-not-ported)) right after a card is
processed, inserts the draft into `temp_emails`, and the existing "review → Gmail draft" half
(now `services/emailFollowUpService.ts#sendApprovedDraft`) finishes the job.

## 5. The Telegram bot's per-operator growth automation was not ported

Beyond OCR → sheet, the original Telegram workflow included:

- A LangChain agent (DeepSeek-backed) with tool access to Google Sheets and Telegram, deciding
  autonomously what to save and how to reply.
- Branches hardcoded to two specific people's Telegram usernames, each with their own Gmail
  account, their own Snov.io CRM list ID, and an email-copywriting prompt written in their voice
  ("you are Ankush Gupta, founder of Rankkking..." / "you are writing on behalf of Ahmad, founder
  of TheBlockopedia...").
- A hardcoded supergroup chat ID, with per-topic voice-note handling and forwarded-Telegram-contact
  capture into a third sheet tab.

This is real, working automation — but it's bespoke growth-hacking tooling for two specific
individuals' outbound workflow, not general CardPing product behaviour, and porting it as-is
would have meant hardcoding two real people's names, businesses, and CRM identifiers into a
general-purpose codebase.

This rebuild's Telegram bot instead mirrors the WhatsApp bot's general-purpose UX exactly (same
menu, same event flow, same card processing, same generic follow-up email copywriting — see
`services/emailFollowUpService.ts`, which uses one configurable prompt rather than a per-person
one). Snov.io, the LangChain agent, and forwarded-contact capture were dropped. If a future need
for that kind of per-user growth automation resurfaces, it belongs as a separate, explicitly
multi-tenant feature (e.g. a `senderProfiles` table keyed by user, not hardcoded usernames) —
not baked into the core bot.

## 6. Explicit interactive messages instead of pre-approved WhatsApp Templates

The original WhatsApp bot referenced several Meta Message Templates by name only
(`welcome_visiting_card`, `event_visiting_card`, `connect_gmail_visiting_card`) — their actual
approved content isn't in the exported JSON (templates live in Meta Business Manager, not in the
workflow).

Since this bot only ever *replies* to a user who has already messaged it (it never
proactively initiates a conversation), it never actually needs a pre-approved template — WhatsApp
only requires those outside the 24-hour customer-service session window, i.e. for
business-initiated messages. So this rebuild replaces every one of those template sends with a
freeform interactive message (buttons/lists) built directly in code
(`integrations/whatsapp/client.ts#sendButtons` / `#sendList`), which needs no Meta approval and
can be changed by editing `bots/whatsapp/messages.ts`. See
[WHATSAPP_TEMPLATES.md](./WHATSAPP_TEMPLATES.md) for the one place a template would still matter
(proactive/business-initiated messages, not currently a feature of this bot).

## 7. New: Cashfree payment webhook

The original Cashfree top-up flow (`WhatsApp_Sub_05_Payment-Topup_w-purchase-coin.json`) points
its `notify_url` at a webhook (`check-payment-status`) that was never exported — same situation
as §4. This rebuild adds `routes/cashfreeWebhook.route.ts` plus a `transactions.status` /
`transactions.cashfree_link_id` pair of columns (additive to the original schema) so a payment
link can be tied back to the coin top-up that should be credited when Cashfree confirms payment.
See [DATABASE.md](./DATABASE.md#transactions) and
[DEPLOYMENT.md](./DEPLOYMENT.md#cashfree-webhook) for how to point Cashfree at it.

## 8. RPC functions recreated from their usage

`decrement_coin_balance(user_uuid)` is called throughout the original workflows via
`rpc/decrement_coin_balance`, but its definition wasn't part of the export (it must have existed
directly in the source Supabase project). `db/schema.sql` recreates it (floor at zero, never
negative) from how it's called, and adds a symmetrical `increment_coin_balance` for the top-up
side, which didn't exist before.

## What was carried over unchanged

- The extraction JSON schema (`ExtractedCard` in `types/domain.ts`) is the original WhatsApp
  bot's schema, verbatim.
- The visiting-card ⇄ voice-note matching trick (reply's `context`/`reply_to_message` id matched
  against `visiting_cards.message_id`) is the same mechanism, just reimplemented without n8n.
- The core `users` / `events` / `visiting_cards` schema is unchanged (only additive columns —
  see [DATABASE.md](./DATABASE.md#changes-from-the-original-schema)).
