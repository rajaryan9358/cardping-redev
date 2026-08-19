"use client";

import { LogOut } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { TableCard, TableHeaderRow, Th, Td, Tr } from "@/components/ui/Table";
import { Session } from "@/lib/types";
import { clientFetch } from "@/lib/clientFetch";
import { performLogout } from "@/lib/logout";

type PendingLogout = Session | "all" | null;

export function SessionsClient({ sessions: initialSessions }: { sessions: Session[] }) {
  const [sessions, setSessions] = useState(initialSessions);
  const [pendingLogout, setPendingLogout] = useState<PendingLogout>(null);
  const [submitting, setSubmitting] = useState(false);

  async function confirmLogout() {
    setSubmitting(true);
    try {
      if (pendingLogout === "all") {
        // Also invalidates the current session, so this ends in a real
        // logout+redirect rather than just refreshing the list.
        await performLogout();
        return;
      }
      if (pendingLogout) {
        await clientFetch(`/api/auth/sessions/${pendingLogout.id}`, { method: "DELETE" });
        setSessions((prev) => prev.filter((s) => s.id !== pendingLogout.id));
      }
    } finally {
      setSubmitting(false);
      setPendingLogout(null);
    }
  }

  return (
    <div className="rounded-xl border border-border bg-surface p-6 shadow-soft">
      <div className="flex items-center justify-between pb-4">
        <h2 className="text-base font-semibold text-ink">Login History</h2>
        <button
          type="button"
          onClick={() => setPendingLogout("all")}
          className="flex items-center gap-1.5 text-xs font-semibold text-danger-text"
        >
          <LogOut className="size-3.5" strokeWidth={2} /> Logout from all devices
        </button>
      </div>
      <TableCard className="border-0 shadow-none">
        <TableHeaderRow>
          <Th className="flex-[1.4]">Device</Th>
          <Th>Location</Th>
          <Th>Date</Th>
          <Th align="right">Action</Th>
        </TableHeaderRow>
        {sessions.map((session) => (
          <Tr key={session.id}>
            <Td className="flex-[1.4]">
              <span className="flex items-center gap-2">
                {session.deviceLabel}
                {session.isCurrent && <Badge tone="success">This device</Badge>}
              </span>
            </Td>
            <Td>{session.location ?? "—"}</Td>
            <Td>{new Date(session.lastActiveAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</Td>
            <Td align="right">
              {!session.isCurrent && (
                <button type="button" onClick={() => setPendingLogout(session)} className="text-xs font-semibold text-danger-text">
                  Logout
                </button>
              )}
            </Td>
          </Tr>
        ))}
      </TableCard>

      <ConfirmDialog
        open={!!pendingLogout}
        title={pendingLogout === "all" ? "Log out of all devices?" : "Log out this device?"}
        description={
          pendingLogout === "all"
            ? "Every other device currently signed in will be logged out immediately."
            : "This device will need to sign in again to access CardPing."
        }
        confirmLabel="Log out"
        onConfirm={confirmLogout}
        onCancel={() => setPendingLogout(null)}
      />
    </div>
  );
}
