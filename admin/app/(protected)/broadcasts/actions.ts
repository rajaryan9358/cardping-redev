"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "../../../lib/auth";
import { adminBroadcastsRepo, BroadcastChannel } from "../../../lib/repositories/adminBroadcasts.repo";
import { AudienceFilter, AUDIENCE_FILTER_LABELS } from "../../../lib/audienceFilter";
import { writeAuditLog } from "../../../lib/auditLog";
import { runBroadcastCampaign } from "../../../lib/broadcastJob";

export interface CreateBroadcastState {
  error: string | null;
}

async function startBroadcast(input: {
  channel: BroadcastChannel;
  templateName: string | null;
  body: string;
  audienceFilter: AudienceFilter;
  adminId: string;
  auditAction: string;
}): Promise<{ error: string | null }> {
  const audience = await adminBroadcastsRepo.getOptedInAudience(input.channel, input.audienceFilter);
  if (audience.length === 0) {
    return { error: `No matching opted-in, unblocked users are reachable on ${input.channel}.` };
  }

  const campaignId = await adminBroadcastsRepo.createCampaign({
    channel: input.channel,
    templateName: input.templateName,
    body: input.body,
    audienceDescription: `${audience.length} ${AUDIENCE_FILTER_LABELS[input.audienceFilter].toLowerCase()} ${input.channel} users`,
    audienceFilter: input.audienceFilter,
    createdBy: input.adminId,
  });
  await adminBroadcastsRepo.insertRecipients(
    campaignId,
    audience.map((u) => u.id),
  );

  await writeAuditLog({
    adminUserId: input.adminId,
    action: input.auditAction,
    targetTable: "broadcast_campaigns",
    targetId: campaignId,
    detail: { channel: input.channel, audienceSize: audience.length, templateName: input.templateName },
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

export async function createAndSendBroadcastAction(
  _prev: CreateBroadcastState,
  formData: FormData,
): Promise<CreateBroadcastState> {
  const admin = await requireAdmin();
  const channel = String(formData.get("channel")) as BroadcastChannel;
  const audienceFilter = (String(formData.get("audienceFilter") || "all")) as AudienceFilter;

  let templateName: string | null = null;
  let body: string;

  if (channel === "whatsapp") {
    templateName = String(formData.get("templateName") ?? "").trim();
    const languageCode = String(formData.get("languageCode") ?? "en").trim() || "en";
    const variablesRaw = String(formData.get("variables") ?? "").trim();
    if (!templateName) return { error: "Choose or enter the approved template name." };
    const variables = variablesRaw ? variablesRaw.split("\n").map((v) => v.trim()).filter(Boolean) : [];
    body = JSON.stringify({ languageCode, variables });
  } else {
    body = String(formData.get("message") ?? "").trim();
    if (!body) return { error: "Enter a message." };
  }

  return startBroadcast({
    channel,
    templateName,
    body,
    audienceFilter,
    adminId: admin.id,
    auditAction: "broadcast.send",
  });
}

export async function resendCampaignAction(campaignId: string): Promise<{ error: string | null }> {
  const admin = await requireAdmin();
  const campaign = await adminBroadcastsRepo.getCampaignById(campaignId);
  if (!campaign) return { error: "Campaign not found." };

  return startBroadcast({
    channel: campaign.channel,
    templateName: campaign.template_name,
    body: campaign.body,
    audienceFilter: (campaign.audience_filter as AudienceFilter) || "all",
    adminId: admin.id,
    auditAction: "broadcast.resend",
  });
}
