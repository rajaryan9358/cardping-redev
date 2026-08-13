# Architecture

## System overview

```
                         ┌─────────────────────────────┐
 WhatsApp Cloud API ───► │  POST /webhooks/whatsapp     │
 (Meta Graph API)   ◄─── │                              │
                         │                              │
                         │      Express app (server/)   │──────► Supabase Postgres
 Telegram Bot API   ───► │  POST /webhooks/telegram     │        (users, events,
                    ◄─── │                              │         visiting_cards, ...)
                         │  GET  /oauth/google/callback  │──────► Supabase Storage
                         │  POST /webhooks/cashfree      │        (card photos, voice notes)
                         └──────────────┬───────────────┘
                                        │
                     ┌──────────────────┼───────────────────┐
                     ▼                  ▼                   ▼
                 OpenAI API        Gmail API           Cashfree API
             (vision OCR, Whisper   (OAuth + drafts)   (payment links)
              transcription, email
              copywriting)
```

One Node.js process, one Express app, one Postgres database (Supabase). There is no queue, no
second service, no n8n runtime. That's a deliberate simplification for a single-VPS deployment —
see [Why not a queue?](#why-not-a-queue) below.

## Folder layout (`server/src`)

```
config/          Environment loading + validation (env.ts)
lib/             Cross-cutting utilities (logger)
types/           Shared TypeScript types mirroring the DB schema
db/
  client.ts        Supabase client (service-role)
  repositories/     One file per table — the only code that talks to Supabase directly
integrations/
  whatsapp/        Meta Graph API client + inbound payload normalizer
  telegram/        Telegram Bot API client + inbound payload normalizer
  openai/          Vision extraction, Whisper transcription, email copywriting
  gmail/           OAuth + draft creation
  cashfree/        Payment Links
  storage/         Supabase Storage upload helpers
services/        Channel-agnostic business logic (card processing, coins, events, ...)
bots/
  whatsapp/        WhatsApp-specific glue: router, message copy, button ids, handlers
  telegram/        Telegram-specific glue: same shape as whatsapp/
routes/          Express route handlers (thin — verify, ack, delegate to a bot router)
app.ts           Express app wiring
index.ts         Process entrypoint
```

The rule of thumb: **if it's true regardless of which chat app the user is on, it belongs in
`services/` or `integrations/`, not `bots/`.** The two `bots/*` folders are intentionally
close to identical in shape — compare `bots/whatsapp/router.ts` and `bots/telegram/router.ts` —
because they're solving the same problem (map inbound message → shared service call → outbound
reply) for two different wire formats.

## Request flow

1. Meta/Telegram POSTs the webhook to `routes/whatsappWebhook.route.ts` /
   `routes/telegramWebhook.route.ts`.
2. The route verifies the request is genuinely from Meta/Telegram (HMAC signature for WhatsApp,
   a shared secret header for Telegram — see `WHATSAPP_APP_SECRET` / `TELEGRAM_WEBHOOK_SECRET`
   in [ENVIRONMENT.md](./ENVIRONMENT.md)), then **responds `200` immediately**.
3. Only after responding does it call into `bots/<channel>/router.ts`, which:
   - normalizes the raw payload into a small, channel-agnostic shape (`NormalizedWhatsAppMessage`
     / `NormalizedTelegramMessage`),
   - finds-or-creates the `users` row for this sender,
   - checks for a pending conversation state (see below),
   - dispatches to a handler in `bots/<channel>/handlers/`.
4. Handlers call into `services/*`, which call into `integrations/*` and `db/repositories/*`.

Responding before processing matters: both Meta and Telegram retry aggressively (and can disable
your webhook) if you're slow or return a non-2xx. Errors thrown during step 3–4 are caught and
logged, never surfaced back to the webhook caller.

## Conversation state

The original n8n workflows used nodes like **"Send and Wait for Response"** — the workflow
execution literally pauses, and n8n resumes that exact paused execution when the reply arrives.
A stateless Express webhook handler has no equivalent: every request is independent, and there's
no in-memory "paused execution" to resume.

Instead, `users.user_state` (a plain text column) records what the bot is waiting for:

| `user_state` | Set when | Consumed by |
|---|---|---|
| `awaiting_event_name` | User tapped "Set an Event" (or has no active event yet) | Next text message becomes the event name |
| `awaiting_account_settings_choice` | User tapped "Account Settings" | Next button tap: check balance vs. connect Gmail |
| `awaiting_email_review` | A follow-up email was just drafted | Next button tap: save to Gmail vs. skip |
| `awaiting_topup_phone` (Telegram only) | User tapped "Buy Credits" with no phone on file | Next text message is parsed as a phone number for the Cashfree link |

Every inbound message first checks `user_state` (`bots/<channel>/handlers/stateContinuation.ts`).
If it's anything other than `idle`/`null`, the pending-state handler gets first refusal; only if
it declines (e.g. the reply doesn't look like what was expected) does the message fall through to
normal dispatch by message type (image/text/audio/button).

This is simpler than it sounds in practice: it's one column, two functions
(`usersRepo.setState` and the `tryContinuePendingState` switch in each bot), and it makes the
whole conversation flow readable top-to-bottom instead of spread across dozens of n8n nodes and
implicit wait-node correlation.

## Card processing pipeline

Both bots funnel through the exact same function, `services/cardService.ts#processCardImage`:

1. Download the photo from WhatsApp/Telegram.
2. Send it to GPT-4o vision (`integrations/openai/vision.ts`) with a strict JSON extraction
   prompt — no OCR engine, no separate LLM agent step. (The original Telegram workflow used
   Google Vision OCR text extraction *plus* a separate LangChain agent to interpret it; the
   original WhatsApp workflow used GPT-4o vision directly. This rebuild standardises on the
   WhatsApp bot's approach for both channels — see
   [MIGRATION_NOTES.md](./MIGRATION_NOTES.md#3-one-extraction-engine).)
3. Insert a `visiting_cards` row with the extracted fields.
4. Upload the original photo to Supabase Storage, and store its path back on the row.
5. Charge one coin (`services/coinService.ts`) and record a `card_scan` transaction.
6. Reply with the extracted summary + a WhatsApp/Telegram contact card.
7. If Gmail follow-up is configured and the card has a usable email address, draft a follow-up
   email with GPT and ask the user to approve it (`services/emailFollowUpService.ts`).

A voice note sent as a *reply* to the card-summary message is matched back to that card via
`visiting_cards.message_id` (WhatsApp: `message.context.id`; Telegram: `reply_to_message.message_id`)
— see `services/voiceNoteService.ts`.

## Why not a queue?

n8n executions are inherently queued/retried by the n8n runtime. A hand-rolled Express server
isn't, by default. For CardPing's expected volume (a person scanning cards at an event, not a
high-throughput bulk pipeline), synchronous-but-non-blocking handling (ack fast, then `await` the
OpenAI/Supabase calls before sending the reply) is simpler to run and debug on a single VPS than
standing up Redis + BullMQ for it. If volume grows enough that OpenAI latency starts causing
webhook timeouts or you want retries-with-backoff on transient failures, that's the point to
introduce a queue — the `services/*` functions are already the natural job bodies, so it's an
additive change, not a rewrite.

## Why Express and not Fastify/Nest/etc.

Express was the explicit choice made before building this out: it's the most common choice for
a small Node API, has no code-generation step, and is easy to read a route handler and know
exactly what it does — a priority for a project meant to be easy to hand off.
