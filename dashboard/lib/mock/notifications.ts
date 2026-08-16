import { Notification } from "@/components/shell/NotificationsMenu";

export const mockNotifications: Notification[] = [
  { id: "n1", message: "Arpit Singh was just scanned via Telegram at TechCrunch Disrupt 2026.", timeAgo: "12m ago", unread: true },
  { id: "n2", message: "Your Professional plan renews in 3 days.", timeAgo: "2h ago", unread: true },
  { id: "n3", message: "Coin top-up of 500 coins completed successfully.", timeAgo: "1d ago", unread: false },
  { id: "n4", message: "David Miller's card was flagged for low-confidence extraction — review it.", timeAgo: "2d ago", unread: false },
];
