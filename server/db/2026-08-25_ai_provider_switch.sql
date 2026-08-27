-- Schema update: env-based AI provider switch + developer-only usage log
-- (2026-08-25). Run against the self-hosted Postgres the same way
-- schema.sql itself is applied — all statements are idempotent.

-- ── ai_provider_usage_log ─────────────────────────────────────────────────
-- One row per vision-extraction or transcription call, whichever provider
-- actually ran (OpenAI/Gemini for vision, OpenAI/Google for transcription
-- — see server/src/config/env.ts's VISION_PROVIDER/TRANSCRIPTION_PROVIDER).
-- Exists purely to let a developer compare providers on real production
-- traffic — accuracy (the model's own self-reported confidence for
-- vision, the provider's confidence score for transcription) and cost
-- (input/output tokens for vision, audio seconds for transcription, since
-- both providers bill transcription per minute of audio, not tokens).
--
-- Deliberately NOT surfaced anywhere in admin/ or dashboard/ — no API
-- route ever reads this table, so there is nothing to accidentally expose
-- through a UI. A developer queries it directly (psql against the
-- self-hosted Postgres, same access already used for every other
-- migration/inspection this project does).
create table if not exists public.ai_provider_usage_log (
  id uuid not null default gen_random_uuid(),
  task text not null,
  provider text not null,
  model text not null,
  card_id uuid null,
  input_tokens integer null,
  output_tokens integer null,
  audio_seconds numeric null,
  confidence numeric null,
  latency_ms integer not null,
  success boolean not null,
  error text null,
  created_at timestamptz not null default now(),
  constraint ai_provider_usage_log_pkey primary key (id),
  constraint ai_provider_usage_log_card_id_fkey foreign key (card_id) references public.visiting_cards (id) on delete set null,
  constraint ai_provider_usage_log_task_check check (task in ('vision_extraction', 'transcription'))
);

create index if not exists idx_ai_provider_usage_log_task_provider on public.ai_provider_usage_log using btree (task, provider, created_at desc);
