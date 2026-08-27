-- Tracks which AI provider/model actually produced each card's current
-- extracted fields — set on every new scan (server/src/services/cardService.ts,
-- from the same VisionCallMeta already returned by extractCardWithMeta) and
-- overwritten whenever admin re-runs extraction with a specific model
-- picked from the "Re-run extraction" dialog (admin/app/(protected)/cards/
-- RerunExtractionModal.tsx) — lets an admin compare providers/models
-- against real cards and see exactly what produced what.
alter table public.visiting_cards add column if not exists extraction_provider text null;
alter table public.visiting_cards add column if not exists extraction_model text null;
