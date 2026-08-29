"use client";

import { useEffect, useState } from "react";
import { MessageCircle, Send } from "lucide-react";
import { Modal } from "../../../components/ui/Modal";
import { Badge } from "../../../components/ui/Badge";
import { formatDate } from "../../../lib/format";
import { BroadcastHistoryEntry } from "../../../lib/repositories/adminBroadcasts.repo";
import { getBroadcastHistoryAction } from "./actions";

const STATUS_TONE = {
  sent: "success",
  failed: "danger",
  pending: "pending",
} as const;

/** A WhatsApp campaign's body is a {languageCode, slots, bodyText} JSON
 * blob (or the older {languageCode, variables} shape) — not meant for
 * direct display, so this shows the template name instead. Telegram's
 * body is already the raw message text (possibly with unresolved
 * {{field}} tokens, since those only resolve per-recipient at send time). */
function previewFor(entry: BroadcastHistoryEntry): string {
  if (entry.channel === "whatsapp") return entry.templateName ? `Template: ${entry.templateName}` : "Template message";
  return entry.body.length > 120 ? `${entry.body.slice(0, 120)}…` : entry.body;
}

export function BroadcastHistoryModal({ userIds, onClose }: { userIds: string[] | null; onClose: () => void }) {
  const [entries, setEntries] = useState<BroadcastHistoryEntry[] | null>(null);

  useEffect(() => {
    if (!userIds) return;
    setEntries(null);
    getBroadcastHistoryAction(userIds).then(setEntries);
  }, [userIds]);

  return (
    <Modal open={userIds !== null} onClose={onClose} title="Broadcast history">
      <div className="flex flex-col gap-3">
        {entries === null ? (
          <p className="py-6 text-center text-sm text-muted">Loading…</p>
        ) : entries.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted">No broadcasts sent to this person yet.</p>
        ) : (
          <ol className="flex max-h-96 flex-col gap-2 overflow-y-auto">
            {entries.map((entry, i) => (
              <li key={`${entry.campaignId}-${i}`} className="flex items-start gap-3 rounded-lg border border-border bg-surface-warm px-3.5 py-2.5">
                {entry.channel === "whatsapp" ? (
                  <MessageCircle className="mt-0.5 size-4 shrink-0 text-success-text" strokeWidth={2} />
                ) : (
                  <Send className="mt-0.5 size-4 shrink-0 text-accent" strokeWidth={2} />
                )}
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="truncate text-sm text-ink">{previewFor(entry)}</span>
                  <span className="text-xs text-muted">{formatDate(entry.sentAt ?? entry.createdAt)}</span>
                  {entry.status === "failed" && entry.error && <span className="text-xs text-danger-text">{entry.error}</span>}
                </div>
                <Badge tone={STATUS_TONE[entry.status]}>{entry.status}</Badge>
              </li>
            ))}
          </ol>
        )}
      </div>
    </Modal>
  );
}
