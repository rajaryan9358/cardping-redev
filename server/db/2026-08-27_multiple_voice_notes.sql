-- A card can now have more than one voice note attached — recorded by
-- replying (to the card photo, its summary, its contact card, or a
-- previous voice-note confirmation — any of them, at any time, not just
-- right after scanning) on WhatsApp/Telegram, or recorded directly from
-- the dashboard's new "Add new voice note" dialog. Each one gets its own
-- row instead of overwriting visiting_cards.voice_note_*/transcribed_note,
-- which only ever held the single most recent note.
create table if not exists public.card_voice_notes (
  id uuid not null default gen_random_uuid(),
  card_id uuid not null,
  storage_path text not null,
  public_url text not null,
  transcript text null,
  created_at timestamptz not null default now(),
  constraint card_voice_notes_pkey primary key (id),
  constraint card_voice_notes_card_id_fkey foreign key (card_id) references public.visiting_cards (id) on delete cascade
);

create index if not exists idx_card_voice_notes_card_id on public.card_voice_notes using btree (card_id, created_at desc);

-- Backfill: carry each card's existing single voice note forward as its
-- first entry, so nothing already recorded disappears from the dashboard.
-- The "not exists" guard makes this safe to re-run.
insert into public.card_voice_notes (card_id, storage_path, public_url, transcript, created_at)
select
  vc.id,
  coalesce(vc.voice_note_path, ''),
  vc.voice_note_public_url,
  vc.transcribed_note,
  vc.updated_at
from public.visiting_cards vc
where vc.voice_note_public_url is not null
  and not exists (select 1 from public.card_voice_notes cvn where cvn.card_id = vc.id);

-- visiting_cards.voice_note_path/voice_note_public_url/transcribed_note are
-- left in place (harmless, historical) but the app stops writing to them
-- going forward — see server/src/services/voiceNoteService.ts.
