import { supabase } from "../supabase";

export interface AdminUserRow {
  id: string;
  email: string;
  password_hash: string;
  full_name: string | null;
  created_at: string;
}

export interface AdminSessionWithUser {
  id: string;
  expires_at: string;
  admin_user: { id: string; email: string; full_name: string | null };
}

async function findUserByEmail(email: string): Promise<AdminUserRow | null> {
  const { data, error } = await supabase
    .from("admin_users")
    .select("*")
    .eq("email", email)
    .maybeSingle();
  if (error) throw error;
  return data as AdminUserRow | null;
}

async function createSession(adminUserId: string, expiresAt: string): Promise<string> {
  const { data, error } = await supabase
    .from("admin_sessions")
    .insert({ admin_user_id: adminUserId, expires_at: expiresAt })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

async function findSession(sessionId: string): Promise<AdminSessionWithUser | null> {
  const { data, error } = await supabase
    .from("admin_sessions")
    .select("id, expires_at, admin_user:admin_users(id, email, full_name)")
    .eq("id", sessionId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  // Supabase's TS types infer the joined column as an array even for a
  // to-one foreign key; it's always a single row here.
  const adminUser = Array.isArray(data.admin_user) ? data.admin_user[0] : data.admin_user;
  if (!adminUser) return null;
  return { id: data.id, expires_at: data.expires_at, admin_user: adminUser };
}

async function touchSession(sessionId: string): Promise<void> {
  await supabase
    .from("admin_sessions")
    .update({ last_seen_at: new Date().toISOString() })
    .eq("id", sessionId);
}

async function deleteSession(sessionId: string): Promise<void> {
  await supabase.from("admin_sessions").delete().eq("id", sessionId);
}

export const adminAuthRepo = {
  findUserByEmail,
  createSession,
  findSession,
  touchSession,
  deleteSession,
};
