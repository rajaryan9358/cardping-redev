import "server-only";
import { adminBroadcastsRepo, AdminCampaignRow } from "./repositories/adminBroadcasts.repo";
import { sendTelegramBroadcastMessage, sendWhatsAppTemplate } from "./broadcastSend";
import { resolveField, sanitizeForWhatsApp, substituteTelegramTokens } from "./broadcastFieldResolver";
import { SlotValue } from "./broadcastFields";

const SEND_DELAY_MS = 300;

interface WhatsAppBody {
  languageCode: string;
  slots: SlotValue[];
}

// A campaign created before per-recipient variables shipped has body
// shape {languageCode, variables: string[]} — every slot was a literal,
// campaign-wide string. Resending one of those must keep working, so a
// legacy `variables` array is treated as all-literal slots rather than
// rejected outright.
function normalizeWhatsAppBody(parsed: { languageCode: string; slots?: SlotValue[]; variables?: string[] }): WhatsAppBody {
  if (parsed.slots) return { languageCode: parsed.languageCode, slots: parsed.slots };
  const variables = parsed.variables ?? [];
  return { languageCode: parsed.languageCode, slots: variables.map((value) => ({ type: "literal", value })) };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Runs to completion in the background — the Server Action that kicks
 * this off does not await it (see broadcasts/actions.ts). One HTTP call
 * per recipient, rate-limited with a fixed delay; progress is visible by
 * refreshing the Broadcasts screen, which re-queries recipient counts. */
export async function runBroadcastCampaign(
  campaignId: string,
  channel: AdminCampaignRow["channel"],
  templateName: string | null,
  body: string,
): Promise<void> {
  const recipients = await adminBroadcastsRepo.getPendingRecipients(campaignId);
  if (recipients.length === 0) {
    // Nobody to send to means nothing was actually delivered — surface it
    // as failed rather than a misleadingly reassuring "completed".
    await adminBroadcastsRepo.setCampaignStatus(campaignId, "failed");
    return;
  }

  let whatsAppBody: WhatsAppBody | null = null;
  if (channel === "whatsapp") {
    try {
      whatsAppBody = normalizeWhatsAppBody(JSON.parse(body));
    } catch {
      await adminBroadcastsRepo.setCampaignStatus(campaignId, "failed");
      return;
    }
  }

  // Campaign-wide (not per-recipient) — cheap enough to fetch once
  // regardless of whether the template even uses the Subscription field.
  const planNamesById = await adminBroadcastsRepo.getPlanNamesById();

  let sentCount = 0;
  for (const recipient of recipients) {
    try {
      if (channel === "whatsapp") {
        const to = recipient.wa_id;
        if (!to) throw new Error("User has no wa_id");
        if (!templateName || !whatsAppBody) throw new Error("Missing template");
        const variables = whatsAppBody.slots.map((slot) =>
          slot.type === "literal" ? sanitizeForWhatsApp(slot.value) : resolveField(slot.field, recipient, planNamesById),
        );
        await sendWhatsAppTemplate(to, templateName, whatsAppBody.languageCode, variables);
      } else {
        const chatId = recipient.telegram_chat_id;
        if (!chatId) throw new Error("User has no telegram_chat_id");
        const resolvedMessage = substituteTelegramTokens(body, recipient, planNamesById);
        await sendTelegramBroadcastMessage(chatId, resolvedMessage);
      }
      await adminBroadcastsRepo.setRecipientResult(recipient.id, "sent", null);
      sentCount += 1;
    } catch (error) {
      await adminBroadcastsRepo.setRecipientResult(
        recipient.id,
        "failed",
        error instanceof Error ? error.message : "Unknown error",
      );
    }
    await sleep(SEND_DELAY_MS);
  }

  // Every recipient failing (sentCount 0) isn't a "completed" run from the
  // sender's point of view — nothing actually went out.
  await adminBroadcastsRepo.setCampaignStatus(campaignId, sentCount > 0 ? "completed" : "failed");
}
