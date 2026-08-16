import { Notification } from "@/components/shell/NotificationsMenu";
import { mockNotifications } from "../mock/notifications";

export async function getNotifications(): Promise<Notification[]> {
  return mockNotifications;
}
