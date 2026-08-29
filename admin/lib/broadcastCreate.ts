import "server-only";
import { revalidatePath } from "next/cache";
import { adminBroadcastsRepo, BroadcastChannel, StoredAudienceFilter } from "./repositories/adminBroadcasts.repo";
import { writeAuditLog } from "./auditLog";
import { runBroadcastCampaign } from "./broadcastJob";

/** The one place a campaign actually gets created and kicked off —
 * shared by the Audience-dropdown-driven flow (broadcasts/actions.ts) and
 * the explicit-recipient-list flow (users/broadcastActions.ts), so both
 * agree on campaign creation, the audit log shape, and the fire-and-forget
 * send. Callers resolve their own `userIds` beforehand — this function
 * doesn't know or care how the audience was chosen. */
export async function createCampaignAndSend(input: {
  channel: BroadcastChannel;
  templateName: string | null;
  body: string;
  userIds: string[];
  audienceDescription: string;
  audienceFilter: StoredAudienceFilter;
  adminId: string;
  auditAction: string;
}): Promise<{ error: string | null }> {
  if (input.userIds.length === 0) {
    return { error: `No matching users are reachable on ${input.channel}.` };
  }

  const campaignId = await adminBroadcastsRepo.createCampaign({
    channel: input.channel,
    templateName: input.templateName,
    body: input.body,
    audienceDescription: input.audienceDescription,
    audienceFilter: input.audienceFilter,
    createdBy: input.adminId,
  });
  await adminBroadcastsRepo.insertRecipients(campaignId, input.userIds);

  await writeAuditLog({
    adminUserId: input.adminId,
    action: input.auditAction,
    targetTable: "broadcast_campaigns",
    targetId: campaignId,
    detail: { channel: input.channel, audienceSize: input.userIds.length, templateName: input.templateName },
  });

  // Fire-and-forget: this app runs as a long-lived pm2 process (not
  // serverless), so the promise keeps running after the action returns.
  // Errors inside are caught per-recipient; a total failure to start still
  // needs a catch here so it can't reject silently.
  runBroadcastCampaign(campaignId, input.channel, input.templateName, input.body).catch(() => {
    adminBroadcastsRepo.setCampaignStatus(campaignId, "failed");
  });

  revalidatePath("/broadcasts");
  return { error: null };
}
