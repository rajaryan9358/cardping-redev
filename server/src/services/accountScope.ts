import { channelLinksRepo } from "../db/repositories/channelLinks.repo";

/** The account's linked bot channel identities — the set every
 * account-scoped cards/events query filters by. This is the mechanism
 * behind "scan on WhatsApp and Telegram, see both in one Directory." */
export async function resolveUsersIds(accountId: string): Promise<string[]> {
  const links = await channelLinksRepo.listByAccountId(accountId);
  return links.map((l) => l.users_id);
}
