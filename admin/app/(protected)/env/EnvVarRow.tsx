"use client";

import { useState } from "react";
import { Eye, EyeOff, Pencil } from "lucide-react";
import { Button } from "../../../components/ui/Button";
import { ConfirmDialog } from "../../../components/ui/ConfirmDialog";
import { AppName } from "../../../lib/appEnvFiles";
import { revealEnvVarAction, updateEnvVarAction } from "./actions";

export function EnvVarRow({
  app,
  keyName,
  masked,
}: {
  app: AppName;
  keyName: string;
  masked: string;
}) {
  // The raw value only ever exists client-side after an explicit Reveal
  // click, fetched fresh via a Server Action — it's never part of the
  // page's initial server-rendered payload (see the page component, which
  // only ever passes `masked` down).
  const [revealedValue, setRevealedValue] = useState<string | null>(null);
  const [revealing, setRevealing] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleReveal() {
    if (revealedValue !== null) {
      setRevealedValue(null);
      return;
    }
    setRevealing(true);
    const value = await revealEnvVarAction(app, keyName);
    setRevealedValue(value);
    setRevealing(false);
  }

  return (
    <div className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-3 last:border-b-0">
      <code className="w-64 shrink-0 truncate text-xs font-semibold text-ink">{keyName}</code>
      {editing ? (
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Enter the new value"
          className="min-w-0 flex-1 rounded-lg border border-border bg-surface-warm px-3 py-1.5 font-mono text-xs text-ink focus:border-accent focus:outline-none"
        />
      ) : (
        <code className="min-w-0 flex-1 truncate font-mono text-xs text-muted-2">{revealedValue ?? masked}</code>
      )}

      {!editing && (
        <button
          type="button"
          onClick={handleReveal}
          disabled={revealing}
          className="text-muted hover:text-ink disabled:opacity-50"
          aria-label={revealedValue !== null ? "Hide value" : "Reveal value"}
        >
          {revealedValue !== null ? (
            <EyeOff className="size-4" strokeWidth={2} />
          ) : (
            <Eye className="size-4" strokeWidth={2} />
          )}
        </button>
      )}

      {editing ? (
        <div className="flex gap-2">
          <Button
            variant="secondary"
            onClick={() => {
              setEditing(false);
              setDraft("");
              setError(null);
            }}
          >
            Cancel
          </Button>
          <Button onClick={() => setConfirmOpen(true)}>Save</Button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="text-muted hover:text-ink"
          aria-label="Edit"
        >
          <Pencil className="size-4" strokeWidth={2} />
        </button>
      )}

      {error && <p className="w-full text-xs text-danger-text">{error}</p>}

      <ConfirmDialog
        open={confirmOpen}
        title={`Update ${keyName}?`}
        description={`Restarts ${app} — a few seconds of downtime.`}
        confirmLabel="Save & restart"
        onCancel={() => setConfirmOpen(false)}
        onConfirm={async () => {
          setSaving(true);
          const result = await updateEnvVarAction(app, keyName, draft);
          setSaving(false);
          setConfirmOpen(false);
          if (result.error) {
            setError(result.error);
            return;
          }
          setEditing(false);
          setDraft("");
          setRevealedValue(null);
        }}
      />
      {saving && <span className="text-xs text-muted">Restarting…</span>}
    </div>
  );
}
