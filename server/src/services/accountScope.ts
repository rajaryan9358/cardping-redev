import { channelLinksRepo } from "../db/repositories/channelLinks.repo";

/** The account's linked bot channel identities — the set every
 * account-scoped cards/events query filters by. This is the mechanism
 * behind "scan on WhatsApp and Telegram, see both in one Directory." */
export async function resolveUsersIds(accountId: string): Promise<string[]> {
  const links = await channelLinksRepo.listByAccountId(accountId);
  return links.map((l) => l.users_id);
}

/** Same idea, entered from a bot channel identity (a bare users.id)
 * instead of an accountId — what the bots themselves have on hand (see
 * sendEventPicker in bots/whatsapp|telegram/messages.ts). Resolves to
 * every channel linked to the same account, so an event created via
 * WhatsApp shows up as a choice on Telegram too, and vice versa — an
 * unlinked identity (no dashboard account yet) just gets itself back,
 * same as before this existed. */
export async function resolveUsersIdsFromChannelIdentity(usersId: string): Promise<string[]> {
  const link = await channelLinksRepo.findByUsersId(usersId);
  if (!link) return [usersId];
  return resolveUsersIds(link.account_id);
}
