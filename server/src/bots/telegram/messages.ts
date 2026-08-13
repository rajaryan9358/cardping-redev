import { telegramClient } from "../../integrations/telegram/client";
import { ExtractedCard } from "../../types/domain";
import { Ids } from "./ids";

export async function sendMainMenu(chatId: string, greeting: string): Promise<void> {
  await telegramClient.sendMessage(chatId, greeting, {
    buttonRows: [
      [{ text: "📇 Scan a Business Card", data: Ids.menuScan }],
      [{ text: "🏷️ Set an Event", data: Ids.menuSetEvent }],
      [{ text: "🪙 Buy Credits", data: Ids.menuBuyCredits }],
      [{ text: "⚙️ Account Settings", data: Ids.menuAccount }],
    ],
  });
}

export function formatCardSummary(card: ExtractedCard): string {
  return [
    `Name: <b>${card.person_name || "—"}</b>`,
    `Business: <b>${card.company_name || "—"}</b>`,
    `Designation: <b>${card.job_title || "—"}</b>`,
    `Email: ${card.primary_email || "—"}`,
    `Website: ${card.website || "—"}`,
    `Contact: ${card.primary_phone || "—"}`,
  ].join("\n");
}

export const Copy = {
  insufficientCoins: (balance: number) =>
    `❌ Insufficient coins!\n\n🪙 Current balance: ${balance}\n💳 You need at least 1 coin to process a visiting card.\n\nTap Buy Credits in the menu to top up.`,
  needEventFirst:
    "Let's set an event name first so your scanned cards stay organised. What would you like to call it?",
  askNewEventName: "What would you like to name the new event?",
  eventConfirmed: (name: string) => `Great, your event <b>${name}</b> is set up. Now you can send visiting cards.`,
  currentEventChangePrompt: (name: string) => `Your current event is <b>${name}</b>. Change it?`,
  keepingCurrentEvent: (name: string) => `Keeping the current event: <b>${name}</b>.`,
  askForPhoto: "Sure — send a clear photo of a business card. Good lighting helps accuracy!",
  voiceNoteHint: "Want to add a voice note about this contact? Reply to this message with a voice note.",
  voiceNoteSaved: "Transcript successfully created ✅",
  voiceNoteMustReplyToCard: "🚫 A voice note must be sent as a reply to a scanned card message.",
  emailReviewPrompt: (subject: string, body: string) =>
    `I drafted a follow-up email for this contact:\n\n<b>Subject:</b> ${subject}\n\n${body}\n\nSave it as a Gmail draft?`,
  emailDraftSaved: "I've saved the draft in your Gmail 😊",
  emailDraftDismissed: "No worries, I won't send that draft.",
  gmailNotConnected: (authUrl: string) =>
    `You haven't connected Gmail yet. Tap the link below to connect it, then try again:\n${authUrl}`,
  accountSettingsPrompt: "What would you like to do?",
  coinBalance: (balance: number) => `You have <b>${balance}</b> coins remaining.`,
  paymentLink: (url: string) => `Click here to top up your account:\n${url}`,
  gmailConnected: "Gmail connected! You can now save AI-drafted follow-up emails as drafts.",
};
