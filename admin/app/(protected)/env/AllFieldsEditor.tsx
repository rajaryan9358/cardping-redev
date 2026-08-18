"use client";

import { useState } from "react";
import { Eye, Pencil } from "lucide-react";
import { Button } from "../../../components/ui/Button";
import { ConfirmDialog } from "../../../components/ui/ConfirmDialog";
import { AppName, EnvVarEntry } from "../../../lib/appEnvFiles";
import { revealAllEnvEntriesAction, updateChangedEnvVarsAction } from "./actions";

/** "Reveal & edit all" — every key's real value in its own editable text
 * input, all unmasked at once, with one "Save all" that only rewrites the
 * keys that actually changed. The counterpart to EnvVarRow's per-key
 * reveal/edit, for when you want to see (or change) everything together. */
export function AllFieldsEditor({ app }: { app: AppName }) {
  const [entries, setEntries] = useState<EnvVarEntry[] | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleRevealAll() {
    setLoading(true);
    const revealed = await revealAllEnvEntriesAction(app);
    setEntries(revealed);
    setValues(Object.fromEntries(revealed.map((e) => [e.key, e.value])));
    setLoading(false);
  }

  const changedKeys = entries?.filter((e) => values[e.key] !== e.value) ?? [];

  if (entries === null) {
    return (
      <div className="flex justify-end">
        <Button variant="secondary" onClick={handleRevealAll} loading={loading}>
          <Eye className="size-3.5" strokeWidth={2} />
          Reveal & edit all
        </Button>
      </div>
    );
  }

  return (
    <div className="flex w-full flex-col gap-3 rounded-xl border border-border bg-surface p-4 shadow-soft">
      <div className="flex items-center justify-between">
        <p className="flex items-center gap-1.5 text-sm font-semibold text-ink">
          <Pencil className="size-3.5" strokeWidth={2} />
          {app}/.env — every field
        </p>
        <div className="flex gap-2">
          {changedKeys.length > 0 && (
            <Button variant="secondary" onClick={() => setConfirmOpen(true)} loading={saving}>
              Save all ({changedKeys.length} changed)
            </Button>
          )}
          <Button
            variant="secondary"
            onClick={() => {
              setEntries(null);
              setValues({});
              setError(null);
            }}
          >
            Hide
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        {entries.map((entry) => (
          <div key={entry.key} className="flex items-center gap-3">
            <code className="w-64 shrink-0 truncate text-xs font-semibold text-ink">{entry.key}</code>
            <input
              value={values[entry.key] ?? ""}
              onChange={(e) => setValues((v) => ({ ...v, [entry.key]: e.target.value }))}
              className="min-w-0 flex-1 rounded-lg border border-border bg-surface-warm px-3 py-1.5 font-mono text-xs text-ink focus:border-accent focus:outline-none"
            />
          </div>
        ))}
      </div>

      {error && <p className="text-sm text-danger-text">{error}</p>}

      <ConfirmDialog
        open={confirmOpen}
        title={`Save ${changedKeys.length} changed value${changedKeys.length === 1 ? "" : "s"}?`}
        description={`${changedKeys.map((e) => e.key).join(", ")}. Restarts ${app} — a few seconds of downtime.`}
        confirmLabel="Save & restart"
        onCancel={() => setConfirmOpen(false)}
        onConfirm={async () => {
          setSaving(true);
          const result = await updateChangedEnvVarsAction(
            app,
            changedKeys.map((e) => ({ key: e.key, value: values[e.key] })),
          );
          setSaving(false);
          setConfirmOpen(false);
          if (result.error) {
            setError(result.error);
            return;
          }
          setEntries(entries.map((e) => ({ ...e, value: values[e.key] ?? e.value })));
        }}
      />
    </div>
  );
}
