"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "../../../lib/auth";
import { adminUsersRepo } from "../../../lib/repositories/adminUsers.repo";
import { writeAuditLog } from "../../../lib/auditLog";
import { sendNotification } from "../../../lib/notificationSend";
import { sendWhatsAppTemplate, sendWhatsAppText, sendTelegramBroadcastMessage } from "../../../lib/broadcastSend";

const WITHIN_24H_MS = 24 * 60 * 60 * 1000;

export interface SendMessageInput {
  channel: "whatsapp" | "telegram";
  /** Free text (Telegram always; WhatsApp only within the 24h window). */
  body?: string;
  /** WhatsApp outside the 24h window: an approved template instead. */
  templateName?: string;
  languageCode?: string;
}

export async function sendMessageAction(userId: string, input: SendMessageInput): Promise<void> {
  const admin = await requireAdmin();
  const user = await adminUsersRepo.getUserDetail(userId);
  if (!user) throw new Error("User not found.");
  const waId = user.channels.find((c) => c.channel === "whatsapp")?.identifier;
  const telegramChatId = user.channels.find((c) => c.channel === "telegram")?.identifier;

  if (input.channel === "telegram") {
    if (!telegramChatId) throw new Error("This user has no Telegram chat on file.");
    if (!input.body?.trim()) throw new Error("Enter a message.");
    await sendTelegramBroadcastMessage(telegramChatId, input.body.trim());
  } else {
    if (!waId) throw new Error("This user has no WhatsApp number on file.");
    const within24h = user.last_login && Date.now() - new Date(user.last_login).getTime() < WITHIN_24H_MS;
    if (within24h) {
      if (!input.body?.trim()) throw new Error("Enter a message.");
      await sendWhatsAppText(waId, input.body.trim());
    } else {
      if (!input.templateName) throw new Error("This user is outside the 24h window — pick a template.");
      await sendWhatsAppTemplate(waId, input.templateName, input.languageCode || "en", []);
    }
  }

  await writeAuditLog({
    adminUserId: admin.id,
    action: "user.send_message",
    targetTable: "users",
    targetId: userId,
    detail: { channel: input.channel, templateName: input.templateName ?? null },
  });
}

export async function setUserBlockedAction(userId: string, blocked: boolean): Promise<void> {
  const admin = await requireAdmin();
  await adminUsersRepo.setBlocked(userId, blocked);
  await writeAuditLog({
    adminUserId: admin.id,
    action: blocked ? "user.block" : "user.unblock",
    targetTable: "users",
    targetId: userId,
  });
  revalidatePath("/users");
  revalidatePath(`/users/${userId}`);
}

/** Same as setUserBlockedAction, targeting an account directly — for the
 * Users directory's "account" rows, which always know their accountId
 * already (see adminUsersRepo.listUsers) and may have zero linked
 * channels for setUserBlockedAction's userId-based resolution to work with. */
export async function setAccountBlockedAction(accountId: string, blocked: boolean): Promise<void> {
  const admin = await requireAdmin();
  await adminUsersRepo.setAccountBlocked(accountId, blocked);
  await writeAuditLog({
    adminUserId: admin.id,
    action: blocked ? "user.block" : "user.unblock",
    targetTable: "accounts",
    targetId: accountId,
  });
  revalidatePath("/users");
}

export async function sendLowBalanceAlertAction(userId: string): Promise<void> {
  const admin = await requireAdmin();
  const user = await adminUsersRepo.getUserDetail(userId);
  if (!user) throw new Error("User not found.");
  const waId = user.channels.find((c) => c.channel === "whatsapp")?.identifier;
  if (!waId) throw new Error("This user has no WhatsApp number on file.");

  await sendNotification({
    userId,
    waId,
    type: "low_balance_alert",
    triggeredBy: "manual",
    adminUserId: admin.id,
    variables: [user.full_name || "there", String(user.effective_coin_balance)],
  });

  await writeAuditLog({
    adminUserId: admin.id,
    action: "user.send_low_balance_alert",
    targetTable: "users",
    targetId: userId,
  });

  revalidatePath("/notifications");
}

export async function setMarketingOptInAction(userId: string, optIn: boolean): Promise<void> {
  const admin = await requireAdmin();
  await adminUsersRepo.setMarketingOptIn(userId, optIn);
  await writeAuditLog({
    adminUserId: admin.id,
    action: optIn ? "user.marketing_opt_in" : "user.marketing_opt_out",
    targetTable: "users",
    targetId: userId,
  });
  revalidatePath("/users");
  revalidatePath(`/users/${userId}`);
}

/** Same as setMarketingOptInAction, applied to every channel linked to an
 * account at once — see adminUsersRepo.setAccountMarketingOptIn. */
export async function setAccountMarketingOptInAction(accountId: string, optIn: boolean): Promise<void> {
  const admin = await requireAdmin();
  await adminUsersRepo.setAccountMarketingOptIn(accountId, optIn);
  await writeAuditLog({
    adminUserId: admin.id,
    action: optIn ? "user.marketing_opt_in" : "user.marketing_opt_out",
    targetTable: "accounts",
    targetId: accountId,
  });
  revalidatePath("/users");
  revalidatePath(`/users/${accountId}`);
}

export async function adjustUserCoinsAction(
  userId: string,
  delta: number,
  reason: string,
): Promise<void> {
  const admin = await requireAdmin();
  if (!Number.isFinite(delta) || delta === 0) throw new Error("Enter a non-zero amount.");
  await adminUsersRepo.adjustCoins(userId, delta, reason);
  await writeAuditLog({
    adminUserId: admin.id,
    action: "user.adjust_coins",
    targetTable: "users",
    targetId: userId,
    detail: { delta, reason },
  });
  revalidatePath("/users");
  revalidatePath(`/users/${userId}`);
}

/** Same as adjustUserCoinsAction, targeting an account directly — see
 * setAccountBlockedAction's comment. */
export async function adjustAccountCoinsAction(accountId: string, delta: number, reason: string): Promise<void> {
  const admin = await requireAdmin();
  if (!Number.isFinite(delta) || delta === 0) throw new Error("Enter a non-zero amount.");
  await adminUsersRepo.adjustAccountCoins(accountId, delta, reason);
  await writeAuditLog({
    adminUserId: admin.id,
    action: "user.adjust_coins",
    targetTable: "accounts",
    targetId: accountId,
    detail: { delta, reason },
  });
  revalidatePath("/users");
}
