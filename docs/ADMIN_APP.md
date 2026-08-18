# admin/ — the super-admin app

A third, standalone Next.js app (App Router + TypeScript + Tailwind, same stack as `dashboard/`)
for staff to manage users, review low-confidence card scans, look at bot health, send promotional
broadcasts and proactive account notifications, track subscription bookkeeping, and edit
`server/`'s and `dashboard/`'s environment variables — all from a browser instead of SSH.

It is **not** part of the customer-facing product. There's no link to it from `dashboard/`, it's
deployed on its own subdomain (see [HOSTINGER_VPS_SETUP.md §11](./HOSTINGER_VPS_SETUP.md#11-deploy-the-admin-app)),
and staff accounts are provisioned by hand — there's no signup flow.

## Why a separate app, not a page in the dashboard

An earlier pass built admin pages directly into `dashboard/`. They were pulled back out: mixing a
few high-privilege staff pages into the app every customer loads means every dependency, every
bug, and every XSS in the customer-facing surface has a shot at reaching admin capabilities too.
A separate app with its own process, its own auth, and its own deployment keeps that blast radius
contained.

## Architecture

- **Its own Supabase client**, direct — not proxied through `server/`. `server/` is the
  internet-facing webhook receiver (the highest-exposure process in the system); it doesn't gain
  admin-shaped capabilities just because `admin/` exists.
- **Deliberate code duplication, not shared packages.** `lib/vision.ts` (re-run extraction) and
  `lib/broadcastSend.ts` (WhatsApp/Telegram sends) are small, independent copies of logic that
  also exists in `server/src/integrations/`. This is intentional — see the comment at the top of
  each file. `admin/` never imports from `server/` or `dashboard/`.
- **Secrets aren't duplicated into `admin/.env`, though.** The OpenAI key (for re-running
  extraction) and the WhatsApp/Telegram tokens (for broadcasts) are read out of `server/.env` at
  call time via `lib/appEnvFiles.ts`, the same file-reading utility the Env Variables screen uses.
  One secret, one file on disk — `admin/.env` only holds its own Supabase credentials and a
  handful of app config values (see `.env.example`).
- **Auth**: `admin_users` (bcrypt password hash) + `admin_sessions` (opaque cookie → DB row, same
  pattern planned for the customer dashboard — revocation is just a row delete, no JWT). Staff
  accounts are seeded with a single `INSERT`, not created through a UI — see
  [HOSTINGER_VPS_SETUP.md §11](./HOSTINGER_VPS_SETUP.md#11-deploy-the-admin-app).
- **Every consequential action is audited.** Block/unblock, coin adjustments, card re-runs, env
  var edits and reveals, and broadcast sends each write one row to `admin_audit_log` — see
  `lib/auditLog.ts`. That's the reason `admin_users` exists as real per-person accounts instead of
  one shared password.
- **Env var editing restarts the target process.** `lib/appEnvFiles.ts` rewrites the target app's
  `.env` in place (preserving every other line); `lib/pm2.ts` then runs `pm2 restart <app>
  --update-env`. This only works because `server/`, `dashboard/`, and `admin/` all run under the
  same `deploy` user's pm2 daemon (pm2 is per-user) — see the note at the end of
  [HOSTINGER_VPS_SETUP.md §11](./HOSTINGER_VPS_SETUP.md#11-deploy-the-admin-app).

## Pages

| Page | What it does |
|---|---|
| `/login` | Email + password, no OTP/Google — staff-only |
| `/users` | Search, status tabs, expiry quick-filters, sortable Coins/Expires columns; per-row menu: Adjust coins, Assign/Change plan, Send message, Low-balance alert, Block/Unblock |
| `/users/[userId]` | Profile, coin balance, and everything under that user: their events (with card counts) and full card list |
| `/cards` | Cards at or below a confidence level (segmented control, not a free-typed number), sortable by confidence/scan date; "Re-run" re-fetches the stored photo and re-extracts it |
| `/events` | Every event across every user, filterable by owner, sortable by card count/created date |
| `/events/[eventId]` | That event's full card list |
| `/health` | `server/`'s live `/health` endpoint, last scan per channel, last transaction per type, a 14-day scan-volume chart — all real queries, nothing mocked |
| `/subscriptions` | Tabbed: **Subscribed users** (summary + "Send renewal reminder"/"Change plan", usernames link to their `/users/[userId]`), **Plans** and **Top-ups** (add/edit/deactivate the real catalog — see below) |
| `/broadcasts` | Compose (WhatsApp: template picked from a live Meta-approved-templates dropdown, or manual entry as a fallback; Telegram: free text), an audience filter narrowing the opted-in pool, and "Resend" on any past campaign |
| `/notifications` | Log of every renewal-reminder / low-balance-alert WhatsApp send, auto or manual, filterable |
| `/env` | Masked key/value list for `server/` and `dashboard/`, tabbed. Reveal (per-key or "Reveal & edit all") is a separate, audited action — no value is ever part of the page's initial payload |
| `/audit-log` | Every entry above, filterable by admin and action type |

`/users` also has status tabs — Active (not blocked), Blocked, Trial (no plan, still has coins),
Subscription (active paid plan), Expired (paid plan, expiry passed) — deliberately overlapping,
not mutually exclusive (see `lib/repositories/adminUsers.repo.ts#listUsers`'s `status` filter).

## Row actions, sorting, filtering — shared patterns

Every table's per-row actions live behind one `components/ui/RowActionsMenu.tsx` (a three-dot
button + floating menu) instead of a variable number of inline buttons — that variability was
literally making table rows different heights depending on how many buttons a row happened to
have. Sortable columns use `components/ui/SortableTh.tsx` + `lib/sort.ts`'s `sort=field:asc|desc`
URL param (asc → desc → back to the table's default, cycling on repeat clicks of the same column),
same URL-param-driven pattern every filter in this app already uses. Column names are whitelisted
per repo function (`SORTABLE_FIELDS` in each `adminX.repo.ts`) — never arbitrary user input passed
straight to `.order()`.

## The WhatsApp broadcast constraint

WhatsApp only allows a business-initiated message outside the 24-hour customer-service session
window via a pre-approved **Marketing**-category Message Template — free-form text is rejected by
the Graph API in that case. This is the same constraint documented for OTP delivery in
[WHATSAPP_TEMPLATES.md](./WHATSAPP_TEMPLATES.md). The Broadcasts composer and the Send Message
modal both pick from `lib/whatsappTemplates.ts#listApprovedTemplates()` — a live call to Meta's
`GET /{WABA_ID}/message_templates`, filtered to `status: 'APPROVED'` — when
`WHATSAPP_BUSINESS_ACCOUNT_ID` is set in `server/.env`; otherwise both fall back to manual
template-name (+ language code) entry, which is all that existed before that env var did. Telegram
has no equivalent restriction; a bot can message anyone who has ever started a chat with it, so the
Telegram composer is just free-form text.

## Broadcast audience

The hard floor never moves: opted in (`users.marketing_opt_in = true`), not blocked
(`users.blocked_at is null`), and reachable on the selected channel (`wa_id`/`telegram_chat_id`
set). `marketing_opt_in` defaults to `false` for every user — sending unsolicited WhatsApp
marketing without consent risks Meta restricting the business number, and it's the safer default
in general. An **audience filter** (`lib/audienceFilter.ts`) narrows *within* that floor — All
opted-in / Subscribed / Low-balance / Trial — it never widens past it; there is deliberately no way
to target blocked users, even as an option. Each campaign remembers which filter it used
(`broadcast_campaigns.audience_filter`), shown in history and reused by **Resend**, which
re-resolves the audience fresh rather than reusing the original (now possibly stale) recipient
list.

## Individual (1:1) messages

`/users`' "Send message" action (`app/(protected)/users/SendMessageModal.tsx`) is the same 24-hour-
window logic applied to a single person: if `users.last_login` (updated on every inbound message
the bot receives — see `server/src/db/repositories/users.repo.ts#touchLastLogin`) is within 24
hours, it's free text via `lib/broadcastSend.ts#sendWhatsAppText`; otherwise the same template
picker Broadcasts uses. Telegram is always free text. Writes one `admin_audit_log` row
(`user.send_message`) — not `notification_log`, which is reserved for the renewal/low-balance
types.

## Sending

A campaign is created and its sends kicked off in one Server Action
(`app/(protected)/broadcasts/actions.ts`): it inserts one `broadcast_campaigns` row and one
`broadcast_recipients` row per audience member, then calls `lib/broadcastJob.ts`'s
`runBroadcastCampaign` **without awaiting it**. Because `admin/` runs as a long-lived pm2 process
(not a serverless function that terminates when the response is sent), that promise keeps running
in the background — one HTTP call per recipient, with a fixed delay between sends, updating each
recipient's `status`/`error` as it goes and the campaign's `status` to `completed` when done.
Refreshing the Broadcasts page re-queries recipient counts, which is how send progress becomes
visible.

## Subscriptions — admin bookkeeping, not real checkout

There is no live subscription payment flow yet — Cashfree is wired only for coin top-ups (see
`server/src/routes/cashfreeWebhook.route.ts`). `dashboard/`'s mock data already anticipates a real
model (`Plan{id,name,priceInr,periodDays,coinsIncluded}`, a `subscription_payment` transaction
type — see `docs/DASHBOARD_PLAN.md`'s `walletService` section) built on a not-yet-started
`accounts` migration. Rather than wait on that, `/subscriptions`' "Change plan" is **admin-manual**:
it sets `users.plan_id`/`plan_expires_at` (extending from the current expiry if it's a renewal, or
starting fresh from now), credits the plan's `coins_included` via the existing
`increment_coin_balance` RPC, and inserts one `subscription_payment` transaction row — the same
column names the real checkout flow will eventually write to, so nothing here needs migrating
again once that's built. "Total earning" on the summary is `sum(transactions.amount_inr) where
type='subscription_payment' and status='completed'`.

The **Plans** and **Top-ups** tabs manage the actual catalogs those flows read from — `plans`
(now with `description`/`benefits` for whatever eventually renders on the dashboard's subscription
page) and the new `topup_packages` table (matching `dashboard/lib/mock/topups.ts`'s
`TopUpPackage` shape). Add/Edit forms only; there's no delete, since a user might already reference
a plan — "Deactivate" (`is_active = false`) removes it from the picker without breaking history.
`adminSubscriptionsRepo.listPlans()` (active-only, used by "Change plan") stays separate from
`listAllPlans()` (everything, used by the management table) so deactivating a plan can't
accidentally make it disappear from admins' own view of it.

## Proactive WhatsApp notifications

Two kinds, both logged to `notification_log`: **renewal reminders** (a subscribed user's
`plan_expires_at` is within `RENEWAL_REMINDER_DAYS_BEFORE_EXPIRY` days, default 3) and
**low-balance alerts** (`coin_balance <= LOW_BALANCE_THRESHOLD`, default 2). Unlike Broadcasts,
these are **not gated behind `marketing_opt_in`** — they're transactional messages about the
user's own account, not marketing, so the only gate is `blocked_at is null` (a blocked user gets
no proactive messages at all) and having a `wa_id`. They still need an approved WhatsApp
**Utility**-category template (same 24-hour-window rule as Broadcasts' Marketing templates — see
[WHATSAPP_TEMPLATES.md](./WHATSAPP_TEMPLATES.md)), named via `WHATSAPP_RENEWAL_TEMPLATE_NAME` /
`WHATSAPP_LOW_BALANCE_TEMPLATE_NAME`.

**Auto**: `instrumentation.ts`'s `register()` (Next.js's officially-supported "run once at server
boot" hook — needs `experimental.instrumentationHook` in `next.config.js` on Next 14) starts a
`setInterval` calling `lib/notificationChecks.ts#runNotificationChecks()` every
`NOTIFICATION_CHECK_INTERVAL_MINUTES` (default 60), which finds candidates and dedupes against
recent `notification_log` rows so a user gets at most one reminder per expiry cycle (and at most
one low-balance alert per 7 days). `instrumentation.ts` itself only branches on
`NEXT_RUNTIME==='nodejs'` to dynamically import `instrumentation-node.ts` — that specific shape is
required for Next's bundler to exclude the Node-only import (fs, Supabase client) from the Edge
runtime bundle; see the comment in that file before changing it.

**Manual**: "Send renewal reminder" on `/subscriptions` and "Low-balance alert" on `/users` call
the same underlying `lib/notificationSend.ts#sendNotification` through a Server Action, with
`triggered_by='manual'` and an `admin_user_id` — and also write an `admin_audit_log` row, like
every other consequential action here.

## Re-running a low-confidence extraction

`/cards`' "Re-run" button calls `lib/vision.ts`'s `reExtractCardFromImageUrl`, which downloads the
card's stored photo from its public Supabase Storage URL, sends it through the same GPT-4o vision
prompt `server/` uses, and overwrites the card's extracted fields (including
`extraction_confidence`) with the new result. It does not create a new card row or touch
`transactions` — this is a correction, not a re-scan.

## Env Variables — reveal & edit all

`app/(protected)/env/AllFieldsEditor.tsx`'s "Reveal & edit all" fetches every key's real value in
one audited call (`revealAllEnvEntriesAction`) and renders each in its own text input — everything
visible and editable at once, unlike the per-row `EnvVarRow`'s one-at-a-time reveal. "Save all"
only rewrites the keys you actually changed (diffed client-side against what was revealed) via the
same `appEnvFiles.writeEnvValue` the per-row editor uses, so untouched lines' comments/ordering are
never disturbed — then restarts the process once, regardless of how many keys changed.
