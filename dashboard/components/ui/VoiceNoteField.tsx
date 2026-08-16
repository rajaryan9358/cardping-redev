"use client";

import { Mic, Square } from "lucide-react";
import { useRef, useState } from "react";

export function VoiceNoteField({ initialUrl }: { initialUrl?: string | null }) {
  const [audioUrl, setAudioUrl] = useState<string | null>(initialUrl ?? null);
  const [recording, setRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  async function startRecording() {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => chunksRef.current.push(e.data);
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        setAudioUrl(URL.createObjectURL(blob));
        stream.getTracks().forEach((t) => t.stop());
      };
      recorder.start();
      mediaRecorderRef.current = recorder;
      setRecording(true);
    } catch {
      setError("Microphone access was denied. Check your browser permissions and try again.");
    }
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop();
    setRecording(false);
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <label className="text-xs font-medium text-muted">Voice Note</label>
        {recording ? (
          <button type="button" onClick={stopRecording} className="flex items-center gap-1.5 text-xs font-semibold text-danger-text">
            <Square className="size-3.5" strokeWidth={2} fill="currentColor" /> Stop recording
          </button>
        ) : (
          <button type="button" onClick={startRecording} className="flex items-center gap-1.5 text-xs font-semibold text-accent hover:text-accent-hover">
            <Mic className="size-3.5" strokeWidth={2} /> {audioUrl ? "Re-record" : "Record"}
          </button>
        )}
      </div>
      {audioUrl ? (
        <audio controls src={audioUrl} className="w-full" />
      ) : (
        <p className="text-sm text-muted">No voice note recorded.</p>
      )}
      {recording && (
        <p className="flex items-center gap-1.5 text-xs text-danger-text">
          <span className="size-1.5 animate-pulse rounded-full bg-danger-text" /> Recording…
        </p>
      )}
      {error && <p className="text-xs text-danger-text">{error}</p>}
    </div>
  );
}
