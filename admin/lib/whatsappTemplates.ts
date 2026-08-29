import "server-only";
import { appEnvFiles } from "./appEnvFiles";

export interface WhatsAppTemplate {
  name: string;
  language: string;
  category: string;
  // null when the template has no BODY component, or Meta didn't return
  // one (shouldn't happen for an APPROVED template, but stay defensive).
  bodyText: string | null;
  // Count of distinct {{n}} slots in the BODY text, 0 if none. Meta
  // numbers slots sequentially from 1 with no gaps, so the count of
  // distinct numbers found IS the slot count.
  variableCount: number;
}

interface TemplateComponent {
  type?: string;
  text?: string;
}

/** Finds the BODY component's text and counts its {{n}} slots — the
 * `fields` param below now requests `components`, which the old
 * name/language/category-only fetch never did, so this data simply
 * didn't exist in the app before (see BroadcastComposer's template-body
 * preview + per-slot field mapping). */
function parseBodySlots(components: unknown): { bodyText: string | null; variableCount: number } {
  if (!Array.isArray(components)) return { bodyText: null, variableCount: 0 };
  const body = (components as TemplateComponent[]).find((c) => c.type === "BODY");
  if (!body?.text) return { bodyText: null, variableCount: 0 };

  const slotNumbers = new Set<number>();
  for (const match of body.text.matchAll(/\{\{(\d+)\}\}/g)) {
    slotNumbers.add(Number(match[1]));
  }
  return { bodyText: body.text, variableCount: slotNumbers.size };
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
      `https://graph.facebook.com/${apiVersion || "v23.0"}/${wabaId}/message_templates?fields=name,language,status,category,components&limit=200`,
      { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" },
    );
    if (!response.ok) return [];

    const body = await response.json();
    const data = (body.data ?? []) as { name: string; language: string; status: string; category: string; components?: unknown }[];
    return data
      .filter((t) => t.status === "APPROVED")
      .map((t) => ({ name: t.name, language: t.language, category: t.category, ...parseBodySlots(t.components) }));
  } catch {
    return [];
  }
}
