-- Durable log of every real inbound WhatsApp/Telegram message (never
-- delivery/read status callbacks — those are filtered out by
-- normalizeWhatsAppWebhook/normalizeTelegramUpdate before this table is
-- ever touched, returning null for them). Exists because pino/PM2 log
-- files rotate away within hours under normal redeploy activity and never
-- captured message body content in the first place — this is a
-- purpose-built, queryable record instead, independent of log retention.
create table if not exists public.inbound_message_log (
  id uuid not null default gen_random_uuid(),
  channel text not null,
  users_id uuid not null,
  account_id uuid null,
  message_type text not null,
  content text null,
  channel_message_id text null,
  created_at timestamptz not null default now(),
  constraint inbound_message_log_pkey primary key (id),
  constraint inbound_message_log_channel_check check (channel in ('whatsapp', 'telegram')),
  constraint inbound_message_log_users_id_fkey foreign key (users_id) references public.users (id) on delete cascade,
  constraint inbound_message_log_account_id_fkey foreign key (account_id) references public.accounts (id) on delete set null
);

create index if not exists idx_inbound_message_log_users_id on public.inbound_message_log using btree (users_id, created_at desc);
create index if not exists idx_inbound_message_log_created_at on public.inbound_message_log using btree (created_at desc);
