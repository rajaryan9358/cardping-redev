/**
 * One-off cleanup for the +91-prefix wa_id bug (fixed 2026-08-27, see
 * server/src/integrations/whatsapp/normalize.ts#normalizeWaId).
 *
 * Before that fix, reconnecting WhatsApp via the dashboard's "Connect
 * WhatsApp" form built the identifier as `+91${digits}` and compared it
 * exact-match against `users.wa_id` — but every webhook-created row (the
 * vast majority of real users) stores `wa_id` as bare digits, no `+`.
 * A mismatch silently forked a brand-new `users` row instead of finding
 * the existing one, so:
 *   - the ORIGINAL row (bare digits) keeps all the real card/event
 *     history, but has no active channel_links row anymore (its old one
 *     was disconnected, or it was never linked at all) — every future
 *     inbound WhatsApp message resolves to THIS row (Meta always sends
 *     bare digits), so the bot treats the person as "not linked yet."
 *   - the DUPLICATE row (`+91...`) is the one the dashboard actually
 *     linked to the account — it has no card history (nothing in the
 *     scan flow can ever reach it, since inbound messages never resolve
 *     to it) but does hold the live channel_links row and an untouched
 *     starter coin grant.
 *
 * This script finds every such pair and merges the duplicate back into
 * the original: reassigns any cards/events the duplicate happens to own
 * (defensive — expected to be none), moves the live channel_links
 * connection onto the original identity, folds any leftover starter
 * balance into the account, and normalizes the duplicate's wa_id so nothing
 * can collide on it again. A `+91...` row with no bare-digit counterpart
 * (never actually double-booked, just mis-formatted) has its wa_id
 * normalized in place — no merge needed.
 *
 * Depends on the 2026-08-27 channel/account schema migration already
 * being applied (uses channel_links.unlinked_at).
 *
 * Usage (dry run by default — reports what it would do, changes nothing):
 *   npx tsx scripts/merge-duplicate-whatsapp-identities.ts
 * Apply for real:
 *   npx tsx scripts/merge-duplicate-whatsapp-identities.ts --apply
 */
import "dotenv/config";
import { supabase } from "../src/db/client";
import { accountsRepo } from "../src/db/repositories/accounts.repo";

const APPLY = process.argv.includes("--apply");

interface UserRow {
  id: string;
  wa_id: string | null;
  coin_balance: number;
}

interface ChannelLinkRow {
  id: string;
  account_id: string;
  users_id: string;
  channel: string;
  channel_identifier: string;
  unlinked_at: string | null;
}

function normalize(waId: string): string {
  return waId.replace(/\D/g, "");
}

async function main() {
  const { data: rows, error } = await supabase.from("users").select("id, wa_id, coin_balance").not("wa_id", "is", null);
  if (error) throw error;

  const suspects = (rows as UserRow[]).filter((u) => u.wa_id && /\D/.test(u.wa_id));
  console.log(`Scanned ${rows?.length ?? 0} WhatsApp identities — ${suspects.length} have a non-digit wa_id.`);
  if (!APPLY) console.log("Dry run (pass --apply to actually make changes).\n");

  let mergedPairs = 0;
  let normalizedOnly = 0;

  for (const dup of suspects) {
    const normalized = normalize(dup.wa_id!);
    console.log(`\n--- users.id=${dup.id}  wa_id="${dup.wa_id}"  →  "${normalized}" ---`);

    const { data: original, error: origErr } = await supabase
      .from("users")
      .select("id, wa_id, coin_balance")
      .eq("wa_id", normalized)
      .maybeSingle();
    if (origErr) throw origErr;

    if (!original) {
      console.log("  No bare-digit counterpart found — this identity was just mis-formatted, not duplicated.");
      console.log(`  Fix: set wa_id to "${normalized}".`);
      if (APPLY) {
        const { error: fixErr } = await supabase.from("users").update({ wa_id: normalized }).eq("id", dup.id);
        if (fixErr) throw fixErr;
      }
      normalizedOnly++;
      continue;
    }

    console.log(`  Duplicate pair — original users.id=${original.id} (the one future WhatsApp messages resolve to).`);

    const [cardCountRes, eventCountRes, linksRes] = await Promise.all([
      supabase.from("visiting_cards").select("id", { count: "exact", head: true }).eq("user_id", dup.id),
      supabase.from("events").select("id", { count: "exact", head: true }).eq("user_id", dup.id),
      supabase.from("channel_links").select("*").in("users_id", [dup.id, original.id]),
    ]);
    if (cardCountRes.error) throw cardCountRes.error;
    if (eventCountRes.error) throw eventCountRes.error;
    if (linksRes.error) throw linksRes.error;

    const cardCount = cardCountRes.count ?? 0;
    const eventCount = eventCountRes.count ?? 0;
    const links = (linksRes.data ?? []) as ChannelLinkRow[];
    const dupLink = links.find((l) => l.users_id === dup.id);
    const originalLink = links.find((l) => l.users_id === original.id);

    console.log(`  Duplicate owns ${cardCount} card(s), ${eventCount} event(s) — will reassign to the original.`);
    if (dupLink) {
      console.log(`  Duplicate is linked to account ${dupLink.account_id} (${dupLink.unlinked_at ? "disconnected" : "ACTIVE"}).`);
    } else {
      console.log("  Duplicate has no channel_links row.");
    }
    if (originalLink) {
      console.log(`  Original has its own channel_links row → account ${originalLink.account_id} (${originalLink.unlinked_at ? "disconnected" : "ACTIVE"}).`);
    }
    if (dup.coin_balance > 0) {
      console.log(`  Duplicate has an unmerged starter balance of ${dup.coin_balance} — will fold into the account.`);
    }

    if (!APPLY) {
      mergedPairs++;
      continue;
    }

    // Reassign any card/event history the duplicate happens to own —
    // expected to be zero in every real case (the scan flow can never
    // resolve to the duplicate), handled anyway for safety.
    if (cardCount > 0) {
      const { error: cardErr } = await supabase.from("visiting_cards").update({ user_id: original.id }).eq("user_id", dup.id);
      if (cardErr) throw cardErr;
    }
    if (eventCount > 0) {
      const { error: eventErr } = await supabase.from("events").update({ user_id: original.id }).eq("user_id", dup.id);
      if (eventErr) throw eventErr;
    }

    // Move the live connection onto the original identity.
    if (dupLink) {
      if (originalLink) {
        // Original already has its own (almost certainly disconnected)
        // link row — reactivate that one against the account the
        // duplicate was actually linked to, then drop the duplicate's.
        const { error: reactivateErr } = await supabase
          .from("channel_links")
          .update({
            account_id: dupLink.account_id,
            channel_identifier: normalized,
            unlinked_at: null,
            verified_at: new Date().toISOString(),
          })
          .eq("id", originalLink.id);
        if (reactivateErr) throw reactivateErr;
        const { error: deleteErr } = await supabase.from("channel_links").delete().eq("id", dupLink.id);
        if (deleteErr) throw deleteErr;
      } else {
        // No link on the original at all — simplest fix is repointing the
        // duplicate's live link row at the original identity in place.
        const { error: repointErr } = await supabase
          .from("channel_links")
          .update({ users_id: original.id, channel_identifier: normalized })
          .eq("id", dupLink.id);
        if (repointErr) throw repointErr;
      }
    }

    // Fold any leftover starter balance into the account (mirrors
    // walletService.mergeLegacyBalanceOnLink) — the duplicate was never
    // actually usable for scanning, so this is its untouched signup grant.
    const accountId = dupLink?.account_id ?? originalLink?.account_id ?? null;
    if (dup.coin_balance > 0 && accountId) {
      await accountsRepo.incrementCoinBalance(accountId, dup.coin_balance);
    }

    // Blank the duplicate's wa_id and zero its balance so it can never
    // collide or confuse anything again — the row itself is left in place
    // rather than deleted, in case it's ever needed for a support inquiry.
    const { error: cleanupErr } = await supabase.from("users").update({ wa_id: null, coin_balance: 0 }).eq("id", dup.id);
    if (cleanupErr) throw cleanupErr;

    console.log("  Merged.");
    mergedPairs++;
  }

  console.log(`\n${mergedPairs} duplicate pair(s) ${APPLY ? "merged" : "found (dry run)"}, ${normalizedOnly} identity(ies) ${APPLY ? "normalized" : "would be normalized"}.`);
  if (!APPLY) console.log("Re-run with --apply to make these changes.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
