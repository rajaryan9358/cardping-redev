// Data-access layer: pages import from here, never from lib/mock/* directly.
// Once the integration phase begins, only the bodies of these functions change
// (to real `fetch()` calls against server/'s /api/*) — call sites stay the same.

import { mockAccount, mockChannelLinks, mockSessions } from "../mock/account";
import { Account, ChannelLink, Session } from "../types";

export async function getCurrentAccount(): Promise<Account> {
  return mockAccount;
}

export async function getChannelLinks(): Promise<ChannelLink[]> {
  return mockChannelLinks;
}

export async function getSessions(): Promise<Session[]> {
  return mockSessions;
}
