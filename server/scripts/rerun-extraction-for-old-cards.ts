/**
 * One-time admin backfill: re-runs the current card-extraction logic
 * (multi-value phones/emails/addresses/websites, business/personal email
 * classification, phone normalization, prominence ordering, QR code
 * content, additional-info catch-all — see
 * server/src/integrations/ai/visionPrompt.ts) against cards scanned before
 * that logic existed, and overwrites their extracted fields in place.
 *
 * Does NOT touch coin balances. It calls the vision provider directly
 * (extractCardWithMeta) and writes to visiting_cards with the service-role
 * DB client — it never goes through cardService.processCardImage or
 * walletService.charge, which are the only places a scan ever costs a
 * credit. Re-running this script costs real AI provider money (each card
 * is a real vision API call, logged to ai_provider_usage_log same as a
 * normal scan) but never touches any account's or channel's coin_balance.
 *
 * Meant to be run once, by whoever administers the server (from a shell
 * with access to server/.env — this is not exposed anywhere in the admin
 * web UI, on purpose, since a stray click here shouldn't be able to
 * re-bill every card in the database against the AI provider). Use
 * --before to scope it to cards scanned before this feature shipped,
 * so a second run doesn't waste money re-extracting cards that were
 * already scanned with the new logic.
 *
 * Usage (dry run by default — reports what it would do, changes nothing):
 *   npx tsx scripts/rerun-extraction-for-old-cards.ts --before 2026-08-27
 * Apply for real:
 *   npx tsx scripts/rerun-extraction-for-old-cards.ts --before 2026-08-27 --apply
 *
 * Useful flags:
 *   --before <ISO date>   only cards created before this date (recommended
 *                         — pass the date this feature deployed)
 *   --limit <n>           stop after processing n cards (try a handful first)
 *   --ids id1,id2,...     only these specific card ids (e.g. to retry ones
 *                         that failed on a previous run)
 *   --delay-ms <n>        pause between cards, default 1000 — keeps this
 *                         well under any provider's requests-per-minute cap
 */
import "dotenv/config";
import { supabase } from "../src/db/client";
import { extractCardWithMeta } from "../src/integrations/ai/vision";
import { aiUsageLogRepo } from "../src/db/repositories/aiUsageLog.repo";
import { ExtractedCard } from "../src/types/domain";

const APPLY = process.argv.includes("--apply");
const PAGE_SIZE = 200;

function flag(name: string): string | null {
  const i = process.argv.indexOf(name);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : null;
}

const BEFORE = flag("--before");
const LIMIT = flag("--limit") ? Number(flag("--limit")) : null;
const ONLY_IDS = flag("--ids")?.split(",").map((s) => s.trim()).filter(Boolean) ?? null;
const DELAY_MS = flag("--delay-ms") ? Number(flag("--delay-ms")) : 1000;

interface CardRow {
  id: string;
  full_name: string | null;
  image_public_url: string | null;
  back_image_public_url: string | null;
  created_at: string;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Mirrors visitingCards.repo.ts#joinLines exactly — every repeatable field
// (phones/emails/addresses/websites) collapses into the one newline-joined
// column each already stores, same shape a fresh scan writes.
function joinLines(values: string[]): string | null {
  const cleaned = Array.from(new Set(values.map((v) => v.trim()).filter((v) => v.length > 0)));
  return cleaned.length > 0 ? cleaned.join("\n") : null;
}

async function downloadImage(url: string): Promise<{ buffer: Buffer; mimeType: string }> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`image download failed: ${res.status}`);
  const mimeType = res.headers.get("content-type") ?? "image/jpeg";
  const buffer = Buffer.from(await res.arrayBuffer());
  return { buffer, mimeType };
}

function buildPatch(extracted: ExtractedCard) {
  return {
    full_name: extracted.person_name || null,
    position: extracted.job_title || null,
    company_name: extracted.company_name || null,
    address: joinLines(extracted.addresses),
    phone1: joinLines(extracted.phones),
    business_email: joinLines(extracted.business_emails),
    personal_email: joinLines(extracted.personal_emails),
    website: joinLines(extracted.websites),
    linkedin: extracted.social_media.linkedin || null,
    twitter: extracted.social_media.twitter || null,
    facebook: extracted.social_media.facebook || null,
    qr_code_content: extracted.qr_code_content || null,
    additional_info: extracted.additional_info || null,
    extraction_confidence: extracted.confidence,
  };
}

async function fetchCards(): Promise<CardRow[]> {
  if (ONLY_IDS) {
    const { data, error } = await supabase
      .from("visiting_cards")
      .select("id, full_name, image_public_url, back_image_public_url, created_at")
      .in("id", ONLY_IDS);
    if (error) throw error;
    return (data ?? []) as CardRow[];
  }

  const rows: CardRow[] = [];
  let from = 0;
  for (;;) {
    let query = supabase
      .from("visiting_cards")
      .select("id, full_name, image_public_url, back_image_public_url, created_at")
      .not("image_public_url", "is", null)
      .order("created_at", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);
    if (BEFORE) query = query.lt("created_at", new Date(BEFORE).toISOString());

    const { data, error } = await query;
    if (error) throw error;
    if (!data || data.length === 0) break;
    rows.push(...(data as CardRow[]));
    if (data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }
  return rows;
}

async function main() {
  if (!BEFORE && !ONLY_IDS) {
    console.log(
      "No --before cutoff and no --ids given — this will re-run EVERY card with an image, including ones already " +
        "scanned with the current logic. Recommended: pass --before <the date this feature deployed>. Proceeding in 5s, Ctrl+C to cancel...",
    );
    await sleep(5000);
  }

  let cards = await fetchCards();
  if (LIMIT) cards = cards.slice(0, LIMIT);

  console.log(`${cards.length} card(s) to process.`);
  if (!APPLY) console.log("Dry run (pass --apply to actually make changes).\n");

  let ok = 0;
  let failed = 0;
  const failures: { id: string; error: string }[] = [];

  for (const [i, card] of cards.entries()) {
    console.log(`\n[${i + 1}/${cards.length}] card ${card.id} (${card.full_name || "unnamed"})`);
    try {
      if (!card.image_public_url) throw new Error("no front image");
      const front = await downloadImage(card.image_public_url);
      const back = card.back_image_public_url ? await downloadImage(card.back_image_public_url) : null;

      const { extracted, meta } = await extractCardWithMeta(
        front.buffer,
        front.mimeType,
        back?.buffer,
        back?.mimeType,
      );

      await aiUsageLogRepo.record({
        task: "vision_extraction",
        provider: meta.provider,
        model: meta.model,
        cardId: card.id,
        inputTokens: meta.inputTokens,
        outputTokens: meta.outputTokens,
        confidence: extracted.confidence,
        latencyMs: meta.latencyMs,
        success: true,
      });

      const patch = buildPatch(extracted);
      console.log(`  → ${extracted.person_name || "—"} · ${extracted.phones.length} phone(s), ${extracted.business_emails.length + extracted.personal_emails.length} email(s), ${extracted.websites.length} website(s)${extracted.qr_code_content ? ", QR code found" : ""}`);

      if (APPLY) {
        const { error } = await supabase.from("visiting_cards").update(patch).eq("id", card.id);
        if (error) throw error;
      }
      ok++;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.log(`  ✗ failed: ${message}`);
      failures.push({ id: card.id, error: message });
      failed++;
    }

    if (i < cards.length - 1) await sleep(DELAY_MS);
  }

  console.log(`\n${ok} card(s) ${APPLY ? "updated" : "would be updated"}, ${failed} failed.`);
  if (!APPLY && ok > 0) console.log("Re-run with --apply to make these changes.");
  if (failures.length > 0) {
    console.log(`\nFailed card ids (retry with --ids ${failures.map((f) => f.id).join(",")}):`);
    for (const f of failures) console.log(`  ${f.id}: ${f.error}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
