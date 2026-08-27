-- Backfills accounts.active_event_id for accounts that set their current
-- event before the channel/account model fix (2026-08-27_channel_account
-- model_fix.sql) went live. That migration made new event-sets write to
-- the account, and user_with_event coalesce account-level over per-channel
-- — but an account that hadn't touched its current event since had nothing
-- at the account level to coalesce from, so it kept showing whichever
-- per-channel value each individual identity happened to have (exactly
-- the "current event is still per-channel" symptom this fixes).
--
-- Picks, per account, the most recently set per-channel active_event_id
-- across its linked identities (channel_links.unlinked_at is null) —
-- matters when two channels on the same account disagree, which can
-- happen from before this was ever synced account-wide. Only touches
-- accounts with nothing already set at the account level, so it can't
-- clobber a real post-fix account-level choice; safe to re-run.
update public.accounts a
set active_event_id = sub.active_event_id,
    active_event_set_at = sub.active_event_set_at
from (
  select distinct on (cl.account_id)
    cl.account_id,
    u.active_event_id,
    u.active_event_set_at
  from public.channel_links cl
  join public.users u on u.id = cl.users_id
  where cl.unlinked_at is null and u.active_event_id is not null
  order by cl.account_id, u.active_event_set_at desc nulls last
) sub
where a.id = sub.account_id and a.active_event_id is null;
