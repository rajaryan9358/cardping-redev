-- Schema update for the 25-item dashboard/admin polish batch (2026-08-25).
-- Run against the self-hosted Postgres the same way schema.sql itself is
-- applied — all statements are idempotent (safe to re-run).

-- ── sessions: last-known location ────────────────────────────────────────
-- Resolved from the client IP (via ip-api.com) at session-creation time,
-- best-effort — city/region granularity, null if the lookup fails or the
-- IP is private/unroutable (local dev). Never re-resolved after creation.
alter table public.sessions add column if not exists location text null;

-- ── events: geocoded coordinates ─────────────────────────────────────────
-- Populated by the Google Places Autocomplete widget on the event
-- create/edit forms when the owner picks a real place; null for events
-- with a freeform/no location (map preview is simply omitted for those).
alter table public.events add column if not exists lat double precision null;
alter table public.events add column if not exists lng double precision null;

-- ── topup_packages: tag + default selection ──────────────────────────────
-- `tag` is a freeform merchandising label (e.g. "Best Value") shown as a
-- badge on the user-facing top-up picker; `is_default` pre-selects that
-- package. No exclusivity enforced at the DB level if more than one row
-- is flagged default — last-write-wins on the frontend is an acceptable
-- outcome for a rare admin mistake.
alter table public.topup_packages add column if not exists tag text null;
alter table public.topup_packages add column if not exists is_default boolean not null default false;

-- ── card_interactions: per-card activity timeline ────────────────────────
-- Backs the dashboard's card detail "Interaction History" section, which
-- previously had no backing table at all (lib/data/cards.ts#getInteractions
-- unconditionally returned []). Covers the card's own lifecycle events —
-- not a general audit log.
create table if not exists public.card_interactions (
  id uuid not null default gen_random_uuid(),
  card_id uuid not null,
  type text not null,
  detail jsonb null,
  created_at timestamptz not null default now(),
  constraint card_interactions_pkey primary key (id),
  constraint card_interactions_card_id_fkey foreign key (card_id) references public.visiting_cards (id) on delete cascade,
  constraint card_interactions_type_check check (
    type in ('created', 'voice_note_added', 'edited', 'archived', 'unarchived', 'event_changed')
  )
);

create index if not exists idx_card_interactions_card_id on public.card_interactions using btree (card_id, created_at desc);

-- ── plans: monthly/annual billing toggle ─────────────────────────────────
-- Each plan tier (Starter/Professional/Enterprise) is still ONE row —
-- `price_inr`/`period_days` stay the monthly price/duration exactly as
-- before, and this adds an optional annual price on the SAME row rather
-- than a second plan row per tier. A plan with `annual_price_inr` null
-- simply has no annual option yet — the dashboard's billing toggle falls
-- back to showing that tier's monthly price when Annual is selected.
-- Annual duration is always exactly 365 days, computed in code rather than
-- stored (no separate `annual_period_days` column).
alter table public.plans add column if not exists annual_price_inr numeric null;

-- ── transactions: which billing period was actually purchased ───────────
-- Set at checkout time (POST /billing/subscribe) and read back by the
-- Cashfree webhook to decide whether the new plan_expires_at should be
-- base + 365 days (annual) or base + plan.period_days (monthly) — the
-- plan row alone doesn't say which the buyer picked. Null for every
-- non-subscription transaction type.
alter table public.transactions add column if not exists billing_period text null;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'transactions_billing_period_check') then
    alter table public.transactions
      add constraint transactions_billing_period_check check (billing_period in ('monthly', 'annual'));
  end if;
end $$;

-- ── accounts: which billing period the current subscription is on ───────
-- Display-only (e.g. "Renews annually" on the dashboard's Current Plan
-- card) — set alongside plan_id/plan_expires_at whenever a subscription
-- payment completes. Not used for any charging logic: each renewal is its
-- own manual purchase where the buyer picks monthly/annual again, Cashfree
-- Payment Links don't auto-recur.
alter table public.accounts add column if not exists plan_billing_period text null;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'accounts_plan_billing_period_check') then
    alter table public.accounts
      add constraint accounts_plan_billing_period_check check (plan_billing_period in ('monthly', 'annual'));
  end if;
end $$;
