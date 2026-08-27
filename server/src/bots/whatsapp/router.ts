import { normalizeWhatsAppWebhook } from "../../integrations/whatsapp/normalize";
import { usersRepo } from "../../db/repositories/users.repo";
import { channelLinksRepo } from "../../db/repositories/channelLinks.repo";
import { whatsappClient } from "../../integrations/whatsapp/client";
import { childLogger } from "../../lib/logger";
import * as channelOnboardingService from "../../services/channelOnboardingService";
import { effectiveActiveEventName } from "../../services/eventService";
import { handleImage } from "./handlers/image";
import { handleAudio } from "./handlers/audio";
import { handleText } from "./handlers/text";
import { handleButton } from "./handlers/button";
import { tryContinuePendingState } from "./handlers/stateContinuation";
import { sendMainMenu, Copy } from "./messages";

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

  // Not yet linked to a dashboard account — hold off on everything else
  // and push them toward signup instead. Applies to every message, not
  // just the first, per product decision: no scanning until they link.
  const link = await channelLinksRepo.findActiveByUsersId(user.user_id);
  if (!link) {
    // Distinguish "never linked" (signup) from "linked before, currently
    // disconnected" (welcome back + login, so reconnecting picks up the
    // same account/history instead of being pitched free credits again).
    const everLinked = await channelLinksRepo.findAnyByUsersId(user.user_id);
    const onboardingUrl = await channelOnboardingService.createOnboardingLink(
      "whatsapp",
      message.from,
      everLinked ? "login" : "signup",
    );
    await whatsappClient.sendText(
      message.phoneNumberId,
      message.from,
      everLinked ? Copy.welcomeBackPrompt(onboardingUrl) : Copy.channelOnboardingPrompt(onboardingUrl),
    );
    return;
  }

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
      await sendMainMenu(
        message.phoneNumberId,
        message.from,
        "Not sure how to handle that — here's what I can do:",
        effectiveActiveEventName(user),
      );
  }
}
