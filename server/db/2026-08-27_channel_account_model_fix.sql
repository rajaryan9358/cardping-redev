-- Schema update: fix the channel/account data model so disconnecting a
-- channel never hides account data or forgets account-wide state
-- (2026-08-27). Run against the self-hosted Postgres the same way
-- schema.sql itself is applied — all statements are idempotent.
--
-- Context: channel_links previously had NO way to represent "this channel
-- was connected, then disconnected" — disconnect hard-deleted the row.
-- That made every dashboard/admin query built on "does a channel_links
-- row exist" (data ownership, event state) treat a disconnected identity
-- as if it never existed at all: cards vanished from the Directory, the
-- admin Users page showed a second orphaned row, and reconnecting could
-- even fork a brand-new `users` row (WhatsApp's number-format mismatch)
-- that started with no history at all. See the `user_with_event` view
-- change in schema.sql (companion edit to this file) for the read-side
-- half of this fix.

-- ── channel_links: soft-delete instead of hard-delete ────────────────────
-- Disconnect now sets unlinked_at instead of deleting the row, so the
-- connection's history (when linked, when unlinked) is preserved
-- permanently rather than destroyed — this is also the actual "record of
-- all channel connections, even if disconnected" the app now keeps.
-- Reconnecting the same identifier to the same account reuses this same
-- row (clears unlinked_at) rather than inserting a new one — consistent
-- with the existing idx_channel_links_users_id unique constraint, which
-- already guarantees at most one channel_links row per users.id ever.
alter table public.channel_links add column if not exists unlinked_at timestamptz null;

-- ── accounts: account-wide "current event" ───────────────────────────────
-- Previously active_event_id/active_event_set_at lived only on `users`
-- (one specific channel identity), so switching which channel you scan
-- from — or disconnecting and reconnecting the same one — could lose the
-- event or ask again unnecessarily. Once a users row is linked to an
-- account, the account's own active_event_id becomes the source of truth
-- (shared across every channel linked to it); the users-row columns stay
-- as the fallback for bot-only usage with no dashboard account at all.
-- See user_with_event's coalesce(a.active_event_id, u.active_event_id).
alter table public.accounts add column if not exists active_event_id uuid null references public.events (id) on delete set null;
alter table public.accounts add column if not exists active_event_set_at timestamptz null;
