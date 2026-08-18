import "server-only";
import { supabase } from "../supabase";
import { Paginated } from "./adminUsers.repo";

export interface AuditLogRow {
  id: string;
  action: string;
  target_table: string | null;
  target_id: string | null;
  detail: Record<string, unknown>;
  created_at: string;
  admin: { email: string } | null;
}

export interface ListAuditLogParams {
  adminUserId?: string;
  action?: string;
  page: number;
  pageSize: number;
}

async function listAuditLog({ adminUserId, action, page, pageSize }: ListAuditLogParams): Promise<Paginated<AuditLogRow>> {
  let query = supabase
    .from("admin_audit_log")
    .select("id, action, target_table, target_id, detail, created_at, admin:admin_users(email)", {
      count: "exact",
    })
    .order("created_at", { ascending: false });

  if (adminUserId) query = query.eq("admin_user_id", adminUserId);
  if (action) query = query.eq("action", action);

  const from = (page - 1) * pageSize;
  const { data, error, count } = await query.range(from, from + pageSize - 1);
  if (error) throw error;
  const rows = (data ?? []).map((row) => ({
    ...row,
    admin: Array.isArray(row.admin) ? row.admin[0] ?? null : row.admin,
  }));
  return { rows: rows as unknown as AuditLogRow[], total: count ?? 0 };
}

async function listDistinctActions(): Promise<string[]> {
  const { data, error } = await supabase.from("admin_audit_log").select("action").limit(1000);
  if (error) throw error;
  return Array.from(new Set((data ?? []).map((row) => row.action))).sort();
}

async function listAdminUsers(): Promise<{ id: string; email: string }[]> {
  const { data, error } = await supabase.from("admin_users").select("id, email").order("email");
  if (error) throw error;
  return data ?? [];
}

export const adminAuditLogRepo = {
  listAuditLog,
  listDistinctActions,
  listAdminUsers,
};
