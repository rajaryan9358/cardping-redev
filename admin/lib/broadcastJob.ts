import "server-only";
import { adminBroadcastsRepo, AdminCampaignRow } from "./repositories/adminBroadcasts.repo";
import { sendTelegramBroadcastMessage, sendWhatsAppTemplate } from "./broadcastSend";

const SEND_DELAY_MS = 300;

interface WhatsAppBody {
  languageCode: string;
  variables: string[];
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
      whatsAppBody = JSON.parse(body) as WhatsAppBody;
    } catch {
      await adminBroadcastsRepo.setCampaignStatus(campaignId, "failed");
      return;
    }
  }

  let sentCount = 0;
  for (const recipient of recipients) {
    try {
      if (channel === "whatsapp") {
        const to = recipient.user?.wa_id;
        if (!to) throw new Error("User has no wa_id");
        if (!templateName || !whatsAppBody) throw new Error("Missing template");
        await sendWhatsAppTemplate(to, templateName, whatsAppBody.languageCode, whatsAppBody.variables);
      } else {
        const chatId = recipient.user?.telegram_chat_id;
        if (!chatId) throw new Error("User has no telegram_chat_id");
        await sendTelegramBroadcastMessage(chatId, body);
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
