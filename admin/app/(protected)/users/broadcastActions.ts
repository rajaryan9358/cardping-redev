"use server";

import { requireAdmin } from "../../../lib/auth";
import { adminUsersRepo, ListUsersFilterParams } from "../../../lib/repositories/adminUsers.repo";
import { BroadcastChannel, MANUAL_SELECTION_AUDIENCE_FILTER } from "../../../lib/repositories/adminBroadcasts.repo";
import { createCampaignAndSend } from "../../../lib/broadcastCreate";
import { SlotValue, HeaderMediaFormat } from "../../../lib/broadcastFields";

export type BroadcastSource = "accounts" | "whatsapp_contacts" | "telegram_contacts";

export interface BroadcastToUsersInput {
  source: BroadcastSource;
  /** Checkbox-selected row ids (accountIds for "accounts", bare contact
   * users.id for a Contacts source). Empty means "everyone matching the
   * current filters", not "nobody". */
  selectedIds: string[];
  /** The current page's active filters — only read when selectedIds is
   * empty. Ignored fields for the current source are harmless (e.g.
   * `status` is meaningless for a Contacts source). */
  filters: ListUsersFilterParams;
  channel: BroadcastChannel;
  templateName: string | null;
  languageCode?: string;
  /** WhatsApp only. */
  slots?: SlotValue[];
  bodyText?: string | null;
  /** WhatsApp only, and only when the selected template has a media
   * header — every send needs a real link then, or Meta rejects it. */
  headerMediaFormat?: HeaderMediaFormat | null;
  headerMediaUrl?: string | null;
  /** Telegram only. */
  message?: string;
}

/** Broadcasts to an explicitly chosen set of Users/Contacts rows rather
 * than one of the Audience-dropdown segments — either the checked rows, or
 * (nothing checked) every row matching the page's current filters. Shares
 * campaign creation with the dropdown-driven flow via createCampaignAndSend;
 * the only thing unique here is resolving `userIds` from a source+selection
 * instead of an AudienceFilter. */
export async function broadcastToUsersAction(input: BroadcastToUsersInput): Promise<{ error: string | null }> {
  const admin = await requireAdmin();

  const rawIds =
    input.selectedIds.length > 0
      ? input.selectedIds
      : input.source === "accounts"
        ? await adminUsersRepo.listAccountIdsMatchingFilters(input.filters)
        : await adminUsersRepo.listChannelContactIdsMatchingFilters(
            input.source === "whatsapp_contacts" ? "whatsapp" : "telegram",
            input.filters,
          );

  // Accounts rows are keyed by accountId — broadcast_recipients.user_id is
  // always a bare channel identity, so this hop resolves which linked
  // identity (for the channel being broadcast on) each selected account
  // actually maps to. A Contacts-tab id is already the right shape.
  const channelUserIds =
    input.source === "accounts" ? await adminUsersRepo.resolveChannelUsersIdsForAccounts(rawIds, input.channel) : rawIds;

  const userIds = await adminUsersRepo.filterOutBlockedUserIds(channelUserIds);

  let body: string;
  if (input.channel === "whatsapp") {
    if (!input.templateName) return { error: "Choose or enter the approved template name." };
    const headerMediaFormat = input.headerMediaFormat ?? null;
    const headerMediaUrl = input.headerMediaUrl ?? null;
    if (headerMediaFormat && !headerMediaUrl) {
      return { error: `This template's header is a ${headerMediaFormat.toLowerCase()} — add a link before sending.` };
    }
    body = JSON.stringify({
      languageCode: input.languageCode || "en",
      slots: input.slots ?? [],
      bodyText: input.bodyText ?? null,
      headerMediaFormat,
      headerMediaUrl,
    });
  } else {
    if (!input.message?.trim()) return { error: "Enter a message." };
    body = input.message.trim();
  }

  return createCampaignAndSend({
    channel: input.channel,
    templateName: input.channel === "whatsapp" ? input.templateName : null,
    body,
    userIds,
    audienceDescription: `${userIds.length} selected ${input.channel} users`,
    audienceFilter: MANUAL_SELECTION_AUDIENCE_FILTER,
    adminId: admin.id,
    auditAction: "broadcast.send_to_selected",
  });
}
