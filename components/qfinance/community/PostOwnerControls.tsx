"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Trash2, Loader2, X } from "lucide-react";
import { useCommunityAuth } from "./CommunityAuthContext";

const inputClass =
  "w-full rounded-md border border-[var(--qf-line)] bg-[var(--qf-cream-0)] px-3.5 py-2.5 text-[15px] text-[var(--qf-ink)] outline-none transition-colors focus:border-[var(--qf-brass)]";

/** Edit/Delete controls for a post — only rendered content-wise for the
 * owner (server also enforces this independently; hiding the buttons is a
 * UX nicety, not the security boundary). Must be used inside a
 * CommunityScope/CommunityAuthProvider ancestor. */
export default function PostOwnerControls({
  postId,
  authorId,
  initialTitle,
  initialBody,
}: {
  postId: number;
  authorId: number;
  initialTitle: string;
  initialBody: string | null;
}) {
  const { user } = useCommunityAuth();
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(initialTitle);
  const [body, setBody] = useState(initialBody ?? "");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  if (!user || user.id !== authorId) return null;

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/qfinance/community/posts/${postId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, body }),
      });
      const json = await res.json();
      if (!json.ok) {
        setError(json.error || "Something went wrong.");
        return;
      }
      setEditing(false);
      router.refresh();
    } catch {
      setError("Something went wrong.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!confirm("Delete this question? This can't be undone.")) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/qfinance/community/posts/${postId}`, { method: "DELETE" });
      const json = await res.json();
      if (!json.ok) {
        setError(json.error || "Something went wrong.");
        setDeleting(false);
        return;
      }
      router.push("/qfinera/community");
    } catch {
      setError("Something went wrong.");
      setDeleting(false);
    }
  }

  if (editing) {
    return (
      <form onSubmit={saveEdit} className="mt-4 rounded-md border border-[var(--qf-line)] bg-[var(--qf-cream-1)] p-4">
        <div className="flex items-center justify-between">
          <p className="text-[13px] font-semibold text-[var(--qf-ink)]">Edit your question</p>
          <button type="button" onClick={() => setEditing(false)} className="text-[var(--qf-ink-soft)] hover:text-[var(--qf-ink)]">
            <X size={16} />
          </button>
        </div>
        <div className="mt-3 space-y-2.5">
          <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={150} required className={inputClass} />
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            maxLength={4000}
            rows={5}
            placeholder="Add context if you want…"
            className={`${inputClass} resize-y`}
          />
        </div>
        {error && <p className="mt-2 text-[13px] text-[var(--qf-down)]">{error}</p>}
        <div className="mt-3 flex items-center gap-2.5">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-1.5 rounded-full bg-[var(--qf-brass)] px-4 py-2 text-sm font-semibold text-[var(--qf-cream-0)] transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {saving && <Loader2 size={14} className="animate-spin" />}
            {saving ? "Saving…" : "Save changes"}
          </button>
          <button type="button" onClick={() => setEditing(false)} className="text-sm font-medium text-[var(--qf-ink-soft)] hover:text-[var(--qf-ink)]">
            Cancel
          </button>
        </div>
      </form>
    );
  }

  return (
    <div className="mt-4 flex items-center gap-3">
      <button
        onClick={() => setEditing(true)}
        className="inline-flex items-center gap-1 text-[12.5px] text-[var(--qf-ink-soft)] hover:text-[var(--qf-brass-dark)]"
      >
        <Pencil size={12} /> Edit
      </button>
      <button
        onClick={handleDelete}
        disabled={deleting}
        className="inline-flex items-center gap-1 text-[12.5px] text-[var(--qf-ink-soft)] hover:text-[var(--qf-down)] disabled:opacity-60"
      >
        {deleting ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
        {deleting ? "Deleting…" : "Delete"}
      </button>
      {error && <p className="text-[12.5px] text-[var(--qf-down)]">{error}</p>}
    </div>
  );
}
