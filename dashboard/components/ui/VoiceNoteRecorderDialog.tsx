"use client";

import { Mic, Square, TriangleAlert } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "./Button";
import { Modal } from "./Modal";
import { Spinner } from "./Spinner";
import { clientFetchRaw } from "@/lib/clientFetch";
import { VoiceNote } from "@/lib/types";

type Stage = "idle" | "recording" | "uploading" | "error";

const CANDIDATE_MIME_TYPES = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg"];

function pickSupportedMimeType(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;
  return CANDIDATE_MIME_TYPES.find((type) => MediaRecorder.isTypeSupported(type));
}

function formatDuration(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

interface ServerVoiceNote {
  id: string;
  public_url: string;
  transcript: string | null;
  created_at: string;
}

export function VoiceNoteRecorderDialog({
  cardId,
  open,
  onClose,
  onSaved,
}: {
  cardId: string;
  open: boolean;
  onClose: () => void;
  onSaved: (note: VoiceNote) => void;
}) {
  const [stage, setStage] = useState<Stage>("idle");
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function stopStream() {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    recorderRef.current = null;
  }

  // Dialog re-opening for another note (or closing mid-recording) should
  // never inherit the previous run's state or leave a mic stream open.
  useEffect(() => {
    if (!open) {
      stopStream();
      setStage("idle");
      setSeconds(0);
      setError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => stopStream, []);

  async function startRecording() {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mimeType = pickSupportedMimeType();
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        // Release the mic only once the recorder has actually finalized —
        // stopping tracks before recorder.stop() risks cutting off the
        // last buffered chunk on some browsers.
        stream.getTracks().forEach((t) => t.stop());
        void uploadRecording(recorder.mimeType || mimeType || "audio/webm");
      };
      recorder.start();
      recorderRef.current = recorder;

      setSeconds(0);
      setStage("recording");
      intervalRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
    } catch {
      setError("Microphone access was denied. Check your browser permissions and try again.");
      setStage("error");
    }
  }

  function stopRecording() {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = null;
    recorderRef.current?.stop(); // triggers onstop -> releases the mic, then uploadRecording
    setStage("uploading");
  }

  async function uploadRecording(mimeType: string) {
    try {
      const blob = new Blob(chunksRef.current, { type: mimeType });
      const form = new FormData();
      form.append("audio", blob, `voice-note.${mimeType.includes("webm") ? "webm" : mimeType.includes("mp4") ? "m4a" : "ogg"}`);

      const res = await clientFetchRaw(`/api/cards/${cardId}/voice-notes`, { method: "POST", body: form });
      if (!res.ok) throw new Error("upload_failed");
      const { voiceNote } = (await res.json()) as { voiceNote: ServerVoiceNote };

      onSaved({
        id: voiceNote.id,
        url: voiceNote.public_url,
        transcript: voiceNote.transcript,
        recordedAt: voiceNote.created_at,
      });
      onClose();
    } catch {
      setError("Couldn't save that voice note. Check your connection and try again.");
      setStage("error");
    }
  }

  function handleClose() {
    stopStream();
    onClose();
  }

  return (
    <Modal open={open} onClose={handleClose} title="Add new voice note">
      <div className="flex flex-col items-center gap-5 py-4 text-center">
        {stage === "idle" && (
          <>
            <span className="flex size-16 items-center justify-center rounded-full bg-accent-soft text-accent">
              <Mic className="size-7" strokeWidth={2} />
            </span>
            <p className="text-sm text-muted">Record a note about this contact — it'll be transcribed automatically.</p>
            <Button onClick={startRecording} className="gap-2">
              <Mic className="size-4" strokeWidth={2} /> Start Recording
            </Button>
          </>
        )}

        {stage === "recording" && (
          <>
            <span className="relative flex size-16 items-center justify-center rounded-full bg-danger-bg text-danger-text">
              <span className="absolute inset-0 animate-ping rounded-full bg-danger-text/30" />
              <Mic className="relative size-7" strokeWidth={2} />
            </span>
            <div className="flex items-center gap-2">
              <span className="size-2 animate-pulse rounded-full bg-danger-text" />
              <span className="font-mono text-2xl font-semibold tabular-nums text-ink">{formatDuration(seconds)}</span>
            </div>
            <p className="text-sm text-muted">Recording…</p>
            <Button variant="dangerSolid" onClick={stopRecording} className="gap-2">
              <Square className="size-3.5" strokeWidth={2} fill="currentColor" /> Stop &amp; Save
            </Button>
          </>
        )}

        {stage === "uploading" && (
          <>
            <span className="flex size-16 items-center justify-center rounded-full bg-accent-soft text-accent">
              <Spinner />
            </span>
            <p className="text-sm text-muted">Uploading and transcribing…</p>
          </>
        )}

        {stage === "error" && (
          <>
            <span className="flex size-16 items-center justify-center rounded-full bg-danger-bg text-danger-text">
              <TriangleAlert className="size-7" strokeWidth={2} />
            </span>
            <p className="text-sm text-danger-text">{error}</p>
            <Button onClick={startRecording} variant="secondary" className="gap-2">
              <Mic className="size-4" strokeWidth={2} /> Try Again
            </Button>
          </>
        )}
      </div>
    </Modal>
  );
}
