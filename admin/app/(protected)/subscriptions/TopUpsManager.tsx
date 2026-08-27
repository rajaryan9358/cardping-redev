"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil } from "lucide-react";
import { TableCard, TableHeaderRow, Th, Tr, Td } from "../../../components/ui/Table";
import { Button } from "../../../components/ui/Button";
import { Badge } from "../../../components/ui/Badge";
import { RowActionsMenu } from "../../../components/ui/RowActionsMenu";
import { TopUpCatalogRow } from "../../../lib/repositories/adminSubscriptions.repo";
import { setTopUpActiveAction } from "./actions";
import { TopUpFormModal } from "./TopUpFormModal";

export function TopUpsManager({ topUps }: { topUps: TopUpCatalogRow[] }) {
  const router = useRouter();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<TopUpCatalogRow | null>(null);

  async function handleToggleActive(topUp: TopUpCatalogRow) {
    await setTopUpActiveAction(topUp.id, !topUp.is_active);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <Button
          onClick={() => {
            setEditing(null);
            setFormOpen(true);
          }}
        >
          <Plus className="size-4" strokeWidth={2} />
          Add top-up package
        </Button>
      </div>

      <TableCard>
        <TableHeaderRow>
          <Th>Package</Th>
          <Th align="right">Credits</Th>
          <Th align="right">Price</Th>
          <Th>Popular</Th>
          <Th>Status</Th>
          <Th align="right">Actions</Th>
        </TableHeaderRow>
        {topUps.length === 0 && <p className="px-6 py-10 text-center text-sm text-muted">No top-up packages yet.</p>}
        {topUps.map((topUp) => (
          <Tr key={topUp.id}>
            <Td>
              <div className="font-medium text-ink">{topUp.coins} credits</div>
              {topUp.description && <div className="text-xs text-muted">{topUp.description}</div>}
            </Td>
            <Td align="right">{topUp.coins}</Td>
            <Td align="right">₹{topUp.price_inr}</Td>
            <Td>{topUp.is_popular ? <Badge tone="accent">Popular</Badge> : "—"}</Td>
            <Td>{topUp.is_active ? <Badge tone="success">Active</Badge> : <Badge tone="pending">Inactive</Badge>}</Td>
            <Td align="right">
              <div className="flex justify-end">
                <RowActionsMenu
                  actions={[
                    {
                      label: "Edit",
                      icon: <Pencil className="size-3.5" strokeWidth={2} />,
                      onClick: () => {
                        setEditing(topUp);
                        setFormOpen(true);
                      },
                    },
                    {
                      label: topUp.is_active ? "Deactivate" : "Activate",
                      onClick: () => handleToggleActive(topUp),
                      tone: topUp.is_active ? "danger" : "default",
                    },
                  ]}
                />
              </div>
            </Td>
          </Tr>
        ))}
      </TableCard>

      <TopUpFormModal
        topUp={editing}
        open={formOpen}
        onClose={() => {
          setFormOpen(false);
          router.refresh();
        }}
      />
    </div>
  );
}
