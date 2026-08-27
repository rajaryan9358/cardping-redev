import { channelLinksRepo } from "../db/repositories/channelLinks.repo";

/** Every bot channel identity ever linked to this account, connected or
 * not — the set every account-scoped cards/events query filters by. Data
 * ownership is permanent once a channel scans something for this account;
 * disconnecting a channel later must not make its history disappear from
 * the Directory, so this deliberately does NOT filter to currently-active
 * links (see channelLinks.repo.ts#listAllByAccountId). This is also the
 * mechanism behind "scan on WhatsApp and Telegram, see both in one
 * Directory." */
export async function resolveUsersIds(accountId: string): Promise<string[]> {
  const links = await channelLinksRepo.listAllByAccountId(accountId);
  return links.map((l) => l.users_id);
}

/** Same idea, entered from a bot channel identity (a bare users.id)
 * instead of an accountId — what the bots themselves have on hand (see
 * sendEventPicker in bots/whatsapp|telegram/messages.ts). Resolves to
 * every channel ever linked to the same account (so an event created via
 * WhatsApp shows up as a choice on Telegram too, and vice versa), via
 * this identity's *currently active* link — an identity with no active
 * link (never linked, or since disconnected) just gets itself back, same
 * as before this existed. */
export async function resolveUsersIdsFromChannelIdentity(usersId: string): Promise<string[]> {
  const link = await channelLinksRepo.findActiveByUsersId(usersId);
  if (!link) return [usersId];
  return resolveUsersIds(link.account_id);
}
