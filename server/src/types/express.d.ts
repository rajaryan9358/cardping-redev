import { Account } from "./domain";

declare global {
  namespace Express {
    interface Request {
      /** Set by middleware/requireSession — the authenticated dashboard
       * login for this request, already checked for expiry/blocked. */
      account?: Account;
      sessionId?: string;
      /** Exact request bytes, captured by app.ts's express.json() verify
       * hook — webhook signature checks (WhatsApp, Cashfree) need to hash
       * what the sender actually sent, not a re-serialised copy. */
      rawBody?: Buffer;
    }
  }
}

export {};
