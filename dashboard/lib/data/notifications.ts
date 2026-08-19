import { Notification } from "@/components/shell/NotificationsMenu";
import { serverFetchJson } from "../serverFetch";

interface ServerNotification {
  id: string;
  message: string;
  createdAt: string;
  unread: boolean;
}

function timeAgo(iso: string): string {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export async function getNotifications(): Promise<Notification[]> {
  const data = await serverFetchJson<{ notifications: ServerNotification[] }>("/api/notifications");
  if (!data) return [];
  return data.notifications.map((n) => ({
    id: n.id,
    message: n.message,
    timeAgo: timeAgo(n.createdAt),
    unread: n.unread,
  }));
}
