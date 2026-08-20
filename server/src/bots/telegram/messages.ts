import { telegramClient } from "../../integrations/telegram/client";
import { eventsRepo } from "../../db/repositories/events.repo";
import { ExtractedCard } from "../../types/domain";
import { SubscriptionStatus } from "../../services/subscriptionStatus";
import { formatEventLifetimeRemaining } from "../../services/eventService";
import { Ids } from "./ids";

export async function sendMainMenu(chatId: string, greeting: string, activeEventName: string | null = null): Promise<void> {
  await telegramClient.sendMessage(chatId, greeting, {
    buttonRows: [
      [{ text: "📇 Scan a Business Card", data: Ids.menuScan }],
      [{ text: activeEventName ? `🏷️ Change Event (${activeEventName})` : "🏷️ Set an Event", data: Ids.menuSetEvent }],
      [{ text: "🪙 Buy Credits", data: Ids.menuBuyCredits }],
      [{ text: "⚙️ Account Settings", data: Ids.menuAccount }],
      [{ text: "🖥️ View Dashboard", data: Ids.menuViewDashboard }],
    ],
  });
}

/** Recent events + "+ New Event" — shown both from the menu's Set/Change
 * Event action and when a photo arrives with no active (or expired) event,
 * see scanFlowService.ts. Callback data for existing events is prefixed
 * dynamically (Ids.eventPickPrefix + eventId) rather than fixed Ids. */
export async function sendEventPicker(chatId: string, usersId: string): Promise<void> {
  const events = await eventsRepo.listActiveForAccount([usersId]);
  // Kept at parity with WhatsApp's 9-event cap (its interactive-list rows
  // are hard-capped at 10 including "+ New Event") even though Telegram's
  // inline keyboards have no such limit — consistent UX across channels.
  const rows = events.slice(0, 9).map((e) => [{ text: e.name, data: `${Ids.eventPickPrefix}${e.id}` }]);
  rows.push([{ text: "+ New Event", data: Ids.eventPickerNew }]);
  await telegramClient.sendMessage(chatId, Copy.eventPickerPrompt, { buttonRows: rows });
}

export async function sendAccountSettingsMenu(
  chatId: string,
  status: SubscriptionStatus,
  scanBothSides: boolean,
  eventLifetimeHours: number | null,
  marketingOptIn: boolean,
): Promise<void> {
  await telegramClient.sendMessage(chatId, Copy.accountSettingsPrompt, {
    buttonRows: [
      [{ text: `🪙 Subscription & Balance (${subscriptionLabel(status)})`, data: Ids.accountSubscription }],
      [{ text: `🔁 Scan Both Sides: ${scanBothSides ? "On" : "Off"}`, data: Ids.accountScanBothSides }],
      [{ text: `⏱️ Event Lifetime: ${eventLifetimeLabel(eventLifetimeHours)}`, data: Ids.accountEventLifetime }],
      [{ text: `📣 Marketing Updates: ${marketingOptIn ? "On" : "Off"}`, data: Ids.accountMarketingOptIn }],
    ],
  });
}

export async function sendEventLifetimePicker(chatId: string): Promise<void> {
  await telegramClient.sendMessage(chatId, "How long should an event stay active before you're asked again?", {
    buttonRows: [
      [{ text: "1 hour", data: Ids.eventLifetime1h }],
      [{ text: "6 hours", data: Ids.eventLifetime6h }],
      [{ text: "12 hours", data: Ids.eventLifetime12h }],
      [{ text: "24 hours", data: Ids.eventLifetime24h }],
      [{ text: "48 hours", data: Ids.eventLifetime48h }],
      [{ text: "Always", data: Ids.eventLifetimeAlways }],
    ],
  });
}

export function eventLifetimeLabel(hours: number | null): string {
  return hours ? `${hours}h` : "Always";
}

function subscriptionLabel(status: SubscriptionStatus): string {
  if (status.tone === "active") return status.planName ?? "Active plan";
  if (status.tone === "expired") return `${status.planName ?? "Plan"} expired`;
  if (status.tone === "trial") return `Trial, ${status.coinBalance} coins`;
  return "No active plan";
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
  accountBlocked:
    "🚫 Your account is currently unable to scan cards. If you think this is a mistake, please contact support.",
  outOfCoinsNoPlan: (subscribeUrl: string, topUpUrl: string) =>
    `❌ Insufficient coins, and you don't have an active plan.\n\nSubscribe to a plan for recurring coins:\n${subscribeUrl}\n\nOr just top up:\n${topUpUrl}`,
  outOfCoinsHasPlan: (topUpUrl: string) =>
    `❌ Insufficient coins for now — top up to keep scanning:\n${topUpUrl}`,
  needEventFirst:
    "Let's set an event name first so your scanned cards stay organised. What would you like to call it?",
  askNewEventName: "What would you like to name the new event?",
  eventConfirmed: (name: string, lifetimeHours: number | null) =>
    `Great, your event <b>${name}</b> is set up (${lifetimeHours ? `active for ${lifetimeHours}h` : "no expiry"}). Now you can send visiting cards.`,
  eventSwitched: (name: string, lifetimeHours: number | null) =>
    `Switched to <b>${name}</b> (${lifetimeHours ? `active for ${lifetimeHours}h` : "no expiry"}).`,
  currentEventChangePrompt: (name: string, setAt: string | null, lifetimeHours: number | null) =>
    `Your current event is <b>${name}</b> (${formatEventLifetimeRemaining(setAt, lifetimeHours)}). Change it?`,
  keepingCurrentEvent: (name: string) => `Keeping the current event: <b>${name}</b>.`,
  eventPickerPrompt: "Which event should this go under?",
  askForPhoto: "Sure — send a clear photo of a business card. Good lighting helps accuracy!",
  askForBackPhoto: "Got the front — now send a photo of the <b>back</b> of the card.",
  processingCard: "📇 Got it — processing your card now…",
  tooManyImages:
    "🤔 Not sure how to handle more than 2 images at once — please send one photo, or two (front and back) of the same card.",
  voiceNoteHint: "Want to add a voice note about this contact? Reply to this photo or this message with a voice note.",
  voiceNoteSaved: "Transcript successfully created ✅",
  voiceNoteMustReplyToCard: "🚫 A voice note must be sent as a reply to a scanned card or its summary message.",
  accountSettingsPrompt: "What would you like to do?",
  subscriptionSummary: (status: SubscriptionStatus, manageUrl: string) => {
    const manage = `\n\nManage subscription: ${manageUrl}`;
    if (status.tone === "active") {
      const expires = status.planExpiresAt ? new Date(status.planExpiresAt).toLocaleDateString() : "—";
      return `You're on <b>${status.planName}</b>, renews/expires ${expires}.\n🪙 ${status.coinBalance} coins remaining.${manage}`;
    }
    if (status.tone === "expired") {
      return `Your <b>${status.planName}</b> plan expired.\n🪙 ${status.coinBalance} coins remaining.${manage}`;
    }
    if (status.tone === "trial") {
      return `You're on the free trial.\n🪙 ${status.coinBalance} coins remaining.${manage}`;
    }
    return `You don't have an active plan.\n🪙 ${status.coinBalance} coins remaining.${manage}`;
  },
  buyCreditsLink: (url: string) => `Top up your coin balance here:\n${url}`,
  subscribeLink: (url: string) => `Pick a plan here:\n${url}`,
  viewDashboardLink: (url: string) => `See all your scanned cards on the dashboard:\n${url}`,
  scanBothSidesToggled: (on: boolean) => `Scan Both Sides is now <b>${on ? "On" : "Off"}</b>.`,
  marketingOptInToggled: (on: boolean) =>
    on
      ? "Marketing Updates are now <b>On</b> — you may get occasional offers and news."
      : "Marketing Updates are now <b>Off</b>.",
  eventLifetimeSet: (label: string) => `Event lifetime set to <b>${label}</b>.`,
  channelLinkConfirmed: "✅ This Telegram account is now connected to your CardPing dashboard login.",
  channelLinkCodeInvalid: "That connection link has expired or was already used — generate a new one from the dashboard.",
  channelLinkAlreadyLinked: "This Telegram account is already connected to a CardPing account.",
  channelOnboardingPrompt: (url: string) =>
    `👋 Welcome to CardPing! To start scanning cards, finish setting up your account here (takes under a minute):\n${url}\n\nThis link expires in 30 minutes.`,
};
