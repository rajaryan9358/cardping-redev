import "server-only";
import { appEnvFiles } from "./appEnvFiles";
import { HeaderMediaFormat } from "./broadcastFields";

export interface HeaderMedia {
  format: HeaderMediaFormat;
  link: string;
}

// Same duplication rationale as lib/vision.ts: a thin send client, kept in
// admin/ only, reading the actual WhatsApp/Telegram tokens out of
// server/.env at send time rather than copying them into admin/.env.
export async function sendWhatsAppTemplate(
  to: string,
  templateName: string,
  languageCode: string,
  variables: string[],
  header?: HeaderMedia | null,
): Promise<void> {
  const [token, phoneNumberId, apiVersion] = await Promise.all([
    appEnvFiles.readEnvValue("server", "WHATSAPP_ACCESS_TOKEN"),
    appEnvFiles.readEnvValue("server", "WHATSAPP_PHONE_NUMBER_ID"),
    appEnvFiles.readEnvValue("server", "WHATSAPP_GRAPH_API_VERSION"),
  ]);
  if (!token || !phoneNumberId) throw new Error("WhatsApp credentials not found in server/.env");

  // Order matters — Meta expects components in the same order they appear
  // in the template definition itself (HEADER, then BODY). The example
  // media submitted for a media-header template's approval is
  // preview-only and never reused automatically — every send needs a real
  // media reference supplied here, or Meta rejects it with "(#132012)
  // header component parameter should not be empty".
  const components: Record<string, unknown>[] = [];
  if (header) {
    const mediaType = header.format.toLowerCase();
    components.push({ type: "header", parameters: [{ type: mediaType, [mediaType]: { link: header.link } }] });
  }
  if (variables.length > 0) {
    components.push({ type: "body", parameters: variables.map((text) => ({ type: "text", text })) });
  }

  const response = await fetch(
    `https://graph.facebook.com/${apiVersion || "v23.0"}/${phoneNumberId}/messages`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        type: "template",
        template: { name: templateName, language: { code: languageCode }, ...(components.length > 0 ? { components } : {}) },
      }),
    },
  );
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`WhatsApp send failed (${response.status}): ${detail}`);
  }
}

/** Free-form WhatsApp text — only valid within Meta's 24h customer-service
 * window (see docs/WHATSAPP_TEMPLATES.md). Callers (the Send Message
 * modal) are responsible for checking users.last_login before using this
 * instead of sendWhatsAppTemplate. */
export async function sendWhatsAppText(to: string, body: string): Promise<void> {
  const [token, phoneNumberId, apiVersion] = await Promise.all([
    appEnvFiles.readEnvValue("server", "WHATSAPP_ACCESS_TOKEN"),
    appEnvFiles.readEnvValue("server", "WHATSAPP_PHONE_NUMBER_ID"),
    appEnvFiles.readEnvValue("server", "WHATSAPP_GRAPH_API_VERSION"),
  ]);
  if (!token || !phoneNumberId) throw new Error("WhatsApp credentials not found in server/.env");

  const response = await fetch(
    `https://graph.facebook.com/${apiVersion || "v23.0"}/${phoneNumberId}/messages`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        type: "text",
        text: { preview_url: false, body },
      }),
    },
  );
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`WhatsApp send failed (${response.status}): ${detail}`);
  }
}

export async function sendTelegramBroadcastMessage(chatId: string, text: string): Promise<void> {
  const token = await appEnvFiles.readEnvValue("server", "TELEGRAM_BOT_TOKEN");
  if (!token) throw new Error("TELEGRAM_BOT_TOKEN not found in server/.env");

  const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" }),
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Telegram send failed (${response.status}): ${detail}`);
  }
}
