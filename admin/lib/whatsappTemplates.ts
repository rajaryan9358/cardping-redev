import "server-only";
import { appEnvFiles } from "./appEnvFiles";

export interface WhatsAppTemplate {
  name: string;
  language: string;
  category: string;
}

/** Lists Meta-approved WhatsApp Message Templates for the Broadcasts/
 * Send-message template pickers. Returns [] (never throws) if
 * WHATSAPP_BUSINESS_ACCOUNT_ID isn't set in server/.env yet or the call
 * fails — callers fall back to manual template-name entry, which was the
 * only option before this existed, so an empty list never regresses
 * anything. */
export async function listApprovedTemplates(): Promise<WhatsAppTemplate[]> {
  const [token, wabaId, apiVersion] = await Promise.all([
    appEnvFiles.readEnvValue("server", "WHATSAPP_ACCESS_TOKEN"),
    appEnvFiles.readEnvValue("server", "WHATSAPP_BUSINESS_ACCOUNT_ID"),
    appEnvFiles.readEnvValue("server", "WHATSAPP_GRAPH_API_VERSION"),
  ]);
  if (!token || !wabaId) return [];

  try {
    const response = await fetch(
      `https://graph.facebook.com/${apiVersion || "v23.0"}/${wabaId}/message_templates?fields=name,language,status,category&limit=200`,
      { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" },
    );
    if (!response.ok) return [];

    const body = await response.json();
    const data = (body.data ?? []) as { name: string; language: string; status: string; category: string }[];
    return data
      .filter((t) => t.status === "APPROVED")
      .map((t) => ({ name: t.name, language: t.language, category: t.category }));
  } catch {
    return [];
  }
}
