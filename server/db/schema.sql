-- ─────────────────────────────────────────────────────────────────────────
-- CardPing — Supabase schema
--
-- This is the full schema for a fresh project, and is also safe to re-run
-- against the existing CardPing database described in old-project/schema.md
-- (everything uses IF NOT EXISTS / ADD COLUMN IF NOT EXISTS / CREATE OR
-- REPLACE, so re-running it never drops data).
--
-- Sections marked "NEW" are additions made for this rebuild, on top of the
-- original schema, to support: one shared backend for both bots (the
-- Telegram bot used to write to Google Sheets), and a Cashfree top-up
-- webhook that the original n8n export didn't include. See docs/DATABASE.md
-- for the full explanation of every table and why each new column exists.
-- ─────────────────────────────────────────────────────────────────────────

create extension if not exists pgcrypto;

-- updated_at trigger helper (used by users + visiting_cards below)
create or replace function public.update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- ── users ───────────────────────────────────────────────────────────────
create table if not exists public.users (
  id uuid not null default gen_random_uuid(),
  email text null,
  full_name text null,
  coin_balance integer not null default 5,
  subscription_tier text null default 'FREE'::text,
  metadata jsonb null default '{}'::jsonb,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  last_login timestamp with time zone null,
  last_coin_purchase timestamp with time zone null,
  wa_id text null,
  wa_chat_id text null,
  active_event_id uuid null,
  active_visiting_card_id uuid null,
  write_email boolean not null default false,
  user_state text null,
  export_sheet_id text null,
  constraint users_pkey primary key (id),
  constraint users_wa_id_key unique (wa_id)
);

-- NEW: Telegram identity, so the Telegram bot can share the `users` table
-- instead of a separate Google Sheet. telegram_id is the Telegram numeric
-- user id (from message.from.id); telegram_chat_id is the chat to send
-- replies to (usually the same, but differs for group/topic chats).
alter table public.users add column if not exists telegram_id text null;
alter table public.users add column if not exists telegram_chat_id text null;
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'users_telegram_id_key'
  ) then
    alter table public.users add constraint users_telegram_id_key unique (telegram_id);
  end if;
end $$;

create index if not exists idx_users_wa_id on public.users using btree (wa_id);
create index if not exists idx_users_telegram_id on public.users using btree (telegram_id);
create index if not exists idx_users_active_event on public.users using btree (active_event_id);

drop trigger if exists users_set_updated_at on public.users;
create trigger users_set_updated_at
  before update on public.users
  for each row execute function public.update_updated_at_column();

-- ── events ──────────────────────────────────────────────────────────────
create table if not exists public.events (
  id uuid not null default gen_random_uuid(),
  user_id uuid null,
  name text not null,
  created_at timestamp with time zone null default now(),
  constraint events_pkey primary key (id),
  constraint events_user_id_fkey foreign key (user_id) references public.users (id) on delete cascade
);

create index if not exists idx_events_user_id on public.events using btree (user_id);

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'users_active_event_id_fkey'
  ) then
    alter table public.users
      add constraint users_active_event_id_fkey
      foreign key (active_event_id) references public.events (id) on delete set null;
  end if;
end $$;

-- ── visiting_cards ──────────────────────────────────────────────────────
create table if not exists public.visiting_cards (
  id uuid not null default gen_random_uuid(),
  user_id uuid not null,
  event_id uuid null,
  full_name text null,
  position text null,
  company_name text null,
  address text null,
  phone1 text null,
  phone2 text null,
  business_email text null,
  personal_email text null,
  website text null,
  linkedin text null,
  twitter text null,
  facebook text null,
  instagram text null,
  image_url text null,
  uploaded_by text null,
  message_id text null,
  transcribed_note text null,
  summary text null,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  voice_note_path text null,
  storage_path text null,
  image_public_url text null,
  voice_note_public_url text null,
  constraint visiting_cards_pkey primary key (id),
  constraint visiting_cards_event_id_fkey foreign key (event_id) references public.events (id) on delete set null,
  constraint visiting_cards_user_id_fkey foreign key (user_id) references public.users (id) on delete cascade
);

create index if not exists idx_cards_user_id on public.visiting_cards using btree (user_id);
create index if not exists idx_cards_event_id on public.visiting_cards using btree (event_id);
create index if not exists idx_cards_email on public.visiting_cards using btree (business_email);
create index if not exists idx_cards_phone on public.visiting_cards using btree (phone1);
-- NEW: voice notes / email review lookups match on message_id.
create index if not exists idx_cards_message_id on public.visiting_cards using btree (message_id);

drop trigger if exists visiting_cards_set_updated_at on public.visiting_cards;
create trigger visiting_cards_set_updated_at
  before update on public.visiting_cards
  for each row execute function public.update_updated_at_column();

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'users_active_visiting_card_id_fkey'
  ) then
    alter table public.users
      add constraint users_active_visiting_card_id_fkey
      foreign key (active_visiting_card_id) references public.visiting_cards (id) on delete set null;
  end if;
end $$;

-- ── gmail_tokens ────────────────────────────────────────────────────────
create table if not exists public.gmail_tokens (
  id uuid not null default gen_random_uuid(),
  user_id uuid null,
  refresh_token text not null,
  client_id text null,
  client_secret text null,
  email_address text null,
  created_at timestamp with time zone null default now(),
  constraint gmail_tokens_pkey primary key (id),
  constraint gmail_tokens_user_id_fkey foreign key (user_id) references public.users (id) on delete cascade
);

create index if not exists idx_gmail_tokens_user_id on public.gmail_tokens using btree (user_id);

-- ── temp_emails (AI-drafted follow-up emails awaiting user review) ───────
create table if not exists public.temp_emails (
  id uuid not null default gen_random_uuid(),
  "to" text not null,
  "from" text null,
  subject text null,
  body text null,
  visiting_card_id uuid null,
  created_at timestamp with time zone null default now(),
  constraint temp_emails_pkey primary key (id),
  constraint temp_emails_visiting_card_id_fkey foreign key (visiting_card_id) references public.visiting_cards (id) on delete cascade
);

create index if not exists idx_temp_emails_visiting_card_id on public.temp_emails using btree (visiting_card_id);

-- ── transactions ────────────────────────────────────────────────────────
do $$
begin
  if not exists (select 1 from pg_type where typname = 'transaction_type') then
    create type public.transaction_type as enum ('card_scan', 'coin_purchase', 'coin_bonus', 'refund');
  end if;
end $$;

create table if not exists public.transactions (
  id uuid not null default gen_random_uuid(),
  user_id uuid null,
  type public.transaction_type not null,
  coins integer not null,
  stripe_id text null,
  created_at timestamp with time zone null default now(),
  constraint transactions_pkey primary key (id),
  constraint transactions_user_id_fkey foreign key (user_id) references public.users (id) on delete cascade
);

create index if not exists idx_transactions_user_id on public.transactions using btree (user_id);

-- NEW: track Cashfree payment-link lifecycle so the payment webhook can
-- find the pending transaction and credit coins exactly once.
alter table public.transactions add column if not exists status text not null default 'completed';
alter table public.transactions add column if not exists cashfree_link_id text null;
create index if not exists idx_transactions_cashfree_link_id on public.transactions using btree (cashfree_link_id);

-- ── views ───────────────────────────────────────────────────────────────
-- public.user_with_event is defined once, at the very end of this file —
-- see the note down there for why (it references columns added by every
-- feature block below, so it has to come after all of them).

create or replace view public.cards_export_view as
select
  vc.id as card_id,
  u.id as user_id,
  u.wa_id,
  u.telegram_id,
  u.full_name as user_name,
  u.email as user_email,
  e.id as event_id,
  e.name as event_name,
  vc.full_name as card_full_name,
  vc."position",
  vc.company_name,
  vc.address,
  vc.phone1,
  vc.phone2,
  vc.business_email,
  vc.personal_email,
  vc.website,
  vc.linkedin,
  vc.twitter,
  vc.facebook,
  vc.instagram,
  vc.summary,
  vc.image_url,
  vc.storage_path,
  vc.voice_note_path,
  vc.uploaded_by,
  vc.message_id,
  vc.transcribed_note,
  vc.created_at,
  vc.updated_at,
  vc.created_at::date as card_date
from
  public.visiting_cards vc
  join public.users u on u.id = vc.user_id
  left join public.events e on e.id = vc.event_id;

-- ── RPC functions ───────────────────────────────────────────────────────
-- Referenced by the original n8n flow (`rpc/decrement_coin_balance`) but
-- never defined in the exported package — recreated here from its usage.
-- Never lets balance go negative; returns the row so callers can read the
-- new balance without a second round trip.
create or replace function public.decrement_coin_balance(user_uuid uuid)
returns public.users
language plpgsql
as $$
declare
  updated_user public.users;
begin
  update public.users
  set coin_balance = greatest(coin_balance - 1, 0)
  where id = user_uuid
  returning * into updated_user;

  return updated_user;
end;
$$;

-- NEW: symmetrical top-up counterpart, used by the Cashfree payment webhook.
create or replace function public.increment_coin_balance(user_uuid uuid, amount integer)
returns public.users
language plpgsql
as $$
declare
  updated_user public.users;
begin
  update public.users
  set coin_balance = coin_balance + amount,
      last_coin_purchase = now()
  where id = user_uuid
  returning * into updated_user;

  return updated_user;
end;
$$;

-- ── storage buckets ─────────────────────────────────────────────────────
-- Run once; safe to re-run. Buckets are public-read (matching the original
-- workflow's behaviour) but object paths are `{user_id}/{random}...` —
-- unguessable, not indexed/listable without the service-role key. If you
-- need hard access control instead, flip `public` to false here and switch
-- src/integrations/storage/supabaseStorage.ts to createSignedUrl().
insert into storage.buckets (id, name, public)
values ('visiting-cards', 'visiting-cards', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('voice-notes', 'voice-notes', true)
on conflict (id) do nothing;

-- ─────────────────────────────────────────────────────────────────────────
-- Super-admin app (admin/) — additive. See docs/DASHBOARD_PLAN.md's
-- successor plan for the full admin app design. Nothing above this line
-- is touched; everything below is new tables/columns only.
-- ─────────────────────────────────────────────────────────────────────────

-- Block/unblock, enforced both here (admin/) and by the bots' own scan
-- entry points (server/src/bots/*/handlers/*.ts check this before
-- processing a card).
alter table public.users add column if not exists blocked_at timestamptz null;

-- Opt-in for promotional broadcasts (Broadcasts screen). Defaults every
-- user — new and existing — to opted OUT: sending unsolicited WhatsApp
-- marketing without consent risks Meta restricting the business number,
-- and it's the safer default generally. Flip a user's own row to opt them
-- in; there's no bulk "opt everyone in" step here by design.
alter table public.users add column if not exists marketing_opt_in boolean not null default false;

-- GPT-4o vision already returns a confidence score per scan
-- (ExtractedCard.confidence in server/src/types/domain.ts) that wasn't
-- persisted before — this is what makes the admin Cards low-confidence
-- review screen possible.
alter table public.visiting_cards add column if not exists extraction_confidence numeric null;

-- Manual coin adjustments (admin Users → Adjust coins) get their own
-- transaction_type value so they're distinguishable from purchases/scans
-- in history.
alter type public.transaction_type add value if not exists 'admin_adjustment';

-- Manual coin adjustment RPC — same floor-at-zero shape as
-- decrement_coin_balance/increment_coin_balance above, used by admin/'s
-- "Adjust coins" action. `delta` can be negative.
create or replace function public.admin_adjust_coin_balance(user_uuid uuid, delta integer, reason text default null)
returns public.users
language plpgsql
as $$
declare
  updated_user public.users;
begin
  update public.users
  set coin_balance = greatest(coin_balance + delta, 0)
  where id = user_uuid
  returning * into updated_user;

  insert into public.transactions (user_id, type, coins)
  values (user_uuid, 'admin_adjustment', delta);

  return updated_user;
end;
$$;

-- ── admin_users / admin_sessions ────────────────────────────────────────
-- Staff accounts for admin/ — deliberately separate from the customer
-- `users` table and not self-service: provision a row by hand (one INSERT
-- per person) rather than building a signup flow for a tool with this
-- much access.
create table if not exists public.admin_users (
  id uuid not null default gen_random_uuid(),
  email text not null,
  password_hash text not null,
  full_name text null,
  created_at timestamptz not null default now(),
  constraint admin_users_pkey primary key (id),
  constraint admin_users_email_key unique (email)
);

create table if not exists public.admin_sessions (
  id uuid not null default gen_random_uuid(),
  admin_user_id uuid not null,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  expires_at timestamptz not null,
  constraint admin_sessions_pkey primary key (id),
  constraint admin_sessions_admin_user_id_fkey foreign key (admin_user_id) references public.admin_users (id) on delete cascade
);

create index if not exists idx_admin_sessions_admin_user_id on public.admin_sessions using btree (admin_user_id);

-- ── admin_audit_log ─────────────────────────────────────────────────────
-- Every block/unblock, coin adjustment, card re-run, env-var change, and
-- broadcast send writes one row here — the accountability mechanism behind
-- the per-person admin_users auth model.
create table if not exists public.admin_audit_log (
  id uuid not null default gen_random_uuid(),
  admin_user_id uuid null,
  action text not null,
  target_table text null,
  target_id text null,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint admin_audit_log_pkey primary key (id),
  constraint admin_audit_log_admin_user_id_fkey foreign key (admin_user_id) references public.admin_users (id) on delete set null
);

create index if not exists idx_admin_audit_log_created_at on public.admin_audit_log using btree (created_at desc);
create index if not exists idx_admin_audit_log_admin_user_id on public.admin_audit_log using btree (admin_user_id);

-- ── broadcast_campaigns / broadcast_recipients ──────────────────────────
-- Send history and per-recipient delivery state for the Broadcasts screen.
do $$
begin
  if not exists (select 1 from pg_type where typname = 'broadcast_channel') then
    create type public.broadcast_channel as enum ('whatsapp', 'telegram');
  end if;
  if not exists (select 1 from pg_type where typname = 'broadcast_status') then
    create type public.broadcast_status as enum ('draft', 'sending', 'completed', 'failed');
  end if;
  if not exists (select 1 from pg_type where typname = 'broadcast_recipient_status') then
    create type public.broadcast_recipient_status as enum ('pending', 'sent', 'failed');
  end if;
end $$;

create table if not exists public.broadcast_campaigns (
  id uuid not null default gen_random_uuid(),
  channel public.broadcast_channel not null,
  -- WhatsApp: the approved template name + JSON-encoded variable values.
  -- Telegram: template_name is null, body is the free-form message text.
  template_name text null,
  body text not null,
  audience_description text null,
  status public.broadcast_status not null default 'draft',
  created_by uuid null,
  created_at timestamptz not null default now(),
  constraint broadcast_campaigns_pkey primary key (id),
  constraint broadcast_campaigns_created_by_fkey foreign key (created_by) references public.admin_users (id) on delete set null
);

create table if not exists public.broadcast_recipients (
  id uuid not null default gen_random_uuid(),
  campaign_id uuid not null,
  user_id uuid not null,
  status public.broadcast_recipient_status not null default 'pending',
  sent_at timestamptz null,
  error text null,
  constraint broadcast_recipients_pkey primary key (id),
  constraint broadcast_recipients_campaign_id_fkey foreign key (campaign_id) references public.broadcast_campaigns (id) on delete cascade,
  constraint broadcast_recipients_user_id_fkey foreign key (user_id) references public.users (id) on delete cascade
);

create index if not exists idx_broadcast_recipients_campaign_id on public.broadcast_recipients using btree (campaign_id);

-- ─────────────────────────────────────────────────────────────────────────
-- Subscriptions + proactive WhatsApp notifications (admin/) — additive.
-- Admin-only bookkeeping for now: no real Cashfree subscription checkout
-- yet (see docs/DASHBOARD_PLAN.md's larger, not-yet-started accounts
-- migration for that). Column names match what that plan already expects
-- (plan_id, plan_expires_at, subscription_payment) so a real checkout flow
-- can plug into these same columns later instead of migrating again.
-- ─────────────────────────────────────────────────────────────────────────

create table if not exists public.plans (
  id text not null,
  name text not null,
  price_inr numeric not null,
  period_days integer not null,
  coins_included integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint plans_pkey primary key (id)
);

insert into public.plans (id, name, price_inr, period_days, coins_included)
values
  ('plan_starter', 'Starter', 999, 30, 200),
  ('plan_professional', 'Professional', 2499, 30, 750),
  ('plan_enterprise', 'Enterprise', 5999, 30, 2000)
on conflict (id) do nothing;

alter table public.users add column if not exists plan_id text null references public.plans (id);
alter table public.users add column if not exists plan_expires_at timestamptz null;

-- Manual subscription bookkeeping (admin Subscriptions → "Change plan")
-- gets its own transaction_type value, matching what
-- docs/DASHBOARD_PLAN.md already names for the future real checkout flow.
alter type public.transaction_type add value if not exists 'subscription_payment';

-- `coins` alone can't represent a currency amount — needed to compute
-- "total earning" on the Subscriptions summary.
alter table public.transactions add column if not exists amount_inr numeric null;
alter table public.transactions add column if not exists plan_id text null references public.plans (id);

-- ── notification_log ────────────────────────────────────────────────────
-- One row per renewal-reminder / low-balance-alert attempt, auto or
-- manual. Reuses broadcast_channel and broadcast_recipient_status from
-- the Broadcasts feature above instead of adding near-duplicate enums.
do $$
begin
  if not exists (select 1 from pg_type where typname = 'notification_type') then
    create type public.notification_type as enum ('renewal_reminder', 'low_balance_alert');
  end if;
  if not exists (select 1 from pg_type where typname = 'notification_trigger') then
    create type public.notification_trigger as enum ('manual', 'auto');
  end if;
end $$;

create table if not exists public.notification_log (
  id uuid not null default gen_random_uuid(),
  user_id uuid not null,
  type public.notification_type not null,
  triggered_by public.notification_trigger not null,
  channel public.broadcast_channel not null default 'whatsapp',
  status public.broadcast_recipient_status not null default 'pending',
  error text null,
  admin_user_id uuid null,
  created_at timestamptz not null default now(),
  constraint notification_log_pkey primary key (id),
  constraint notification_log_user_id_fkey foreign key (user_id) references public.users (id) on delete cascade,
  constraint notification_log_admin_user_id_fkey foreign key (admin_user_id) references public.admin_users (id) on delete set null
);

create index if not exists idx_notification_log_user_id on public.notification_log using btree (user_id);
create index if not exists idx_notification_log_created_at on public.notification_log using btree (created_at desc);

-- ─────────────────────────────────────────────────────────────────────────
-- Plan/top-up catalog management + broadcast audience-filter memory —
-- additive. admin/'s Subscriptions page can now add/edit plans and
-- top-up packages (still catalog-only, no live checkout — see
-- docs/ADMIN_APP.md), and Broadcasts remembers which audience filter a
-- campaign used so "Resend" can re-resolve it fresh.
-- ─────────────────────────────────────────────────────────────────────────

alter table public.plans add column if not exists description text null;
alter table public.plans add column if not exists benefits jsonb not null default '[]'::jsonb;

create table if not exists public.topup_packages (
  id text not null,
  coins integer not null,
  price_inr numeric not null,
  description text null,
  benefits jsonb not null default '[]'::jsonb,
  is_popular boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint topup_packages_pkey primary key (id)
);

insert into public.topup_packages (id, coins, price_inr, is_popular)
values
  ('topup_100', 100, 199, false),
  ('topup_500', 500, 899, true),
  ('topup_1000', 1000, 1599, false),
  ('topup_2500', 2500, 3499, false)
on conflict (id) do nothing;

alter table public.broadcast_campaigns add column if not exists audience_filter text null;

-- ─────────────────────────────────────────────────────────────────────────
-- dashboard/ real accounts — additive. See docs/DASHBOARD_PLAN.md for the
-- full identity model. A dashboard login (`accounts`) is deliberately
-- separate from a bot channel identity (`users`): `users.coin_balance` /
-- `blocked_at` / `plan_id` / `plan_expires_at` stay exactly where they are
-- and keep being authoritative for anyone who never links a channel — a
-- brand-new phone number's very first scan happens before any account
-- could possibly exist, so this is a permanent fallback, not a
-- transitional one. `channel_links` is what resolves a `users` row to an
-- `accounts` row once (and if) the person connects that channel from the
-- dashboard.
-- ─────────────────────────────────────────────────────────────────────────

create table if not exists public.accounts (
  id uuid not null default gen_random_uuid(),
  email text null,
  email_verified_at timestamptz null,
  password_hash text null,
  google_id text null,
  mobile text null,
  mobile_verified_at timestamptz null,
  full_name text null,
  avatar_url text null,
  role text not null default 'user',
  blocked_at timestamptz null,
  onboarded_at timestamptz null,
  coin_balance integer not null default 0,
  plan_id text null references public.plans (id),
  plan_expires_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint accounts_pkey primary key (id),
  constraint accounts_role_check check (role in ('user', 'admin'))
);

-- Case-insensitive: two people racing to register the same email with
-- different casing is a real bug otherwise. Partial (where ... is not
-- null) since each login method looks up/creates independently — no
-- cross-method merging in v1 (see DASHBOARD_PLAN.md).
create unique index if not exists idx_accounts_email on public.accounts (lower(email)) where email is not null;
create unique index if not exists idx_accounts_google_id on public.accounts (google_id) where google_id is not null;
create unique index if not exists idx_accounts_mobile on public.accounts (mobile) where mobile is not null;

drop trigger if exists accounts_set_updated_at on public.accounts;
create trigger accounts_set_updated_at
  before update on public.accounts
  for each row execute function public.update_updated_at_column();

-- ── channel_links ───────────────────────────────────────────────────────
-- Unifies a dashboard login with one or more bot channel identities.
-- Reuses broadcast_channel ('whatsapp'|'telegram') instead of adding a
-- near-duplicate enum, matching this file's own convention (see
-- notification_log above).
create table if not exists public.channel_links (
  id uuid not null default gen_random_uuid(),
  account_id uuid not null,
  users_id uuid not null,
  channel public.broadcast_channel not null,
  channel_identifier text not null,
  verified_at timestamptz null,
  created_at timestamptz not null default now(),
  constraint channel_links_pkey primary key (id),
  constraint channel_links_account_id_fkey foreign key (account_id) references public.accounts (id) on delete cascade,
  constraint channel_links_users_id_fkey foreign key (users_id) references public.users (id) on delete cascade
);

create unique index if not exists idx_channel_links_channel_identifier on public.channel_links (channel, channel_identifier);
-- One users row resolves to at most one account — the wallet migration's
-- "resolve this bot user's account" queries depend on this being unique.
create unique index if not exists idx_channel_links_users_id on public.channel_links (users_id);
create index if not exists idx_channel_links_account_id on public.channel_links (account_id);

-- ── sessions ────────────────────────────────────────────────────────────
-- Mechanically identical to admin_sessions above, plus device_label/
-- user_agent for the dashboard's Profile → Sessions screen.
create table if not exists public.sessions (
  id uuid not null default gen_random_uuid(),
  account_id uuid not null,
  device_label text null,
  user_agent text null,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  expires_at timestamptz not null,
  constraint sessions_pkey primary key (id),
  constraint sessions_account_id_fkey foreign key (account_id) references public.accounts (id) on delete cascade
);

create index if not exists idx_sessions_account_id on public.sessions using btree (account_id);

-- ── otp_codes ───────────────────────────────────────────────────────────
-- One table, `purpose` distinguishes a login OTP from a WhatsApp-channel-
-- link OTP (same delivery mechanism, different consequence on verify).
-- code_hash is sha256, not bcrypt: OTPs are short-lived/rate-limited, so
-- bcrypt's deliberate slowness is wasted cost paid on every verify
-- attempt — bcrypt stays reserved for accounts.password_hash, where
-- slow-by-design is the point.
do $$
begin
  if not exists (select 1 from pg_type where typname = 'otp_purpose') then
    create type public.otp_purpose as enum ('login', 'channel_link');
  end if;
end $$;

-- channel_onboarding: the link sent to a bot user with no channel_links row
-- yet, pointing them at dashboard signup (see channelOnboardingService.ts).
alter type public.otp_purpose add value if not exists 'channel_onboarding';

-- magic_login: a bot-issued auto-login link straight into a dashboard page
-- (e.g. Buy Credits/Subscribe) — see magicLoginService.ts.
alter type public.otp_purpose add value if not exists 'magic_login';

create table if not exists public.otp_codes (
  id uuid not null default gen_random_uuid(),
  purpose public.otp_purpose not null,
  target text not null,
  code_hash text not null,
  expires_at timestamptz not null,
  attempts integer not null default 0,
  consumed_at timestamptz null,
  created_at timestamptz not null default now(),
  constraint otp_codes_pkey primary key (id)
);

create index if not exists idx_otp_codes_target_purpose on public.otp_codes using btree (target, purpose, consumed_at);

-- ── invoices ────────────────────────────────────────────────────────────
create table if not exists public.invoices (
  id uuid not null default gen_random_uuid(),
  account_id uuid not null,
  transaction_id uuid not null,
  invoice_number text not null,
  buyer_gstin text null,
  amount numeric not null,
  tax_amount numeric not null default 0,
  pdf_path text null,
  created_at timestamptz not null default now(),
  constraint invoices_pkey primary key (id),
  constraint invoices_account_id_fkey foreign key (account_id) references public.accounts (id) on delete cascade,
  constraint invoices_transaction_id_fkey foreign key (transaction_id) references public.transactions (id) on delete cascade,
  constraint invoices_invoice_number_key unique (invoice_number)
);

create index if not exists idx_invoices_account_id on public.invoices using btree (account_id);

-- Private (unlike visiting-cards/voice-notes above) — invoices carry
-- billing PII, served via createSignedUrl() rather than a public URL.
insert into storage.buckets (id, name, public)
values ('invoices', 'invoices', false)
on conflict (id) do nothing;

-- ── transactions.account_id ─────────────────────────────────────────────
-- Coexists with the existing user_id: user_id is "which channel identity
-- triggered this," account_id is "whose wallet this affected." Either can
-- be null depending on the row's origin (a legacy bot-only card scan sets
-- only user_id; a dashboard billing event sets only account_id).
alter table public.transactions add column if not exists account_id uuid null references public.accounts (id);
create index if not exists idx_transactions_account_id on public.transactions using btree (account_id);

-- ── visiting_cards: archive + tags ──────────────────────────────────────
alter table public.visiting_cards add column if not exists archived boolean not null default false;
alter table public.visiting_cards add column if not exists tags text[] not null default '{}';
create index if not exists idx_cards_tags on public.visiting_cards using gin (tags);
create index if not exists idx_cards_archived on public.visiting_cards using btree (archived);

-- ── visiting_cards: back-of-card image (dual-side scan) ─────────────────
-- Mirrors storage_path/image_public_url above — set when the account's
-- scan_both_sides preference is on and a back photo was captured.
alter table public.visiting_cards add column if not exists back_storage_path text null;
alter table public.visiting_cards add column if not exists back_image_public_url text null;

-- ── users: held-scan + event-lifetime state ──────────────────────────────
-- pending_front_media_id/pending_back_media_id hold the channel's own media
-- reference (WhatsApp mediaId / Telegram photoFileId) across turns instead
-- of discarding a photo sent with no active event — see scanFlowService.ts.
-- active_event_set_at is stamped alongside active_event_id (usersRepo.
-- setActiveEvent) so event-lifetime expiry can be computed in app code.
alter table public.users add column if not exists active_event_set_at timestamptz null;
alter table public.users add column if not exists pending_front_media_id text null;
alter table public.users add column if not exists pending_back_media_id text null;

-- ── accounts: scan/event preferences ─────────────────────────────────────
-- Account-wide (not per-channel) — set from either the bot's Account
-- Settings menu or dashboard/'s Profile → Preferences page.
alter table public.accounts add column if not exists scan_both_sides boolean not null default false;
alter table public.accounts add column if not exists event_lifetime_hours integer null;

-- ── events: location/date/thumbnail ──────────────────────────────────────
alter table public.events add column if not exists location text null;
alter table public.events add column if not exists event_date date null;
alter table public.events add column if not exists thumbnail_path text null;
alter table public.events add column if not exists thumbnail_public_url text null;

insert into storage.buckets (id, name, public)
values ('event-thumbnails', 'event-thumbnails', true)
on conflict (id) do nothing;

-- ── account wallet RPCs ─────────────────────────────────────────────────
-- Same floor-at-zero shape as decrement_coin_balance/increment_coin_balance/
-- admin_adjust_coin_balance above, targeting accounts instead of users —
-- used once a bot channel identity is linked (see walletService.ts).
create or replace function public.account_decrement_coin_balance(account_uuid uuid)
returns public.accounts
language plpgsql
as $$
declare
  updated_account public.accounts;
begin
  update public.accounts
  set coin_balance = greatest(coin_balance - 1, 0)
  where id = account_uuid
  returning * into updated_account;

  return updated_account;
end;
$$;

create or replace function public.account_increment_coin_balance(account_uuid uuid, amount integer)
returns public.accounts
language plpgsql
as $$
declare
  updated_account public.accounts;
begin
  update public.accounts
  set coin_balance = coin_balance + amount
  where id = account_uuid
  returning * into updated_account;

  return updated_account;
end;
$$;

create or replace function public.admin_adjust_account_coin_balance(account_uuid uuid, delta integer, reason text default null)
returns public.accounts
language plpgsql
as $$
declare
  updated_account public.accounts;
begin
  update public.accounts
  set coin_balance = greatest(coin_balance + delta, 0)
  where id = account_uuid
  returning * into updated_account;

  insert into public.transactions (account_id, type, coins)
  values (account_uuid, 'admin_adjustment', delta);

  return updated_account;
end;
$$;

-- ── public.user_with_event (single definition) ──────────────────────────
-- Every column any feature block above added to `users` gets appended
-- here, in the order it was added. This has to be the ONLY
-- `create or replace view public.user_with_event` statement in the file:
-- Postgres allows CREATE OR REPLACE VIEW to *add* trailing columns but
-- refuses to reorder or drop existing ones, so a second, narrower
-- definition earlier in file-execution order would fail the moment this
-- view already has more columns than that earlier statement lists (which
-- is exactly what happened here once — don't reintroduce a second
-- definition, extend this one instead).
create or replace view public.user_with_event as
select
  u.id as user_id,
  u.email,
  u.full_name,
  u.wa_id,
  u.wa_chat_id,
  u.telegram_id,
  u.telegram_chat_id,
  u.coin_balance,
  u.active_event_id,
  e.name as active_event_name,
  u.active_visiting_card_id,
  vc.full_name as active_card_name,
  vc.company_name as active_card_company,
  u.write_email,
  u.subscription_tier,
  u.metadata,
  u.user_state,
  u.created_at,
  u.updated_at,
  u.export_sheet_id,
  u.blocked_at,
  u.marketing_opt_in,
  u.plan_id,
  u.plan_expires_at,
  u.last_login,
  -- Resolved through channel_links/accounts when this channel identity has
  -- been linked to a dashboard login, falling back to the legacy columns
  -- above otherwise — see the "dashboard/ real accounts" block for why the
  -- legacy columns are a permanent fallback, not transitional.
  cl.account_id,
  a.email as linked_account_email,
  coalesce(a.coin_balance, u.coin_balance) as effective_coin_balance,
  coalesce(a.blocked_at, u.blocked_at) as effective_blocked_at,
  coalesce(a.plan_id, u.plan_id) as effective_plan_id,
  coalesce(a.plan_expires_at, u.plan_expires_at) as effective_plan_expires_at,
  -- Held-scan + event-lifetime + scan-both-sides state — see the
  -- "users: held-scan + event-lifetime state" / "accounts: scan/event
  -- preferences" blocks above. No legacy fallback needed for the account
  -- columns (scan_both_sides/event_lifetime_hours): every bot user is
  -- already required to be linked before any of this is reachable.
  u.active_event_set_at,
  u.pending_front_media_id,
  u.pending_back_media_id,
  a.scan_both_sides,
  a.event_lifetime_hours
from
  public.users u
  left join public.events e on e.id = u.active_event_id
  left join public.visiting_cards vc on vc.id = u.active_visiting_card_id
  left join public.channel_links cl on cl.users_id = u.id
  left join public.accounts a on a.id = cl.account_id;

-- ── card_message_refs ───────────────────────────────────────────────────
-- Every message a card's result touches (the front photo, the back photo,
-- the "add a voice note" hint, the summary/contact-details message) —
-- lets a voice note replying to ANY of them find the right card, instead
-- of only the single message visiting_cards.message_id happens to hold.
create table if not exists public.card_message_refs (
  id uuid not null default gen_random_uuid(),
  card_id uuid not null references public.visiting_cards (id) on delete cascade,
  message_id text not null,
  created_at timestamptz not null default now(),
  constraint card_message_refs_pkey primary key (id)
);

create unique index if not exists idx_card_message_refs_message_id on public.card_message_refs (message_id);
create index if not exists idx_card_message_refs_card_id on public.card_message_refs using btree (card_id);

-- No policies — every app in this repo talks to Supabase only through the
-- service-role key (server/, admin/), which bypasses RLS regardless. This
-- just closes off anon/authenticated-key access by default rather than
-- leaving it open, matching no table in this schema having ever relied on
-- RLS policies for authorization (that's all done in application code —
-- requireSession, resolveUsersIds, etc).
alter table public.card_message_refs enable row level security;
