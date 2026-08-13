import { normalizeWhatsAppWebhook } from "../../integrations/whatsapp/normalize";
import { usersRepo } from "../../db/repositories/users.repo";
import { childLogger } from "../../lib/logger";
import { handleImage } from "./handlers/image";
import { handleAudio } from "./handlers/audio";
import { handleText } from "./handlers/text";
import { handleButton } from "./handlers/button";
import { tryContinuePendingState } from "./handlers/stateContinuation";
import { sendMainMenu } from "./messages";

const log = childLogger("wa-router");

/** Entry point called by routes/whatsappWebhook.route.ts for every inbound
 * webhook body. Runs after the HTTP response has already been sent to
 * Meta, so errors here are logged rather than surfaced to the caller. */
export async function routeWhatsAppWebhook(body: unknown): Promise<void> {
  const message = normalizeWhatsAppWebhook(body);
  if (!message) return; // status callback or unrecognised payload — nothing to do

  const user = await usersRepo.findOrCreate(
    "whatsapp",
    message.from,
    message.waMessageId,
    message.contactName,
  );

  // A pending "wait for reply" state (set an event name, review an email
  // draft, ...) always takes priority over the normal menu dispatch, same
  // as an n8n execution paused on a "wait for response" node.
  if (user.user_state && user.user_state !== "idle") {
    const consumed = await tryContinuePendingState(message, user);
    if (consumed) return;
  }

  switch (message.type) {
    case "image":
      await handleImage(message, user);
      return;
    case "audio":
      await handleAudio(message, user);
      return;
    case "button":
    case "list":
      await handleButton(message, user);
      return;
    case "text":
      await handleText(message, user);
      return;
    default:
      log.info({ type: message.type, from: message.from }, "unhandled WhatsApp message type");
      await sendMainMenu(message.phoneNumberId, message.from, "Not sure how to handle that — here's what I can do:");
  }
}
