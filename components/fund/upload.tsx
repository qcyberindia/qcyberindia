"use client";

// File picker with drag-and-drop for proof files. Shows what was chosen
// (name, type, size, an image preview) and lets the person remove it
// before submitting. The checks here are only for quick feedback: the
// server verifies the real file type and size.
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { FileText, UploadCloud, X } from "lucide-react";
import { ApiError, readApiResponse } from "@/components/fund/api";

export const PROOF_ACCEPT = "image/png,image/jpeg,image/webp,application/pdf";
export const MAX_PROOF_BYTES = 2 * 1024 * 1024;

// A large image is shrunk in the browser before upload (prepareProofFile),
// so only a PDF must already be within the server's 2 MB limit.
const MAX_IMAGE_INPUT_BYTES = 20 * 1024 * 1024;

export function proofFileProblem(file: File | null): string | null {
  if (!file) return null;
  if (!PROOF_ACCEPT.split(",").includes(file.type)) return "Use a PNG, JPEG or WebP screenshot, or a PDF.";
  if (file.type === "application/pdf" && file.size > MAX_PROOF_BYTES) return "This PDF is larger than 2 MB. Export a smaller PDF or use a screenshot.";
  if (file.size > MAX_IMAGE_INPUT_BYTES) return "This image is larger than 20 MB. Crop the screenshot first.";
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
          <span className="text-[12px] text-[var(--qf-ink-soft)]">PNG, JPEG or WebP screenshot, or a PDF up to 2 MB</span>
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

// Uploads above this are re-encoded first: reverse proxies commonly cap
// request bodies at 1 MB, and phone screenshots are often larger.
const SHRINK_ABOVE_BYTES = 900 * 1024;
const MAX_EDGE_PX = 2000;

async function encodeCanvas(canvas: HTMLCanvasElement, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
}

/**
 * A large image is scaled down (longest edge 2000 px) and re-encoded as
 * JPEG until it fits under ~900 KB. This also drops photo metadata such as
 * location. PDFs and small files are sent unchanged. Never throws: if the
 * browser cannot re-encode, the original file is used.
 */
export async function prepareProofFile(file: File): Promise<File> {
  if (file.size <= SHRINK_ABOVE_BYTES || !file.type.startsWith("image/") || typeof createImageBitmap !== "function") return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_EDGE_PX / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const g = canvas.getContext("2d");
    if (!g) return file;
    g.fillStyle = "#ffffff"; // transparent PNG areas become white, not black
    g.fillRect(0, 0, canvas.width, canvas.height);
    g.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    for (const q of [0.85, 0.75, 0.6]) {
      const blob = await encodeCanvas(canvas, q);
      if (blob && blob.size <= SHRINK_ABOVE_BYTES) {
        return new File([blob], file.name.replace(/\.[^.]+$/, "") + ".jpg", { type: "image/jpeg" });
      }
    }
    return file;
  } catch {
    return file;
  }
}

/**
 * Sends a proof file to the pool API as multipart/form-data (raw bytes, no
 * base64 overhead) and returns the stored proof's metadata. Throws ApiError.
 */
export async function uploadProof<T = unknown>(url: string, file: File, kind: "PAYMENT" | "RECEIVED"): Promise<T> {
  const prepared = await prepareProofFile(file);
  const form = new FormData();
  form.append("file", prepared, prepared.name);
  form.append("kind", kind);
  let res: Response;
  try {
    res = await fetch(url, { method: "POST", credentials: "same-origin", cache: "no-store", body: form });
  } catch {
    throw new ApiError("NETWORK", "Could not reach the server. Check your connection and try again.", 0);
  }
  return readApiResponse<T>(res);
}
