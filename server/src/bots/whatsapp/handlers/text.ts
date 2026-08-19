import { whatsappClient } from "../../../integrations/whatsapp/client";
import { NormalizedWhatsAppMessage } from "../../../integrations/whatsapp/types";
import { UserWithEvent } from "../../../types/domain";
import { sendMainMenu } from "../messages";

export async function handleText(msg: NormalizedWhatsAppMessage, user: UserWithEvent): Promise<void> {
  const name = user.full_name ? `, ${user.full_name.split(" ")[0]}` : "";
  await sendMainMenu(msg.phoneNumberId, msg.from, `Hi${name} 👋 What would you like to do?`, user.active_event_name);
}
