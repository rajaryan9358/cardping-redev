-- Schema update: multi-value card fields + QR code + additional info
-- (2026-08-27). Run against the self-hosted Postgres the same way
-- schema.sql itself is applied — all statements are idempotent.
--
-- Context: extraction now collects every phone number/email/address a
-- card actually has instead of picking one (see
-- server/src/integrations/ai/visionPrompt.ts) — each set is joined into
-- one newline-separated value per existing column (visiting_cards.phone1/
-- business_email/personal_email/address) rather than needing new columns
-- for "phone 3", "email 2", etc. `phone2` is untouched (old rows keep
-- whatever they have there; new scans just stop writing to it). The two
-- genuinely new things a card can have are a QR code's decoded content
-- and a catch-all for anything that doesn't fit another field, which do
-- need their own columns.

alter table public.visiting_cards add column if not exists qr_code_content text null;
alter table public.visiting_cards add column if not exists additional_info text null;

-- cards_export_view also picked up these two columns in schema.sql (its
-- own single canonical definition, extended in place like user_with_event
-- — see that file's comment) — re-apply it here since it won't otherwise
-- get picked up by anything short of re-running all of schema.sql.
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
  vc.created_at::date as card_date,
  vc.qr_code_content,
  vc.additional_info
from
  public.visiting_cards vc
  join public.users u on u.id = vc.user_id
  left join public.events e on e.id = vc.event_id;
