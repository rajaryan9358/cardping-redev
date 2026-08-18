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
  u.last_login
from
  public.users u
  left join public.events e on e.id = u.active_event_id
  left join public.visiting_cards vc on vc.id = u.active_visiting_card_id;
