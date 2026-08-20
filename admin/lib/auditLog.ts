import "server-only";
import { supabase } from "./supabase";

export interface WriteAuditLogInput {
  adminUserId: string;
  action: string;
  targetTable?: string;
  targetId?: string;
  detail?: object;
}

/** Every mutating Server Action in this app calls this — see the plan's
 * "accountability mechanism" note: admin_users exists as per-person
 * accounts specifically so every block/adjust/re-run/env-edit/broadcast
 * traces back to a person. */
export async function writeAuditLog(input: WriteAuditLogInput): Promise<void> {
  const { error } = await supabase.from("admin_audit_log").insert({
    admin_user_id: input.adminUserId,
    action: input.action,
    target_table: input.targetTable ?? null,
    target_id: input.targetId ?? null,
    detail: input.detail ?? {},
  });
  if (error) throw error;
}
