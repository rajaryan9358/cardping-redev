import { whatsappClient } from "../../integrations/whatsapp/client";
import { eventsRepo } from "../../db/repositories/events.repo";
import { ExtractedCard } from "../../types/domain";
import { SubscriptionStatus } from "../../services/subscriptionStatus";
import { formatEventLifetimeRemaining } from "../../services/eventService";
import { resolveUsersIdsFromChannelIdentity } from "../../services/accountScope";
import { Ids } from "./ids";

export async function sendMainMenu(
  phoneNumberId: string,
  to: string,
  greeting: string,
  activeEventName: string | null = null,
): Promise<void> {
  await whatsappClient.sendList(phoneNumberId, to, greeting, "Choose an option", [
    { id: Ids.menuScan, title: "Scan a Business Card", description: "Snap a photo of a card to save it" },
    {
      id: Ids.menuSetEvent,
      title: activeEventName ? "Change Event" : "Set an Event",
      description: activeEventName ? `Currently: ${activeEventName}` : "Group scanned cards under an event",
    },
    { id: Ids.menuBuyCredits, title: "Buy Credits", description: "Top up your coin balance" },
    { id: Ids.menuAccount, title: "Account Settings", description: "Subscription, balance, preferences" },
    { id: Ids.menuViewDashboard, title: "View Dashboard", description: "See your scanned cards on the website" },
  ]);
}

/** Recent events + "+ New Event" — shown both from the menu's Set/Change
 * Event action and when a photo arrives with no active (or expired) event,
 * see scanFlowService.ts. Row ids for existing events are prefixed
 * dynamically (Ids.eventPickPrefix + eventId) rather than fixed Ids.
 * Pulled across every channel linked to the same account — an event
 * created via Telegram is a valid choice here too, not just ones created
 * from this WhatsApp identity. */
export async function sendEventPicker(phoneNumberId: string, to: string, usersId: string): Promise<void> {
  const usersIds = await resolveUsersIdsFromChannelIdentity(usersId);
  const events = await eventsRepo.listActiveForAccount(usersIds);
  const rows = events
    // WhatsApp's interactive-list cap is 10 rows per section; "+ New Event"
    // takes one, so 9 is the true reachable max, not an arbitrary cutoff.
    .slice(0, 9)
    .map((e) => ({ id: `${Ids.eventPickPrefix}${e.id}`, title: e.name, description: "" }));
  rows.push({ id: Ids.eventPickerNew, title: "+ New Event", description: "Create and switch to a new event" });
  await whatsappClient.sendList(phoneNumberId, to, Copy.eventPickerPrompt, "Choose an event", rows);
}

export async function sendAccountSettingsMenu(
  phoneNumberId: string,
  to: string,
  status: SubscriptionStatus,
  scanBothSides: boolean,
  eventLifetimeHours: number | null,
  marketingOptIn: boolean,
): Promise<void> {
  await whatsappClient.sendList(phoneNumberId, to, Copy.accountSettingsPrompt, "Choose an option", [
    {
      id: Ids.accountSubscription,
      title: "Subscription & Balance",
      description: subscriptionLabel(status),
    },
    {
      id: Ids.accountScanBothSides,
      title: `Scan Both Sides: ${scanBothSides ? "On" : "Off"}`,
      description: "Tap to toggle",
    },
    {
      id: Ids.accountEventLifetime,
      title: `Event Lifetime: ${eventLifetimeLabel(eventLifetimeHours)}`,
      description: "How long an event stays active",
    },
    {
      id: Ids.accountMarketingOptIn,
      title: `Marketing Updates: ${marketingOptIn ? "On" : "Off"}`,
      description: "Tap to toggle",
    },
  ]);
}

export async function sendEventLifetimePicker(phoneNumberId: string, to: string): Promise<void> {
  await whatsappClient.sendList(phoneNumberId, to, "How long should an event stay active before you're asked again?", "Choose an option", [
    { id: Ids.eventLifetime1h, title: "1 hour", description: "" },
    { id: Ids.eventLifetime6h, title: "6 hours", description: "" },
    { id: Ids.eventLifetime12h, title: "12 hours", description: "" },
    { id: Ids.eventLifetime24h, title: "24 hours", description: "" },
    { id: Ids.eventLifetime48h, title: "48 hours", description: "" },
    { id: Ids.eventLifetimeAlways, title: "Always", description: "Never expires" },
  ]);
}

export function eventLifetimeLabel(hours: number | null): string {
  return hours ? `${hours}h` : "Always";
}

function subscriptionLabel(status: SubscriptionStatus): string {
  if (status.tone === "active") return status.planName ?? "Active plan";
  if (status.tone === "expired") return `${status.planName ?? "Plan"} expired`;
  if (status.tone === "trial") return `Free trial — ${status.coinBalance} coins`;
  return "No active plan";
}

export function formatCardSummary(card: ExtractedCard): string {
  return [
    `Name: *${card.person_name || "—"}*`,
    `Business: *${card.company_name || "—"}*`,
    `Designation: *${card.job_title || "—"}*`,
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
    `Great, your event *${name}* is set up (${lifetimeHours ? `active for ${lifetimeHours}h` : "no expiry"}). Now you can send visiting cards.`,
  eventSwitched: (name: string, lifetimeHours: number | null) =>
    `Switched to *${name}* (${lifetimeHours ? `active for ${lifetimeHours}h` : "no expiry"}).`,
  currentEventChangePrompt: (name: string, setAt: string | null, lifetimeHours: number | null) =>
    `Your current event is *${name}* (${formatEventLifetimeRemaining(setAt, lifetimeHours)}). Change it?`,
  keepingCurrentEvent: (name: string) => `Keeping the current event: *${name}*.`,
  eventPickerPrompt: "Which event should this go under?",
  askForPhoto:
    "Sure — please upload a clear photo of a business card. Good lighting helps accuracy!",
  askForBackPhoto: "Got the front — now send a photo of the *back* of the card.",
  processingCard: "📇 Got it — processing your card now…",
  tooManyImages:
    "🤔 Not sure how to handle more than 2 images at once — please send one photo, or two (front and back) of the same card.",
  voiceNotePrompt: "Want to add a voice note about this contact?",
  voiceNoteRecordPrompt: "🎙️ Go ahead — record and send your voice note now, I'll attach it to this contact.",
  voiceNoteSaved: "Transcript successfully created ✅",
  voiceNoteMustReplyToCard: "🚫 A voice note must be sent as a reply to a scanned card, its summary, or its contact card message.",
  accountSettingsPrompt: "What would you like to do?",
  subscriptionSummary: (status: SubscriptionStatus, manageUrl: string) => {
    const manage = `\n\nManage subscription: ${manageUrl}`;
    if (status.tone === "active") {
      const expires = status.planExpiresAt ? new Date(status.planExpiresAt).toLocaleDateString() : "—";
      return `You're on *${status.planName}*, renews/expires ${expires}.\n🪙 ${status.coinBalance} coins remaining.${manage}`;
    }
    if (status.tone === "expired") {
      return `Your *${status.planName}* plan expired.\n🪙 ${status.coinBalance} coins remaining.${manage}`;
    }
    if (status.tone === "trial") {
      return `You're on the free trial.\n🪙 ${status.coinBalance} coins remaining.${manage}`;
    }
    return `You don't have an active plan.\n🪙 ${status.coinBalance} coins remaining.${manage}`;
  },
  buyCreditsLink: (url: string) => `Top up your coin balance here:\n${url}`,
  subscribeLink: (url: string) => `Pick a plan here:\n${url}`,
  viewDashboardLink: (url: string) => `See all your scanned cards on the dashboard:\n${url}`,
  scanBothSidesToggled: (on: boolean) => `Scan Both Sides is now *${on ? "On" : "Off"}*.`,
  marketingOptInToggled: (on: boolean) =>
    on
      ? "Marketing Updates are now *On* — you may get occasional offers and news."
      : "Marketing Updates are now *Off*.",
  eventLifetimeSet: (label: string) => `Event lifetime set to *${label}*.`,
  channelOnboardingPrompt: (url: string) =>
    `👋 Welcome to CardPing! To start scanning cards, finish setting up your account here (takes under a minute):\n${url}\n\nThis link expires in 30 minutes.`,
};
