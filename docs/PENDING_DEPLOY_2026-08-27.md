# Pre-deployment checklist — everything since `1d50e11`

This covers every uncommitted change sitting in the working tree right now, none of which has
been deployed yet. **Follow this in order** — several steps here depend on the one before it
(the database migrations in particular must land before the new code that reads those columns
is deployed, or every affected request will 500).

Once this batch ships, this file has served its purpose — it documents one release, not an
ongoing process. Delete it (or move its content into [MIGRATION_NOTES.md](./MIGRATION_NOTES.md))
once everything below is done and verified in production.

## What's in this batch

Eleven separate pieces of work, all still uncommitted:

1. **Dashboard/admin polish batch** (~25 items) — coins→credits terminology, channel icons,
   password field fixes, card detail page fixes, event status model rewrite, event map/Places
   integration, home stats trends, header search, personal info/sessions/transactions fixes,
   top-up tag/default, interaction history (new feature).
2. **Admin fixes** — health/notifications raw-JSON formatting, a "needs info" user filter,
   low-confidence card indicator, server status card formatting, broadcast 0-sent→failed status,
   logs default filter, and a new clickable Total Earning breakdown (which also fixed a bug where
   top-up revenue was silently excluded from the total).
3. **Subscription monthly/annual billing toggle** — schema + admin plan form + dashboard toggle
   (defaults to Annual).
4. **AI provider switch + usage log** — env-based OpenAI/Gemini and OpenAI/Google-STT switch for
   vision/transcription, plus a developer-only (never admin-visible) usage/cost/accuracy log.
5. **Channel/account data model fix** — the two reported bugs (cards vanishing on disconnect,
   WhatsApp forgetting its current event on reconnect) plus the underlying architecture fix:
   channel disconnects now soft-delete instead of destroying data, "current event" is account-wide
   instead of per-channel, and a "welcome back" message replaces the signup pitch for a channel
   that's connected before.
6. **Multi-value card fields + QR code + additional info** — extraction now collects every phone
   number/email/address/website a card actually has (newline-joined into the existing columns)
   instead of picking one, classifies each email as business vs. personal by domain instead of a
   naive first/second split, normalizes phone number formatting, orders every array by prominence
   on the card (primary value first, e.g. the person's own number before a shared office line),
   and adds two new fields: a QR code's decoded content (shown with a clickable "Open" button when
   it looks like a URL) and a catch-all "Additional Info" for anything on the card that doesn't fit
   another field. Applies to both vision providers (OpenAI/Gemini) and to admin's separate
   re-run-extraction path, which had its own independent copy of the prompt.
   - **UI refinement**: website is now genuinely multi-value like phones/emails/addresses (was
     left single-value in the first pass). Display (dashboard `CardDetailClient.tsx`, admin card
     detail page) now renders each value of a multi-value field as its own bordered, individually
     clickable box (`tel:`/`mailto:`/`https:` as appropriate) stacked vertically, instead of plain
     newline-separated text — websites open in a new tab. Edit forms (dashboard
     `EditLeadClient.tsx`, admin `EditCardModal.tsx`) now use a dynamic add/remove list of separate
     input boxes per value instead of one shared textarea; both still submit as the same
     newline-joined string, so no API/schema change was needed for this part.
7. **Fix coin starter-balance double/triple-grant** — a brand-new bot channel identity used to be
   created with a full `COINS_STARTER_BALANCE` of its own (`users.repo.ts`), even though a channel
   can't scan anything until it's linked to an account. Every time that identity then linked to an
   account, `walletService.mergeLegacyBalanceOnLink` transferred that full balance in *on top of*
   the one-time bonus `onboardingService.completeOnboarding` already grants the account — so a
   `COINS_STARTER_BALANCE=50` env produced 100 real coins per account (one channel linked) or 150
   (two channels linked), not 50. New identities now start at `coin_balance = 0`, so the merge is a
   genuine no-op unless there's a real legacy balance to preserve; `completeOnboarding` remains the
   single, already-idempotent (`onboarded_at`-guarded) source of the one-time grant. Also updated
   the WhatsApp/Telegram "connect your account" prompt and the dashboard onboarding wizard's
   "connect" step to explicitly mention the free credits are waiting on connecting a channel, since
   previously nothing told a new user *why* to bother connecting.
8. **Multiple voice notes per card** — a card used to hold only one voice note
   (`visiting_cards.voice_note_*`/`transcribed_note`, overwritten by every new one). It's now a
   list (`card_voice_notes`, one row per note, newest first): WhatsApp/Telegram replies to the card
   photo, its summary, its contact card, *or a previous voice note's own confirmation* — any of
   them, at any time — each add a new note instead of replacing the last one. The dashboard's card
   detail page shows the full list with each note's transcript and recorded date/time, and a new
   "Add new voice note" button opens a recording dialog (mic indicator + live timer, uploads +
   transcribes on stop, no page reload) — replacing the old non-functional "Record" control that
   lived on the edit page and never actually saved anything. Admin's card detail page shows the
   same list read-only. Also fixed a real format bug this surfaced: a browser recording is
   typically webm/opus, but every upload/transcription path silently assumed WhatsApp's ogg/opus —
   now threaded through as the recording's real mimeType end to end (storage content-type +
   extension, and OpenAI Whisper's filename hint) instead of being hardcoded.
9. **Admin: pick a provider/model to re-run extraction, and store which one produced each card** —
   `visiting_cards` gains `extraction_provider`/`extraction_model`, set on every new scan (not just
   admin re-runs) from the same provider/model `extractCardWithMeta` already returns. Admin's
   "Re-run extraction" row action now opens a dialog (`RerunExtractionModal.tsx`) to pick OpenAI or
   Gemini and a specific model (a curated list per provider, not freeform) before running — useful
   for comparing providers/models against the same real card, same purpose as the developer-only
   `ai_provider_usage_log`. Never costs a credit (unchanged — admin's re-run path never touched
   coin balances). The card detail page and the dialog itself show which provider/model most
   recently produced the card's current data.
10. **Pagination + per-page dropdown everywhere, navigation/scroll state preservation, card image
    lightbox, and admin health page fixes** — no new migration, application code only:
    - Every paginated admin table (Cards, Users, Events, Subscribed Users, Notifications, Audit
      Log) and dashboard's Directory/Transactions/Sessions now has a "Show N per page" dropdown
      (`Pagination.tsx`, duplicated in both apps, extended with `onPageSizeChange` + windowed page
      numbers instead of one button per page). Admin Broadcasts previously had **no** pagination at
      all — it silently hardcoded page 1, so a campaign past #10 was unreachable in the UI; that's
      fixed too. Admin Logs (previously an unbounded list of up to 500 lines) now paginates
      client-side over the filtered results.
    - Clicking into a card/user/event detail page and back (or deleting from the detail page) now
      returns to the exact filtered/sorted/paged list URL and scroll position you left, instead of
      a bare reset list — admin via `lib/listNavState.ts` (sessionStorage, keyed by pathname) +
      a new `BackLink.tsx` component; dashboard's Directory via the same idea but bundled into
      `ScansExplorer.tsx` itself (`persistKey="directory"`), since its filter state was never in
      the URL to begin with.
    - Card detail pages (dashboard + admin): clicking the front or back image opens it enlarged in
      a full-screen lightbox (`ImageLightbox.tsx`, new in both apps — click backdrop or Escape to
      close).
    - Admin "Bot / Scan Health" page: the WhatsApp/Telegram tiles were labeled "last scan" but
      actually meant to convey channel liveness — switched to a real "last seen" signal
      (`users.last_login`, touched on every inbound message regardless of whether it led to a
      scan) instead of "last time a scan happened to succeed," which was misleading whenever a
      channel was active without scanning. The scan volume bar chart now shows each day's count as
      a visible label, not just an on-hover tooltip. "Most recent transaction by type" (renamed
      "Most recent activity by type") no longer shows raw "-1 credits" for the card_scan tile
      (every scan is the same -1, so the number was just noise), no longer shows coin_bonus/refund
      tiles at all, and now includes subscription_payment (a real transaction type that was simply
      missing from the tracked list, so a plan purchase never showed up here).
11. **Contact-availability icons + filter, admin Cards and dashboard Directory/recent-scans** —
    a new "Availability" column shows small icons per card for which contact methods it actually
    has: WhatsApp + Phone (both read `phone1` — there's no separate "this number is WhatsApp"
    field on a scanned card, so they're the same underlying check shown as two icons for two
    different actions), Email (business or personal), Website. A matching filter narrows the list
    to cards having all of the checked ones (AND, not OR — checking more narrows further). Admin:
    server-side filter (`hasWhatsapp`/`hasEmail`/`hasPhone`/`hasWebsite` query params, applied in
    `adminCards.repo.ts`), toggle chips next to the confidence filter. Dashboard: client-side
    filter (cards are already fetched in full for Directory/`ScansExplorer`), a "Has" multi-select
    dropdown alongside the existing Events/Tags ones — applies to the Directory page and any other
    `ScansExplorer` usage (e.g. Home's recent-scans widget) automatically, since it's the same
    shared component. No schema change — reads existing columns only.

Run `git status --short` for the exact file list — 100+ modified, 20+ new files as of this writing.

## Step 1 — Review and commit

Nothing below can happen until this is on `main` (CI/CD deploys on push — see
[CI_CD.md](./CI_CD.md)).

```bash
git status                # review everything — this is a lot of files, actually look
git add -A                # or stage deliberately, file by file, if you'd rather review as you go
git commit -m "..."       # one commit or several logical ones, your call
git push origin main
```

**Do not push yet if you're not ready to immediately follow with Step 2** — the new code (once
CI/CD deploys it and PM2 restarts) references database columns/tables that don't exist until the
migrations below are applied. Ideally: apply migrations first (Step 2), *then* push (this ordering
avoids any window where new code is running against an old schema). If your CI/CD deploy+restart
isn't instant, applying the DB migration a minute or two before pushing is the safer order.

## Step 2 — Apply database migrations, in this exact order

All seven files are additive/idempotent (`create table if not exists`, `add column if not
exists`, `alter column ... set default`, an `insert ... where not exists` backfill) — safe to
re-run if you're ever unsure whether one already applied.

```bash
# From your machine, against the VPS's self-hosted Postgres — same pattern
# used for every migration this project has applied so far.
ssh -i ~/.ssh/cardping_claude_key deploy@200.234.35.144
docker exec -i supabase-selfhosted-db-1 psql -U postgres -d postgres < server/db/2026-08-25_dashboard_polish_batch.sql
docker exec -i supabase-selfhosted-db-1 psql -U postgres -d postgres < server/db/2026-08-25_ai_provider_switch.sql
docker exec -i supabase-selfhosted-db-1 psql -U postgres -d postgres < server/db/2026-08-27_channel_account_model_fix.sql
docker exec -i supabase-selfhosted-db-1 psql -U postgres -d postgres < server/db/2026-08-27_card_multi_value_fields.sql
docker exec -i supabase-selfhosted-db-1 psql -U postgres -d postgres < server/db/2026-08-27_fix_coin_starter_double_grant.sql
docker exec -i supabase-selfhosted-db-1 psql -U postgres -d postgres < server/db/2026-08-27_multiple_voice_notes.sql
docker exec -i supabase-selfhosted-db-1 psql -U postgres -d postgres < server/db/2026-08-27_extraction_model_tracking.sql
```

The last one also backfills: every card's existing single voice note (if it has one) becomes the
first row in its new `card_voice_notes` list, so nothing already recorded disappears from the
dashboard.

**After the last migration, reload PostgREST's schema cache** — applying a migration via `psql`
changes the real Postgres tables immediately, but the self-hosted PostgREST layer (what
`supabase-js` actually talks to, in server/, admin/, and dashboard/'s API routes) caches the
schema and has no way to know new columns/tables exist until told to reload. Skipping this step
doesn't fail loudly at migration time — it fails later, at request time, as a `PGRST204 Could not
find the '<column>' column of '<table>' in the schema cache` error on anything that touches a
newly-added column (this bit login itself on 2026-08-27's deploy — `sessions.location` — a fresh
column from the very first migration in this batch):

```bash
docker exec supabase-selfhosted-db-1 psql -U postgres -d postgres -c "NOTIFY pgrst, 'reload schema';"
```

Confirm it actually reloaded via `docker logs supabase-selfhosted-rest-1 --tail 20` — look for
"Received a schema cache reload message" followed by a relation count that went *up* from before.

(Adjust the `docker exec`/`psql` invocation to however you've been applying migrations — the
above assumes running it from a machine with the repo checked out and piping the file in over
SSH; equally fine to `scp` the files up first and run `psql -f` locally on the VPS.)

### One more migration piece — not a new file

**`server/db/schema.sql` has two view definitions changed in place**, both this project's own
convention (a view has exactly one canonical definition, extended/modified there directly rather
than via a dated migration file — see the comment at the top of the `user_with_event` section):

- `user_with_event` — makes "current event" resolve from the account instead of the per-channel
  row.
- `cards_export_view` — picked up the two new `qr_code_content`/`additional_info` columns.

Neither gets applied by the migration files above on their own — the
`2026-08-27_card_multi_value_fields.sql` file **does** include a fresh `cards_export_view`
`create or replace`, but `user_with_event`'s still needs re-running separately: copy its
`create or replace view public.user_with_event as ...` statement straight out of
`server/db/schema.sql` and run it against the same database. `create or replace view` is safe to
run standalone; it doesn't touch table data.

### Verify

```sql
\d channel_links     -- should show unlinked_at
\d accounts          -- should show active_event_id, active_event_set_at
\d plans             -- should show annual_price_inr
\d topup_packages    -- should show tag, is_default
\d transactions      -- should show billing_period
\d sessions          -- should show location
\d events            -- should show lat, lng
\d card_interactions -- should exist
\d ai_provider_usage_log -- should exist
\d visiting_cards    -- should show qr_code_content, additional_info
\d+ user_with_event  -- confirm active_event_id/active_event_set_at/active_event_name now reference the coalesce(a.*, u.*) expressions
\d+ cards_export_view -- should include qr_code_content, additional_info
```

## Step 3 — New environment variables

All optional / backward-compatible defaults — **nothing here is required to deploy**. The app
runs exactly as it does today if you change nothing. Add these only when you're ready to actually
use the feature they gate.

**`server/.env`** (VPS):

| Var | Default | Needed for |
|---|---|---|
| `VISION_PROVIDER` | `openai` | Set to `gemini` to switch card-scan vision provider |
| `TRANSCRIPTION_PROVIDER` | `openai` | Set to `google` to switch voice-note transcription provider |
| `GEMINI_API_KEY` | (unset) | Required only if `VISION_PROVIDER=gemini` |
| `GEMINI_VISION_MODEL` | `gemini-2.0-flash` | Only relevant if using Gemini |
| `GOOGLE_SPEECH_API_KEY` | (unset) | Required only if `TRANSCRIPTION_PROVIDER=google` |

**`dashboard/.env`** (VPS):

| Var | Default | Needed for |
|---|---|---|
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | (unset) | Event location autocomplete + embedded map preview. Without it: the address field is a plain text input and the map section just doesn't render — nothing breaks. |

Remember: **env changes are not picked up by the CI/CD deploy** (it only deploys code) — add these
directly on the VPS (`nano /var/www/cardping/server/.env` / `dashboard/.env`) and `pm2 restart` the
relevant process(es) after.

## Step 4 — Deploy code + restart

If CI/CD is wired up (see [CI_CD.md](./CI_CD.md)), pushing in Step 1 already triggered this. If
deploying by hand:

```bash
ssh -i ~/.ssh/cardping_claude_key deploy@200.234.35.144
cd /var/www/cardping && git pull
cd server && npm install && npm run build
cd ../dashboard && npm install && npm run build
cd ../admin && npm install && npm run build
pm2 restart cardping-server cardping-dashboard cardping-admin
```

## Step 5 — Run the WhatsApp duplicate-identity cleanup

This depends on Step 2 having landed (`channel_links.unlinked_at` must exist) and Step 4 having
deployed the merge script itself.

```bash
ssh -i ~/.ssh/cardping_claude_key deploy@200.234.35.144
cd /var/www/cardping/server
npm run merge:duplicate-whatsapp-identities              # dry run — review the output carefully
npm run merge:duplicate-whatsapp-identities -- --apply    # only once the dry run output looks right
```

Read every line of the dry-run output before applying — it lists exactly which `users` rows it
considers duplicates and what it would move. See the script's own header comment
(`server/scripts/merge-duplicate-whatsapp-identities.ts`) for the full explanation of what it
does and why.

## Step 6 — Manual smoke test

Automated tests don't exist for this app (per prior sessions' notes) — walk through these by hand:

- [ ] **WhatsApp**: send a real message, get a real reply (confirms webhook signature/routing
      still works after the schema/view change)
- [ ] **Scan a card** (either channel) — confirm extraction still works, confidence shows, and a
      row appears in `ai_provider_usage_log` (`select * from ai_provider_usage_log order by
      created_at desc limit 5;`)
- [ ] **Add a voice note** — confirm transcription still works, and a `transcription` row lands in
      `ai_provider_usage_log` too
- [ ] **Set a current event on one channel, then check it's visible from the other linked
      channel** (the actual account-wide event fix — this is the core thing that was broken)
- [ ] **Disconnect a channel from the dashboard's Profile → Channels page** — confirm its cards
      *stay visible* in Directory, and confirm the admin Users page does *not* show a second row
      for that person
- [ ] **Reconnect the same channel** — confirm it reuses the same identity (check
      `channel_links` — should be the same row with `unlinked_at` now null again, not a new row)
      and the current event is still set
- [ ] **Message the bot from a number that was previously connected but is now disconnected** —
      confirm it gets the "welcome back" + login link message, not the signup pitch
- [ ] **Dashboard subscription page** — Monthly/Annual toggle defaults to Annual; confirm plan
      cards show the "annual billing not available yet" fallback (expected — no annual prices are
      seeded yet, see below)
- [ ] **Admin subscriptions page** — add an annual price to one plan, confirm it now shows real
      annual pricing/savings on the dashboard
- [ ] **Admin health page** — Server card shows "Reachable · up Xh Ym", not raw JSON
- [ ] **Admin logs page** — defaults to the Warn/Error tab, not All
- [ ] **Admin Total Earning** stat card is clickable and opens the breakdown modal
- [ ] **Scan a card with two phone numbers / two emails** (or scan front + back with different
      contact info on each side) — confirm the card detail page shows every one, one per line,
      not just the last one seen
- [ ] **Scan a card with both a business-domain email and a gmail/yahoo one** — confirm they land
      in Business Email vs. Personal Email correctly, not both dumped in one field
- [ ] **Scan a card with a visible QR code** — confirm `qr_code_content` gets populated and the
      card detail page shows a working "Open" button (dashboard and admin)
- [ ] **Scan a card with something that doesn't fit any field** (a tagline, certification, extra
      business unit) — confirm it shows up under "Additional Info", not silently dropped
- [ ] **Edit a card from both the dashboard and admin** — confirm the multi-line fields
      (phone/email/address) save correctly as one-per-line, and the new QR code/additional info
      fields are editable
- [ ] **Admin "Re-run extraction"** on an existing card — confirm it produces the new field shape
      (this path has its own separate copy of the extraction prompt, kept in sync by hand — see
      `admin/lib/vision.ts`)
- [ ] **Sign up as a brand-new account and connect exactly one channel** — confirm the account ends
      up with exactly `COINS_STARTER_BALANCE` coins (check the admin Users page), not double it
- [ ] **Sign up as a brand-new account and connect both WhatsApp and Telegram** — confirm the
      balance is still exactly `COINS_STARTER_BALANCE`, not `COINS_STARTER_BALANCE` × 3
- [ ] **Message the bot from a genuinely new number/Telegram account before signing up** — confirm
      the "connect your account" prompt now mentions the free-credit count
- [ ] **Card detail page, both apps** — a multi-value field (phone/email/address/website) with more
      than one value renders as separate stacked boxes, not run-on text; a website box opens the
      real page in a new tab; a phone/email box opens the tel:/mailto: link
- [ ] **Edit a card with multiple phones/emails/websites/addresses, both apps** — each value shows
      as its own removable row with an "Add another" control, not a shared textarea; add a row,
      remove a row, save, and confirm the card detail page reflects the change in the right order
      (first row saved = primary/first line)
- [ ] **Add a voice note by replying to a card's original photo/summary/contact card on
      WhatsApp/Telegram, then add a second one by replying to the FIRST note's own confirmation
      message** — both should show up as separate entries on the dashboard card detail page, not
      overwrite each other
- [ ] **Dashboard card detail page → "Add new voice note"** — dialog opens, shows the recording
      indicator + live timer, "Stop & Save" uploads and transcribes, the new note appears at the
      top of the list with its transcript and recorded date/time, no page reload needed
- [ ] **Play back a dashboard-recorded voice note** — confirm the audio actually plays (this is
      the webm/opus vs. ogg/opus mimeType fix — if it were still hardcoded to ogg, some browsers
      would fail to play a webm file served with the wrong extension/content-type)
- [ ] **Admin card detail page** — shows the same voice notes list (transcript + timestamp per
      note), read-only, no "Add" button
- [ ] **Scan a new card** (either channel) — confirm `extraction_provider`/`extraction_model` get
      set (`select extraction_provider, extraction_model from visiting_cards order by created_at
      desc limit 1;`) and show up on the admin card detail page's header line
- [ ] **Admin Cards → "Re-run extraction"** — dialog opens, switch between OpenAI/Gemini (model
      list changes), pick a non-default model, run it — confirm the card's fields update,
      `extraction_provider`/`extraction_model` reflect the picked model, and no coins were
      deducted from the card owner's account (this path never touches coin_balance)
- [ ] **Every admin table with pagination** (Cards, Users, Events, Subscribed Users, Notifications,
      Audit Log) — "Show N per page" dropdown changes the page size and resets to page 1; page
      numbers beyond a handful show "…" instead of one button per page
- [ ] **Admin Broadcasts** — if you have more than 10 campaigns, confirm you can actually reach
      page 2+ now (previously impossible — it silently only ever showed page 1)
- [ ] **Admin Logs** — paginates the filtered result set; changing the Level tab or search resets
      to page 1
- [ ] **Admin Cards list → open a card → click Back (or delete it)** — lands back on the exact
      same filtered/sorted/paged cards view and scroll position, not a reset list. Same check for
      Users and Events.
- [ ] **Dashboard Directory** — apply a filter, scroll down, sort by a column, change page size,
      click into a lead → click "← Directory" — every one of those (filters, sort, page, page
      size, scroll position) should still be exactly as you left it
- [ ] **Dashboard Transactions and Sessions pages** — both paginate now; page-size dropdown works
- [ ] **Card detail page, both apps** — click the front (and back, if present) card image — opens
      enlarged in a full-screen viewer; Escape or clicking the backdrop/X closes it
- [ ] **Admin "Bot / Scan Health"** — WhatsApp/Telegram tiles say "last seen" (not "last scan") and
      reflect the most recent inbound message from that channel, not just the most recent
      successful scan; the scan volume chart shows a number on every non-zero bar, not just on
      hover; "Most recent activity by type" has no coin_bonus/refund tiles, the card_scan tile
      shows only a timestamp (no "-1 credits"), and a subscription_payment tile appears if any
      plan has ever been purchased/changed via the admin "Change plan" flow
- [ ] **Admin Cards and dashboard Directory** — an "Availability" column shows the right icons per
      card (WhatsApp+Phone only if it has a phone number, Email only if it has one, Website only
      if it has one); toggling filters (admin: chips; dashboard: the "Has" dropdown) narrows the
      list correctly, and checking more than one narrows further (AND, not OR)

## Step 7 — (Optional, your call on timing) Backfill old cards with the new extraction logic

Every card scanned before this deploy still has the old single-value shape (one phone, one email,
no QR/additional-info split, no prominence ordering). `server/scripts/rerun-extraction-for-old-cards.ts`
re-runs the current extraction logic against existing cards and overwrites their fields in place —
**it never touches any coin balance** (it calls the vision provider and writes to `visiting_cards`
directly, bypassing `cardService`/`walletService` entirely — the only places a scan ever costs a
credit). It does cost real AI provider money per card (same as any scan), so it's meant to be run
**once**, by you, from a shell — not exposed anywhere in the admin web UI.

```bash
ssh -i ~/.ssh/cardping_claude_key deploy@200.234.35.144
cd /var/www/cardping/server
npm run rerun:extraction-for-old-cards -- --before 2026-08-27 --limit 5              # try a handful first
npm run rerun:extraction-for-old-cards -- --before 2026-08-27 --limit 5 --apply      # apply that handful
npm run rerun:extraction-for-old-cards -- --before 2026-08-27                        # dry run, the full backlog
npm run rerun:extraction-for-old-cards -- --before 2026-08-27 --apply                # apply the full backlog
```

`--before` should be the date this feature deployed — it keeps a second accidental run from
re-billing cards already scanned with the new logic. If it fails partway through (network blip,
provider rate limit), it prints the failed card ids at the end; retry just those with
`--ids <id1,id2,...>`. See the script's own header comment for every flag.

## Known follow-ups, not blockers

- **Admin Plans and Top-ups catalogs deliberately did NOT get pagination** — both are small,
  admin-managed lists (a handful of rows each), and adding a page-size dropdown there would be
  pure UI clutter with no real benefit. Say if you'd rather have it anyway for consistency.
- **Dashboard's Events grid (`/events`) was left as-is** — it's a card grid, not a table, and
  wasn't in the set of surfaces you flagged; ask if you want the same page-size-dropdown treatment
  there too.
- **No plan currently has an annual price set.** The Monthly/Annual toggle is fully functional but
  every plan will show its monthly-fallback state until you add real annual prices via the admin
  Plans form (per your own request — this was deliberately left for you to fill in with real
  numbers rather than seeded with a guess).
- **Gemini/Google STT are wired but untested against real traffic.** Leave both provider env vars
  at their `openai` defaults until you've verified a Gemini/Google API key against a real scan —
  see [server/.env.example](../server/.env.example) for what each needs.
- **Google STT's audio encoding assumption** (OGG_OPUS, 16kHz) hasn't been verified against a real
  WhatsApp/Telegram voice note — see the comment in `server/src/integrations/google/speechToText.ts`.
- **QR code reading is best-effort.** Vision models aren't dedicated QR decoders — a clear,
  well-lit QR code usually reads fine, but there's no guarantee for a small/blurry/angled one.
  `qr_code_content` just stays empty if the model can't read it; nothing errors.
- **Existing cards keep their old shape.** This change only affects newly-scanned or manually
  re-extracted cards — a card scanned before this deploy still has whatever single email/phone/
  address it always had; it won't retroactively gain a second line unless you re-run extraction
  on it from admin.
- **Google Speech-to-Text still assumes OGG_OPUS regardless of the real recording format** — a
  dashboard-recorded (webm/opus) voice note transcribed via `TRANSCRIPTION_PROVIDER=google` would
  hit this. Not fixed as part of this batch since Google isn't the default provider and this exact
  limitation was already flagged as unverified before this feature existed (see
  `server/src/integrations/google/speechToText.ts`). Only matters if you switch that env var on.
- **The re-run extraction dialog's model list is a curated guess, not verified against your
  actual API access.** `RerunExtractionModal.tsx`'s `MODEL_OPTIONS` lists models that should be
  real/current for each provider, but whether a specific one (e.g. GPT-4.1, Gemini 2.5 Pro) is
  actually enabled on your OpenAI/Gemini account is unverified — picking one that isn't will just
  fail with an API error in the dialog, nothing breaks. Trim/adjust the list once you know what's
  actually available.
- **Already-affected accounts are NOT retroactively fixed.** Any account that already received
  100 or 150 coins instead of 50 from the starter-grant bug keeps that balance — the migration
  only stops it from happening to *new* signups. Deciding how to claw back an already-spent
  extra balance is a judgment call (some of it may already be spent on real scans), not something
  to do blindly — ask if you want a reconciliation pass and how it should handle accounts that
  already used some of the extra coins.
