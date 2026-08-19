import { NextFunction, Request, Response } from "express";
import { env } from "../config/env";
import { sessionsRepo } from "../db/repositories/sessions.repo";
import { clearSessionCookie } from "../services/authService";

/** Cookie -> sessions row (joined to its account) -> req.account. 401s on
 * anything wrong with the session; the blocked-account check lives here
 * too — a blocked account shouldn't reach any further route logic at all. */
export async function requireSession(req: Request, res: Response, next: NextFunction): Promise<void> {
  const sessionId = req.cookies?.[env.SESSION_COOKIE_NAME] as string | undefined;
  if (!sessionId) {
    res.status(401).json({ error: "not_authenticated" });
    return;
  }

  const session = await sessionsRepo.findWithAccount(sessionId);
  if (!session || new Date(session.expires_at) < new Date()) {
    if (session) await sessionsRepo.deleteById(sessionId);
    clearSessionCookie(res);
    res.status(401).json({ error: "not_authenticated" });
    return;
  }

  if (session.account.blocked_at) {
    res.status(403).json({ error: "account_blocked" });
    return;
  }

  await sessionsRepo.touch(sessionId);
  req.account = session.account;
  req.sessionId = sessionId;
  next();
}
