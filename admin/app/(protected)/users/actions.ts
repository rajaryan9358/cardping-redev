"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "../../../lib/auth";
import { adminUsersRepo } from "../../../lib/repositories/adminUsers.repo";
import { adminBroadcastsRepo, BroadcastHistoryEntry } from "../../../lib/repositories/adminBroadcasts.repo";
import { writeAuditLog } from "../../../lib/auditLog";
import { sendNotification } from "../../../lib/notificationSend";
import { sendWhatsAppTemplate, sendWhatsAppText, sendTelegramBroadcastMessage } from "../../../lib/broadcastSend";
import { SlotValue } from "../../../lib/broadcastFields";
import { resolveField, sanitizeForWhatsApp } from "../../../lib/broadcastFieldResolver";

const WITHIN_24H_MS = 24 * 60 * 60 * 1000;

export interface SendMessageInput {
  channel: "whatsapp" | "telegram";
  /** Free text (Telegram always; WhatsApp only within the 24h window). */
  body?: string;
  /** WhatsApp outside the 24h window: an approved template instead. */
  templateName?: string;
  languageCode?: string;
  /** Per-slot literal/field mapping for the template's {{n}} variables —
   * same shape the broadcast composer collects. Omitted (or empty) for a
   * manually-typed template name, where the slot count isn't known. */
  slots?: SlotValue[];
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
      // Resolved here, not in the modal — the modal only knows the slot
      // mapping (literal text or "use this field"); the actual field
      // values (this user's real name/credits/plan) only need to be known
      // server-side, right before sending.
      const planNamesById = await adminBroadcastsRepo.getPlanNamesById();
      const recipient = {
        full_name: user.full_name,
        wa_id: waId,
        effective_coin_balance: user.effective_coin_balance,
        effective_plan_id: user.effective_plan_id,
        effective_plan_expires_at: user.effective_plan_expires_at,
      };
      const variables = (input.slots ?? []).map((slot) =>
        slot.type === "literal" ? sanitizeForWhatsApp(slot.value) : resolveField(slot.field, recipient, planNamesById),
      );
      await sendWhatsAppTemplate(waId, input.templateName, input.languageCode || "en", variables);
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

export async function sendLowBalanceAlertAction(
  userId: string,
  channel: "whatsapp" | "telegram" = "whatsapp",
): Promise<{ sent: boolean; error?: string }> {
  const admin = await requireAdmin();
  const user = await adminUsersRepo.getUserDetail(userId);
  if (!user) throw new Error("User not found.");
  const identifier = user.channels.find((c) => c.channel === channel)?.identifier;
  if (!identifier) throw new Error(`This user has no ${channel === "whatsapp" ? "WhatsApp number" : "Telegram chat"} on file.`);

  const result = await sendNotification({
    userId,
    channel,
    identifier,
    type: "low_balance_alert",
    triggeredBy: "manual",
    adminUserId: admin.id,
    variables: [user.full_name || "there", String(user.effective_coin_balance)],
    lastLogin: user.last_login,
  });

  await writeAuditLog({
    adminUserId: admin.id,
    action: "user.send_low_balance_alert",
    targetTable: "users",
    targetId: userId,
    detail: { channel, sent: result.sent },
  });

  revalidatePath("/notifications");
  return result;
}

/** Every broadcast campaign this person was a recipient of, most recent
 * first — `userIds` is every linked channel identity for an "account" row
 * (see AdminUserListRow.userIds) or just the one bare users.id for a
 * Contacts-tab row. */
export async function getBroadcastHistoryAction(userIds: string[]): Promise<BroadcastHistoryEntry[]> {
  await requireAdmin();
  return adminBroadcastsRepo.getBroadcastHistoryForUsers(userIds);
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

export interface ProfilePatch {
  full_name?: string;
  email?: string | null;
}

export async function updateUserProfileAction(userId: string, patch: ProfilePatch): Promise<void> {
  const admin = await requireAdmin();
  await adminUsersRepo.updateUserProfile(userId, patch);
  await writeAuditLog({ adminUserId: admin.id, action: "user.update_profile", targetTable: "users", targetId: userId, detail: patch });
  revalidatePath("/users");
  revalidatePath(`/users/${userId}`);
}

/** Same as updateUserProfileAction, targeting an account directly — see
 * setAccountBlockedAction's comment. */
export async function updateAccountProfileAction(accountId: string, patch: ProfilePatch): Promise<void> {
  const admin = await requireAdmin();
  await adminUsersRepo.updateAccountProfile(accountId, patch);
  await writeAuditLog({ adminUserId: admin.id, action: "user.update_profile", targetTable: "accounts", targetId: accountId, detail: patch });
  revalidatePath("/users");
  revalidatePath(`/users/${accountId}`);
}

/** Deletes a bare `users` row (an "unlinked_user" row). Unconditionally
 * cascades that channel identity's events and cards — see
 * adminUsersRepo.deleteUser's comment. The caller's confirm dialog must
 * have the user acknowledge that before this ever runs. */
export async function deleteUserAction(userId: string): Promise<void> {
  const admin = await requireAdmin();
  await adminUsersRepo.deleteUser(userId);
  await writeAuditLog({ adminUserId: admin.id, action: "user.delete", targetTable: "users", targetId: userId });
  revalidatePath("/users");
}

/** Deletes an "account" row. `alsoDeleteLinkedUsersData` is a real choice
 * here — see adminUsersRepo.deleteAccount's comment. */
export async function deleteAccountAction(accountId: string, alsoDeleteLinkedUsersData: boolean): Promise<void> {
  const admin = await requireAdmin();
  await adminUsersRepo.deleteAccount(accountId, alsoDeleteLinkedUsersData);
  await writeAuditLog({
    adminUserId: admin.id,
    action: "user.delete",
    targetTable: "accounts",
    targetId: accountId,
    detail: { alsoDeleteLinkedUsersData },
  });
  revalidatePath("/users");
}

/** Bulk multi-select delete — `targets` mixes both row kinds (a page of
 * the Users directory can show account and unlinked_user rows together),
 * so each is dispatched individually rather than assuming one kind. */
export async function bulkDeleteUsersAction(
  targets: { id: string; kind: "account" | "unlinked_user" }[],
  alsoDeleteLinkedData: boolean,
): Promise<void> {
  const admin = await requireAdmin();
  const accountIds = targets.filter((t) => t.kind === "account").map((t) => t.id);
  const userIds = targets.filter((t) => t.kind === "unlinked_user").map((t) => t.id);
  if (accountIds.length > 0) await adminUsersRepo.bulkDeleteAccounts(accountIds, alsoDeleteLinkedData);
  if (userIds.length > 0) await adminUsersRepo.bulkDeleteUsers(userIds);
  await writeAuditLog({
    adminUserId: admin.id,
    action: "user.bulk_delete",
    targetTable: "users",
    detail: { accountIds, userIds, alsoDeleteLinkedData },
  });
  revalidatePath("/users");
}
