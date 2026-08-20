"use client";

import { useState } from "react";
import { Button } from "../../../../components/ui/Button";
import { ConfirmDialog } from "../../../../components/ui/ConfirmDialog";
import { EditCardModal, EditCardTarget } from "../EditCardModal";
import { deleteCardAction } from "../actions";

export function CardDetailActions({ card }: { card: EditCardTarget }) {
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  return (
    <div className="flex gap-2">
      <Button variant="secondary" onClick={() => setEditOpen(true)}>
        Edit
      </Button>
      <Button variant="destructive" onClick={() => setDeleteOpen(true)}>
        Delete
      </Button>

      <EditCardModal target={editOpen ? card : null} onClose={() => setEditOpen(false)} />

      <ConfirmDialog
        open={deleteOpen}
        title="Delete this card?"
        description="This can't be undone."
        confirmLabel="Delete"
        confirmDisabled={deleting}
        onCancel={() => setDeleteOpen(false)}
        onConfirm={async () => {
          setDeleting(true);
          try {
            await deleteCardAction(card.id);
            // Hard navigation: the /cards list this returns to may already
            // be in the client Router Cache from before this delete.
            window.location.href = "/admin/cards";
          } finally {
            setDeleting(false);
          }
        }}
      />
    </div>
  );
}
