import { Account, ChannelLink, Session } from "../types";

export const mockAccount: Account = {
  id: "acct_1",
  fullName: "Jane Doe",
  email: "jane.doe@example.com",
  avatarUrl: null,
  hasPassword: true,
  hasGoogle: false,
  mobile: "+91 98765 43210",
  // "admin" so the Admin nav section + pages are reachable while testing —
  // flip to "user" to see the regular member experience instead.
  role: "admin",
  coinBalance: 2450,
  planId: "plan_professional",
  planExpiresAt: "2026-10-13",
};

export const mockChannelLinks: ChannelLink[] = [
  { id: "cl_1", channel: "whatsapp", identifier: "+91 98765 43210", connectedAt: "2026-07-01" },
  { id: "cl_2", channel: "telegram", identifier: "@janedoe", connectedAt: "2026-07-03" },
];

export const mockSessions: Session[] = [
  {
    id: "sess_1",
    deviceLabel: "Chrome on macOS",
    location: "San Francisco, US",
    lastActiveAt: "2026-08-15T14:20:00Z",
    isCurrent: true,
  },
  {
    id: "sess_2",
    deviceLabel: "Safari on iPhone",
    location: "San Francisco, US",
    lastActiveAt: "2026-08-14T09:15:00Z",
    isCurrent: false,
  },
];
