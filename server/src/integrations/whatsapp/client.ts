import axios from "axios";
import crypto from "node:crypto";
import { env } from "../../config/env";
import { childLogger } from "../../lib/logger";
import { InteractiveButton } from "./types";

const log = childLogger("whatsapp-client");

const graph = axios.create({
  baseURL: `https://graph.facebook.com/${env.WHATSAPP_GRAPH_API_VERSION}`,
  headers: { Authorization: `Bearer ${env.WHATSAPP_ACCESS_TOKEN}` },
});

function messagesUrl(phoneNumberId: string): string {
  return `/${phoneNumberId}/messages`;
}

async function sendText(
  phoneNumberId: string,
  to: string,
  body: string,
  opts: { replyToMessageId?: string } = {},
): Promise<void> {
  await graph.post(messagesUrl(phoneNumberId), {
    messaging_product: "whatsapp",
    to,
    ...(opts.replyToMessageId ? { context: { message_id: opts.replyToMessageId } } : {}),
    type: "text",
    text: { preview_url: false, body },
  });
}

/** Free-form (not pre-approved) interactive button message. WhatsApp allows
 * up to 3 reply buttons per message. Use this instead of a Message Template
 * for anything sent inside the 24h customer-service window — it needs no
 * Meta Business Manager approval, unlike the original n8n flow's
 * templates. See docs/WHATSAPP_TEMPLATES.md. */
async function sendButtons(
  phoneNumberId: string,
  to: string,
  bodyText: string,
  buttons: InteractiveButton[],
): Promise<void> {
  await graph.post(messagesUrl(phoneNumberId), {
    messaging_product: "whatsapp",
    to,
    type: "interactive",
    interactive: {
      type: "button",
      body: { text: bodyText },
      action: {
        buttons: buttons.map((b) => ({ type: "reply", reply: { id: b.id, title: b.title } })),
      },
    },
  });
}

export interface ListRow {
  id: string;
  title: string;
  description?: string;
}

/** Interactive list message — used for the main menu, which needs more
 * options than the 3-button limit on interactive button messages. */
async function sendList(
  phoneNumberId: string,
  to: string,
  bodyText: string,
  buttonLabel: string,
  rows: ListRow[],
): Promise<void> {
  await graph.post(messagesUrl(phoneNumberId), {
    messaging_product: "whatsapp",
    to,
    type: "interactive",
    interactive: {
      type: "list",
      body: { text: bodyText },
      action: { button: buttonLabel, sections: [{ rows }] },
    },
  });
}

/** Sends a pre-approved Message Template. Required for the very first
 * outbound message to a user (or any message sent outside the 24h
 * session window) — free-form messages are rejected in that case. */
async function sendTemplate(
  phoneNumberId: string,
  to: string,
  templateName: string,
  languageCode = "en",
  components?: unknown[],
): Promise<void> {
  await graph.post(messagesUrl(phoneNumberId), {
    messaging_product: "whatsapp",
    to,
    type: "template",
    template: {
      name: templateName,
      language: { code: languageCode },
      ...(components ? { components } : {}),
    },
  });
}

async function sendContactCard(
  phoneNumberId: string,
  to: string,
  contact: {
    formattedName: string;
    firstName: string;
    lastName: string;
    company: string;
    title: string;
    email: string;
    phone: string;
    waId: string;
    website: string;
  },
): Promise<void> {
  await graph.post(messagesUrl(phoneNumberId), {
    messaging_product: "whatsapp",
    to,
    type: "contacts",
    contacts: [
      {
        name: {
          formatted_name: contact.formattedName,
          first_name: contact.firstName,
          last_name: contact.lastName,
        },
        org: { company: contact.company, title: contact.title },
        emails: contact.email ? [{ email: contact.email, type: "WORK" }] : [],
        phones: contact.phone
          ? [{ phone: contact.phone, wa_id: contact.waId, type: "WORK" }]
          : [],
        urls: contact.website ? [{ url: contact.website, type: "WORK" }] : [],
      },
    ],
  });
}

async function getMediaUrl(mediaId: string): Promise<{ url: string; mimeType: string }> {
  const { data } = await graph.get(`/${mediaId}`);
  return { url: data.url, mimeType: data.mime_type };
}

async function downloadMedia(url: string): Promise<Buffer> {
  const { data } = await axios.get<ArrayBuffer>(url, {
    headers: { Authorization: `Bearer ${env.WHATSAPP_ACCESS_TOKEN}` },
    responseType: "arraybuffer",
  });
  return Buffer.from(data);
}

/** Downloads a WhatsApp media object by id in one call (metadata lookup +
 * fetch), mirroring the original flow's two-step "Get Media Info" /
 * "Download File" HTTP nodes. */
async function downloadMediaById(mediaId: string): Promise<{ buffer: Buffer; mimeType: string }> {
  const { url, mimeType } = await getMediaUrl(mediaId);
  const buffer = await downloadMedia(url);
  return { buffer, mimeType };
}

/** Verifies the `X-Hub-Signature-256` header Meta sends on every webhook
 * call, using the app secret. Skips verification (with a warning) if no
 * app secret is configured, so local development still works. */
function verifySignature(rawBody: Buffer, signatureHeader: string | undefined): boolean {
  if (!env.WHATSAPP_APP_SECRET) {
    log.warn("WHATSAPP_APP_SECRET not set — skipping webhook signature verification");
    return true;
  }
  if (!signatureHeader) return false;

  const expected = crypto
    .createHmac("sha256", env.WHATSAPP_APP_SECRET)
    .update(rawBody)
    .digest("hex");
  const provided = signatureHeader.replace("sha256=", "");

  try {
    return crypto.timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(provided, "hex"));
  } catch {
    return false;
  }
}

export const whatsappClient = {
  sendText,
  sendButtons,
  sendList,
  sendTemplate,
  sendContactCard,
  getMediaUrl,
  downloadMedia,
  downloadMediaById,
  verifySignature,
};
