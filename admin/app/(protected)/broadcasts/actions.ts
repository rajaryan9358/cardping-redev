"use server";

import { requireAdmin } from "../../../lib/auth";
import { adminBroadcastsRepo, BroadcastChannel, MANUAL_SELECTION_AUDIENCE_FILTER } from "../../../lib/repositories/adminBroadcasts.repo";
import { AudienceFilter, AUDIENCE_FILTER_LABELS } from "../../../lib/audienceFilter";
import { SlotValue, HeaderMediaFormat } from "../../../lib/broadcastFields";
import { createCampaignAndSend } from "../../../lib/broadcastCreate";

export interface CreateBroadcastState {
  error: string | null;
}

async function startBroadcastFromFilter(input: {
  channel: BroadcastChannel;
  templateName: string | null;
  body: string;
  audienceFilter: AudienceFilter;
  adminId: string;
  auditAction: string;
}): Promise<{ error: string | null }> {
  const audience = await adminBroadcastsRepo.getOptedInAudience(input.channel, input.audienceFilter);
  return createCampaignAndSend({
    channel: input.channel,
    templateName: input.templateName,
    body: input.body,
    userIds: audience.map((u) => u.id),
    audienceDescription: `${audience.length} ${AUDIENCE_FILTER_LABELS[input.audienceFilter].toLowerCase()} ${input.channel} users`,
    audienceFilter: input.audienceFilter,
    adminId: input.adminId,
    auditAction: input.auditAction,
  });
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
    if (!templateName) return { error: "Choose or enter the approved template name." };
    let slots: SlotValue[];
    try {
      slots = JSON.parse(String(formData.get("slots") ?? "[]"));
    } catch {
      return { error: "Invalid variable mapping." };
    }
    const bodyText = String(formData.get("bodyText") ?? "").trim() || null;
    const headerMediaFormat = (String(formData.get("headerMediaFormat") ?? "").trim() || null) as HeaderMediaFormat | null;
    const headerMediaUrl = String(formData.get("headerMediaUrl") ?? "").trim() || null;
    if (headerMediaFormat && !headerMediaUrl) {
      return { error: `This template's header is a ${headerMediaFormat.toLowerCase()} — add a link before sending.` };
    }
    body = JSON.stringify({ languageCode, slots, bodyText, headerMediaFormat, headerMediaUrl });
  } else {
    body = String(formData.get("message") ?? "").trim();
    if (!body) return { error: "Enter a message." };
  }

  return startBroadcastFromFilter({
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

  // A manual-selection campaign has no filter to re-run — "re-derive
  // everyone currently matching" would silently drift the audience over
  // time, wrong for a deliberately hand-picked list. Resend to the exact
  // same people instead.
  if (campaign.audience_filter === MANUAL_SELECTION_AUDIENCE_FILTER) {
    const userIds = await adminBroadcastsRepo.getCampaignRecipientUserIds(campaignId);
    return createCampaignAndSend({
      channel: campaign.channel,
      templateName: campaign.template_name,
      body: campaign.body,
      userIds,
      audienceDescription: `${userIds.length} selected users (resend)`,
      audienceFilter: MANUAL_SELECTION_AUDIENCE_FILTER,
      adminId: admin.id,
      auditAction: "broadcast.resend",
    });
  }

  return startBroadcastFromFilter({
    channel: campaign.channel,
    templateName: campaign.template_name,
    body: campaign.body,
    audienceFilter: (campaign.audience_filter as AudienceFilter) || "all",
    adminId: admin.id,
    auditAction: "broadcast.resend",
  });
}
