import { MessageCircle, Send } from "lucide-react";
import { adminBroadcastsRepo } from "../../../lib/repositories/adminBroadcasts.repo";
import { formatDateTime } from "../../../lib/format";
import { Badge } from "../../../components/ui/Badge";
import { TableCard, TableHeaderRow, Th, Tr, Td } from "../../../components/ui/Table";
import { BroadcastComposer } from "./BroadcastComposer";
import { CampaignActions } from "./CampaignActions";
import { BroadcastsPagination } from "./BroadcastsPagination";

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];
const DEFAULT_PAGE_SIZE = 10;

const STATUS_TONE = {
  draft: "pending",
  sending: "accent",
  completed: "success",
  failed: "danger",
} as const;

export default async function BroadcastsPage({
  searchParams,
}: {
  searchParams: { page?: string; pageSize?: string };
}) {
  const page = Math.max(1, Number(searchParams.page) || 1);
  const pageSize = PAGE_SIZE_OPTIONS.includes(Number(searchParams.pageSize)) ? Number(searchParams.pageSize) : DEFAULT_PAGE_SIZE;
  const { rows: campaigns, total } = await adminBroadcastsRepo.listCampaigns(page, pageSize);
  const counts = await Promise.all(campaigns.map((c) => adminBroadcastsRepo.getRecipientCounts(c.id)));

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold text-ink">Broadcasts</h1>
        <p className="mt-1 text-sm text-muted">Send promos over WhatsApp or Telegram.</p>
      </div>

      <BroadcastComposer />

      <section>
        <h2 className="mb-3 text-lg font-semibold text-ink">History — {total} campaigns</h2>
        <TableCard>
          <TableHeaderRow>
            <Th>Channel</Th>
            <Th>Content</Th>
            <Th>Audience</Th>
            <Th>Status</Th>
            <Th align="right">Delivery</Th>
            <Th align="right">Sent</Th>
            <Th align="right">Actions</Th>
          </TableHeaderRow>
          {campaigns.length === 0 && (
            <p className="px-6 py-10 text-center text-sm text-muted">No broadcasts sent yet.</p>
          )}
          {campaigns.map((campaign, i) => (
            <Tr key={campaign.id}>
              <Td>
                <div className="flex items-center gap-1.5">
                  {campaign.channel === "whatsapp" ? (
                    <MessageCircle className="size-4 text-success-text" strokeWidth={2} />
                  ) : (
                    <Send className="size-4 text-accent" strokeWidth={2} />
                  )}
                  <span className="capitalize">{campaign.channel}</span>
                </div>
              </Td>
              <Td className="max-w-xs truncate">{campaign.template_name || campaign.body}</Td>
              <Td>{campaign.audience_description}</Td>
              <Td>
                <Badge tone={STATUS_TONE[campaign.status]}>{campaign.status}</Badge>
              </Td>
              <Td align="right">
                {counts[i].sent} sent · {counts[i].failed} failed
                {counts[i].pending > 0 ? ` · ${counts[i].pending} pending` : ""}
              </Td>
              <Td align="right">{formatDateTime(campaign.created_at)}</Td>
              <Td align="right">
                <div className="flex justify-end">
                  <CampaignActions campaignId={campaign.id} />
                </div>
              </Td>
            </Tr>
          ))}
          <BroadcastsPagination page={page} pageSize={pageSize} totalItems={total} />
        </TableCard>
      </section>
    </div>
  );
}
