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
  u.export_sheet_id
from
  public.users u
  left join public.events e on e.id = u.active_event_id
  left join public.visiting_cards vc on vc.id = u.active_visiting_card_id;

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
