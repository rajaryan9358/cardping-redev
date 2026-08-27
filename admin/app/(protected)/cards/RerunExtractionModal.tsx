"use client";

import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { Modal } from "../../../components/ui/Modal";
import { Button } from "../../../components/ui/Button";
import { AdminCardRow } from "../../../lib/repositories/adminCards.repo";
import { ExtractionProvider } from "../../../lib/vision";
import { rerunExtractionAction } from "./actions";

const MODEL_OPTIONS: Record<ExtractionProvider, { value: string; label: string }[]> = {
  openai: [
    { value: "gpt-4o", label: "GPT-4o (default)" },
    { value: "gpt-4o-mini", label: "GPT-4o mini" },
    { value: "gpt-4.1", label: "GPT-4.1" },
    { value: "gpt-4.1-mini", label: "GPT-4.1 mini" },
  ],
  gemini: [
    { value: "gemini-2.0-flash", label: "Gemini 2.0 Flash (default)" },
    { value: "gemini-2.5-flash", label: "Gemini 2.5 Flash" },
    { value: "gemini-2.5-pro", label: "Gemini 2.5 Pro" },
    { value: "gemini-3-flash", label: "Gemini 3 Flash" },
    { value: "gemini-3.1-flash-lite", label: "Gemini 3.1 Flash-Lite" },
  ],
};

const PROVIDER_LABEL: Record<ExtractionProvider, string> = { openai: "OpenAI", gemini: "Gemini" };

export function RerunExtractionModal({
  card,
  onClose,
  onDone,
}: {
  card: AdminCardRow | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const [provider, setProvider] = useState<ExtractionProvider>("openai");
  const [model, setModel] = useState(MODEL_OPTIONS.openai[0].value);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function selectProvider(next: ExtractionProvider) {
    setProvider(next);
    setModel(MODEL_OPTIONS[next][0].value);
    setError(null);
  }

  async function handleRun() {
    if (!card) return;
    setRunning(true);
    setError(null);
    try {
      await rerunExtractionAction(card.id, provider, model);
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Extraction failed. Check the model is available on this account.");
    } finally {
      setRunning(false);
    }
  }

  return (
    <Modal
      open={card !== null}
      onClose={onClose}
      title="Re-run extraction"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={running}>Cancel</Button>
          <Button onClick={handleRun} loading={running} className="gap-1.5">
            <RefreshCw className="size-3.5" strokeWidth={2} />
            Run extraction
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        {card?.extraction_provider && (
          <p className="text-xs text-muted">
            Currently extracted with <span className="font-medium text-ink">{card.extraction_provider}</span>
            {card.extraction_model && <> / <span className="font-medium text-ink">{card.extraction_model}</span></>}.
          </p>
        )}

        <div className="flex flex-col gap-2">
          <span className="text-xs font-semibold tracking-wide text-muted-2">Provider</span>
          <div className="flex gap-1 rounded-xl border border-border bg-surface-warm p-1">
            {(Object.keys(PROVIDER_LABEL) as ExtractionProvider[]).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => selectProvider(p)}
                className={
                  "flex-1 rounded-lg px-4 py-2 text-sm font-medium transition-colors " +
                  (provider === p ? "bg-surface text-ink shadow-soft" : "text-muted hover:text-ink")
                }
              >
                {PROVIDER_LABEL[p]}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-xs font-semibold tracking-wide text-muted-2" htmlFor="rerun-model">
            Model
          </label>
          <select
            id="rerun-model"
            value={model}
            onChange={(e) => setModel(e.target.value)}
            className="w-full rounded-lg border border-border bg-surface-warm px-3.5 py-2.5 text-sm text-ink focus:border-accent focus:outline-none"
          >
            {MODEL_OPTIONS[provider].map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <p className="text-xs text-muted">
          Re-extracts this card's fields from its stored image using the selected model and overwrites its current
          data. Doesn't cost the account any credits.
        </p>

        {error && <p className="text-sm text-danger-text">{error}</p>}
      </div>
    </Modal>
  );
}
