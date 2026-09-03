"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "../../../lib/auth";
import { adminSubscriptionsRepo, PlanInput, TopUpInput } from "../../../lib/repositories/adminSubscriptions.repo";
import { adminUsersRepo } from "../../../lib/repositories/adminUsers.repo";
import { writeAuditLog } from "../../../lib/auditLog";
import { sendNotification } from "../../../lib/notificationSend";

export async function setUserPlanAction(userId: string, planId: string): Promise<void> {
  const admin = await requireAdmin();
  const plans = await adminSubscriptionsRepo.listPlans();
  const plan = plans.find((p) => p.id === planId);
  if (!plan) throw new Error("Unknown plan.");

  await adminSubscriptionsRepo.setUserPlan(userId, plan);
  await writeAuditLog({
    adminUserId: admin.id,
    action: "subscription.set_plan",
    targetTable: "users",
    targetId: userId,
    detail: { planId: plan.id, priceInr: plan.price_inr },
  });

  revalidatePath("/subscriptions");
  revalidatePath("/users");
  revalidatePath(`/users/${userId}`);
}

/** Same as setUserPlanAction, targeting an account directly — for the
 * Subscribed Accounts section (accounts with no linked channel, so
 * there's no users row to key off). */
export async function setAccountPlanAction(accountId: string, planId: string): Promise<void> {
  const admin = await requireAdmin();
  const plans = await adminSubscriptionsRepo.listPlans();
  const plan = plans.find((p) => p.id === planId);
  if (!plan) throw new Error("Unknown plan.");

  await adminSubscriptionsRepo.setAccountPlan(accountId, plan);
  await writeAuditLog({
    adminUserId: admin.id,
    action: "subscription.set_plan",
    targetTable: "accounts",
    targetId: accountId,
    detail: { planId: plan.id, priceInr: plan.price_inr },
  });

  revalidatePath("/subscriptions");
}

export async function sendRenewalReminderAction(userId: string): Promise<void> {
  const admin = await requireAdmin();
  const user = await adminUsersRepo.getUserDetail(userId);
  if (!user) throw new Error("User not found.");
  const waId = user.channels.find((c) => c.channel === "whatsapp")?.identifier;
  if (!waId) throw new Error("This user has no WhatsApp number on file.");

  const daysLeft = user.effective_plan_expires_at
    ? Math.max(0, Math.ceil((new Date(user.effective_plan_expires_at).getTime() - Date.now()) / 86400000))
    : 0;

  await sendNotification({
    userId,
    channel: "whatsapp",
    identifier: waId,
    type: "renewal_reminder",
    triggeredBy: "manual",
    adminUserId: admin.id,
    variables: [user.full_name || "there", String(daysLeft)],
  });

  await writeAuditLog({
    adminUserId: admin.id,
    action: "subscription.send_renewal_reminder",
    targetTable: "users",
    targetId: userId,
  });

  revalidatePath("/subscriptions");
  revalidatePath("/notifications");
}

function validatePlanInput(input: PlanInput): string | null {
  if (!input.name.trim()) return "Enter a plan name.";
  if (!(input.price_inr > 0)) return "Price must be greater than 0.";
  if (!(input.period_days > 0)) return "Period must be greater than 0 days.";
  if (input.coins_included < 0) return "Credits included can't be negative.";
  return null;
}

export async function createPlanAction(input: PlanInput): Promise<{ error: string | null }> {
  const admin = await requireAdmin();
  const validationError = validatePlanInput(input);
  if (validationError) return { error: validationError };

  await adminSubscriptionsRepo.createPlan(input);
  await writeAuditLog({ adminUserId: admin.id, action: "plan.create", targetTable: "plans", detail: { name: input.name } });
  revalidatePath("/subscriptions");
  return { error: null };
}

export async function updatePlanAction(id: string, input: PlanInput): Promise<{ error: string | null }> {
  const admin = await requireAdmin();
  const validationError = validatePlanInput(input);
  if (validationError) return { error: validationError };

  await adminSubscriptionsRepo.updatePlan(id, input);
  await writeAuditLog({ adminUserId: admin.id, action: "plan.update", targetTable: "plans", targetId: id });
  revalidatePath("/subscriptions");
  return { error: null };
}

export async function setPlanActiveAction(id: string, active: boolean): Promise<void> {
  const admin = await requireAdmin();
  await adminSubscriptionsRepo.setPlanActive(id, active);
  await writeAuditLog({
    adminUserId: admin.id,
    action: active ? "plan.activate" : "plan.deactivate",
    targetTable: "plans",
    targetId: id,
  });
  revalidatePath("/subscriptions");
}

function validateTopUpInput(input: TopUpInput): string | null {
  if (!(input.coins > 0)) return "Credits must be greater than 0.";
  if (!(input.price_inr > 0)) return "Price must be greater than 0.";
  return null;
}

export async function createTopUpAction(input: TopUpInput): Promise<{ error: string | null }> {
  const admin = await requireAdmin();
  const validationError = validateTopUpInput(input);
  if (validationError) return { error: validationError };

  await adminSubscriptionsRepo.createTopUp(input);
  await writeAuditLog({ adminUserId: admin.id, action: "topup.create", targetTable: "topup_packages", detail: { coins: input.coins } });
  revalidatePath("/subscriptions");
  return { error: null };
}

export async function updateTopUpAction(id: string, input: TopUpInput): Promise<{ error: string | null }> {
  const admin = await requireAdmin();
  const validationError = validateTopUpInput(input);
  if (validationError) return { error: validationError };

  await adminSubscriptionsRepo.updateTopUp(id, input);
  await writeAuditLog({ adminUserId: admin.id, action: "topup.update", targetTable: "topup_packages", targetId: id });
  revalidatePath("/subscriptions");
  return { error: null };
}

export async function setTopUpActiveAction(id: string, active: boolean): Promise<void> {
  const admin = await requireAdmin();
  await adminSubscriptionsRepo.setTopUpActive(id, active);
  await writeAuditLog({
    adminUserId: admin.id,
    action: active ? "topup.activate" : "topup.deactivate",
    targetTable: "topup_packages",
    targetId: id,
  });
  revalidatePath("/subscriptions");
}
