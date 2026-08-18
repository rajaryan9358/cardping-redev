"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil } from "lucide-react";
import { TableCard, TableHeaderRow, Th, Tr, Td } from "../../../components/ui/Table";
import { Button } from "../../../components/ui/Button";
import { Badge } from "../../../components/ui/Badge";
import { RowActionsMenu } from "../../../components/ui/RowActionsMenu";
import { PlanCatalogRow } from "../../../lib/repositories/adminSubscriptions.repo";
import { setPlanActiveAction } from "./actions";
import { PlanFormModal } from "./PlanFormModal";

export function PlansManager({ plans }: { plans: PlanCatalogRow[] }) {
  const router = useRouter();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<PlanCatalogRow | null>(null);

  async function handleToggleActive(plan: PlanCatalogRow) {
    await setPlanActiveAction(plan.id, !plan.is_active);
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
          Add plan
        </Button>
      </div>

      <TableCard>
        <TableHeaderRow>
          <Th>Plan</Th>
          <Th align="right">Price</Th>
          <Th align="right">Period</Th>
          <Th align="right">Coins</Th>
          <Th>Status</Th>
          <Th align="right">Actions</Th>
        </TableHeaderRow>
        {plans.length === 0 && <p className="px-6 py-10 text-center text-sm text-muted">No plans yet.</p>}
        {plans.map((plan) => (
          <Tr key={plan.id}>
            <Td>
              <div className="font-medium text-ink">{plan.name}</div>
              {plan.description && <div className="text-xs text-muted">{plan.description}</div>}
            </Td>
            <Td align="right">₹{plan.price_inr}</Td>
            <Td align="right">{plan.period_days} days</Td>
            <Td align="right">{plan.coins_included}</Td>
            <Td>{plan.is_active ? <Badge tone="success">Active</Badge> : <Badge tone="pending">Inactive</Badge>}</Td>
            <Td align="right">
              <div className="flex justify-end">
                <RowActionsMenu
                  actions={[
                    {
                      label: "Edit",
                      icon: <Pencil className="size-3.5" strokeWidth={2} />,
                      onClick: () => {
                        setEditing(plan);
                        setFormOpen(true);
                      },
                    },
                    {
                      label: plan.is_active ? "Deactivate" : "Activate",
                      onClick: () => handleToggleActive(plan),
                      tone: plan.is_active ? "danger" : "default",
                    },
                  ]}
                />
              </div>
            </Td>
          </Tr>
        ))}
      </TableCard>

      <PlanFormModal
        plan={editing}
        open={formOpen}
        onClose={() => {
          setFormOpen(false);
          router.refresh();
        }}
      />
    </div>
  );
}
