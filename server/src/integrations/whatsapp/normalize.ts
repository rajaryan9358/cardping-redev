import { NormalizedWhatsAppMessage } from "./types";

/** Reduces a raw `POST /webhooks/whatsapp` body down to the single message
 * it contains, or null for delivery/read status callbacks and anything
 * else we don't act on. Ported from the original "Normalize WA Payload"
 * Code node, adapted to the Cloud API's actual message shapes. */
export function normalizeWhatsAppWebhook(body: any): NormalizedWhatsAppMessage | null {
  const value = body?.entry?.[0]?.changes?.[0]?.value;
  if (!value) return null;

  const phoneNumberId: string | undefined = value.metadata?.phone_number_id;
  const message = value.messages?.[0];
  const contactName: string | null = value.contacts?.[0]?.profile?.name ?? null;

  if (!message || !phoneNumberId) {
    // Delivery/read status callback, or a shape we don't recognise.
    return null;
  }

  const base = {
    from: message.from as string,
    phoneNumberId,
    waMessageId: message.id as string,
    contextMessageId: (message.context?.id as string | undefined) ?? null,
    contactName,
  };

  switch (message.type) {
    case "text":
      return {
        ...base,
        type: "text",
        text: message.text?.body ?? null,
        buttonText: null,
        buttonId: null,
        mediaId: null,
      };
    case "image":
      return {
        ...base,
        type: "image",
        text: null,
        buttonText: null,
        buttonId: null,
        mediaId: message.image?.id ?? null,
      };
    case "audio":
      return {
        ...base,
        type: "audio",
        text: null,
        buttonText: null,
        buttonId: null,
        mediaId: message.audio?.id ?? null,
      };
    case "button":
      return {
        ...base,
        type: "button",
        text: null,
        buttonText: message.button?.text ?? message.button?.payload ?? null,
        buttonId: message.button?.payload ?? null,
        mediaId: null,
      };
    case "interactive": {
      const interactive = message.interactive ?? {};
      if (interactive.type === "button_reply") {
        return {
          ...base,
          type: "button",
          text: null,
          buttonText: interactive.button_reply?.title ?? null,
          buttonId: interactive.button_reply?.id ?? null,
          mediaId: null,
        };
      }
      if (interactive.type === "list_reply") {
        return {
          ...base,
          type: "list",
          text: null,
          buttonText: interactive.list_reply?.title ?? null,
          buttonId: interactive.list_reply?.id ?? null,
          mediaId: null,
        };
      }
      return {
        ...base,
        type: "interactive",
        text: JSON.stringify(interactive),
        buttonText: null,
        buttonId: null,
        mediaId: null,
      };
    }
    default:
      return {
        ...base,
        type: "unknown",
        text: null,
        buttonText: null,
        buttonId: null,
        mediaId: null,
      };
  }
}
