import "server-only";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { env } from "./env";
import { adminAuthRepo } from "./repositories/adminAuth.repo";

export interface CurrentAdmin {
  id: string;
  email: string;
  fullName: string | null;
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

/** Called from the login Server Action only — sets the session cookie,
 * which requires a Server Action or Route Handler context in the App
 * Router (not a plain Server Component render). */
export async function createSessionCookie(adminUserId: string): Promise<void> {
  const expiresAt = new Date(Date.now() + env.SESSION_TTL_HOURS * 60 * 60 * 1000);
  const sessionId = await adminAuthRepo.createSession(adminUserId, expiresAt.toISOString());
  cookies().set(env.SESSION_COOKIE_NAME, sessionId, {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/admin",
    expires: expiresAt,
  });
}

export async function destroySessionCookie(): Promise<void> {
  const sessionId = cookies().get(env.SESSION_COOKIE_NAME)?.value;
  if (sessionId) await adminAuthRepo.deleteSession(sessionId);
  cookies().delete({ name: env.SESSION_COOKIE_NAME, path: "/admin" });
}

/** Resolves the current admin from the session cookie, or null if there
 * isn't a valid one. Touches last_seen_at on every call — cheap, and gives
 * the Audit Log / a future "active sessions" view a real signal. */
export async function getCurrentAdmin(): Promise<CurrentAdmin | null> {
  const sessionId = cookies().get(env.SESSION_COOKIE_NAME)?.value;
  if (!sessionId) return null;

  const session = await adminAuthRepo.findSession(sessionId);
  if (!session) return null;
  if (new Date(session.expires_at).getTime() < Date.now()) {
    await adminAuthRepo.deleteSession(sessionId);
    return null;
  }

  await adminAuthRepo.touchSession(sessionId);
  return {
    id: session.admin_user.id,
    email: session.admin_user.email,
    fullName: session.admin_user.full_name,
  };
}

/** Guards a protected page/layout — redirects to /login when there's no
 * valid session, otherwise returns the current admin. */
export async function requireAdmin(): Promise<CurrentAdmin> {
  const admin = await getCurrentAdmin();
  if (!admin) redirect("/login");
  return admin;
}
