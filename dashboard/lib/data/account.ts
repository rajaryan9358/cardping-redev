// Data-access layer: pages import from here, never from lib/mock/* directly.
// Bodies now call server/'s real /api/* — call sites elsewhere are unchanged.

import { redirect } from "next/navigation";
import { serverFetch } from "../serverFetch";
import { Account, ChannelLink, Session } from "../types";

interface ServerAccount {
  id: string;
  email: string | null;
  google_id: string | null;
  mobile: string | null;
  full_name: string | null;
  avatar_url: string | null;
  role: "user" | "admin";
  coin_balance: number;
  plan_id: string | null;
  plan_expires_at: string | null;
  has_password: boolean;
}

interface ServerChannelLink {
  id: string;
  channel: "whatsapp" | "telegram";
  channel_identifier: string;
  created_at: string;
}

interface MeResponse {
  account: ServerAccount;
  channelLinks: ServerChannelLink[];
}

function mapAccount(a: ServerAccount): Account {
  return {
    id: a.id,
    fullName: a.full_name ?? "",
    email: a.email,
    avatarUrl: a.avatar_url,
    hasPassword: a.has_password,
    hasGoogle: Boolean(a.google_id),
    mobile: a.mobile,
    role: a.role,
    coinBalance: a.coin_balance,
    planId: a.plan_id,
    planExpiresAt: a.plan_expires_at,
  };
}

async function fetchMe(): Promise<MeResponse> {
  const res = await serverFetch("/api/auth/me");
  if (!res.ok) redirect("/login");
  return (await res.json()) as MeResponse;
}

export async function getCurrentAccount(): Promise<Account> {
  const { account } = await fetchMe();
  return mapAccount(account);
}

export async function getChannelLinks(): Promise<ChannelLink[]> {
  const { channelLinks } = await fetchMe();
  return channelLinks.map((link) => ({
    id: link.id,
    channel: link.channel,
    identifier: link.channel_identifier,
    connectedAt: link.created_at,
  }));
}

export async function getSessions(): Promise<Session[]> {
  const res = await serverFetch("/api/auth/sessions");
  if (!res.ok) redirect("/login");
  const { sessions } = (await res.json()) as {
    sessions: {
      id: string;
      device_label: string | null;
      last_seen_at: string;
      isCurrent: boolean;
    }[];
  };
  return sessions.map((s) => ({
    id: s.id,
    deviceLabel: s.device_label ?? "Unknown device",
    location: null,
    lastActiveAt: s.last_seen_at,
    isCurrent: s.isCurrent,
  }));
}
