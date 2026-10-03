"use client";

// File picker with drag-and-drop for proof files. Shows what was chosen
// (name, type, size, an image preview) and lets the person remove it
// before submitting. The checks here are only for quick feedback: the
// server verifies the real file type and size.
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { FileText, UploadCloud, X } from "lucide-react";

export const PROOF_ACCEPT = "image/png,image/jpeg,image/webp,application/pdf";
export const MAX_PROOF_BYTES = 2 * 1024 * 1024;

export function proofFileProblem(file: File | null): string | null {
  if (!file) return null;
  if (file.size > MAX_PROOF_BYTES) return "This file is larger than 2 MB. Crop the screenshot or export a smaller PDF.";
  if (!PROOF_ACCEPT.split(",").includes(file.type)) return "Use a PNG, JPEG or WebP screenshot, or a PDF.";
  return null;
}

/** Reads a file as base64 (no data: prefix). */
export function readFileBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("The file could not be read."));
    reader.onload = () => resolve(String(reader.result).replace(/^data:[^;]*;base64,/, ""));
    reader.readAsDataURL(file);
  });
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.ceil(n / 1024)} KB`;
  return `${(Math.round((n / (1024 * 1024)) * 10) / 10).toString()} MB`;
}

const TYPE_LABEL: Record<string, string> = { "image/png": "PNG", "image/jpeg": "JPEG", "image/webp": "WebP", "application/pdf": "PDF" };

export function ProofDropzone({
  label,
  hint,
  file,
  onChange,
  error,
  disabled,
}: {
  label: string;
  hint?: string;
  file: File | null;
  onChange: (file: File | null) => void;
  error?: string | null;
  disabled?: boolean;
}) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const problem = error ?? proofFileProblem(file);
  const preview = useMemo(() => (file && file.type.startsWith("image/") ? URL.createObjectURL(file) : null), [file]);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  return (
    <div className="flex flex-col gap-1.5">
      <span id={`${id}-label`} className="text-[11px] font-semibold uppercase tracking-wide text-[var(--qf-ink-soft)]">
        {label}
      </span>
      <input
        ref={input}
        id={id}
        type="file"
        accept={PROOF_ACCEPT}
        className="sr-only"
        aria-labelledby={`${id}-label`}
        aria-describedby={`${id}-hint`}
        disabled={disabled}
        onChange={(e) => {
          onChange(e.target.files?.[0] ?? null);
          e.target.value = "";
        }}
      />
      {file ? (
        <div className={`flex items-center gap-3 rounded-lg border p-2.5 ${problem ? "border-[var(--qf-down)]/60" : "border-[var(--qf-line)]"} bg-[var(--qf-cream-0)]`}>
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element -- local object URL preview
            <img src={preview} alt="" className="h-14 w-14 shrink-0 rounded object-cover bg-[var(--qf-cream-1)]" />
          ) : (
            <span className="inline-flex h-14 w-14 shrink-0 items-center justify-center rounded bg-[var(--qf-cream-1)]">
              <FileText size={22} aria-hidden="true" />
            </span>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13.5px] font-semibold" title={file.name}>{file.name}</p>
            <p className="text-[12px] text-[var(--qf-ink-soft)]">
              {TYPE_LABEL[file.type] ?? (file.type || "Unknown type")} · {formatBytes(file.size)}
            </p>
          </div>
          <button
            type="button"
            onClick={() => onChange(null)}
            disabled={disabled}
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md text-[var(--qf-ink-soft)] hover:bg-[var(--qf-cream-1)] hover:text-[var(--qf-ink)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--qf-brass)]"
            aria-label={`Remove ${file.name}`}
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          disabled={disabled}
          onClick={() => input.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setOver(true);
          }}
          onDragLeave={() => setOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setOver(false);
            const f = e.dataTransfer.files?.[0];
            if (f) onChange(f);
          }}
          aria-describedby={`${id}-hint`}
          className={`flex min-h-24 w-full flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed px-4 py-4 text-center transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--qf-brass)] disabled:opacity-60 ${
            over ? "border-[var(--qf-brass)] bg-[var(--qf-brass)]/10" : "border-[var(--qf-line)] hover:border-[var(--qf-brass)]/70 hover:bg-[var(--qf-cream-1)]"
          }`}
        >
          <UploadCloud size={20} className="text-[var(--qf-brass-dark)]" aria-hidden="true" />
          <span className="text-[13.5px] font-semibold text-[var(--qf-ink)]">Choose a file or drop it here</span>
          <span className="text-[12px] text-[var(--qf-ink-soft)]">PNG, JPEG, WebP or PDF · up to 2 MB</span>
        </button>
      )}
      {problem ? (
        <p id={`${id}-hint`} role="alert" className="text-[12px] font-medium text-[var(--qf-down)]">{problem}</p>
      ) : (
        hint && <p id={`${id}-hint`} className="text-[12px] text-[var(--qf-ink-soft)]">{hint}</p>
      )}
    </div>
  );
}
