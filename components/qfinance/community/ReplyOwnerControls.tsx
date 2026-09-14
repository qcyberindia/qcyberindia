"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Trash2, Loader2, X } from "lucide-react";
import { useCommunityAuth } from "./CommunityAuthContext";

/** Edit/Delete controls for a single reply — only rendered for the owner.
 * Must be used inside a CommunityScope/CommunityAuthProvider ancestor. */
export default function ReplyOwnerControls({
  replyId,
  authorId,
  initialBody,
}: {
  replyId: number;
  authorId: number;
  initialBody: string;
}) {
  const { user } = useCommunityAuth();
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [body, setBody] = useState(initialBody);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  if (!user || user.id !== authorId) return null;

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/qfinance/community/replies/${replyId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body }),
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
    if (!confirm("Delete this reply? This can't be undone.")) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/qfinance/community/replies/${replyId}`, { method: "DELETE" });
      const json = await res.json();
      if (!json.ok) {
        setError(json.error || "Something went wrong.");
        setDeleting(false);
        return;
      }
      router.refresh();
    } catch {
      setError("Something went wrong.");
      setDeleting(false);
    }
  }

  if (editing) {
    return (
      <form onSubmit={saveEdit} className="mt-2">
        <div className="flex items-center justify-between">
          <p className="text-[12px] font-semibold text-[var(--qf-ink-soft)]">Editing reply</p>
          <button type="button" onClick={() => setEditing(false)} className="text-[var(--qf-ink-soft)] hover:text-[var(--qf-ink)]">
            <X size={14} />
          </button>
        </div>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          maxLength={4000}
          required
          rows={3}
          className="mt-1.5 w-full rounded-md border border-[var(--qf-line)] bg-[var(--qf-cream-0)] px-3 py-2 text-[14px] text-[var(--qf-ink)] outline-none focus:border-[var(--qf-brass)]"
        />
        {error && <p className="mt-1.5 text-[12.5px] text-[var(--qf-down)]">{error}</p>}
        <div className="mt-1.5 flex items-center gap-2.5">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-1.5 rounded-full bg-[var(--qf-brass)] px-3 py-1.5 text-[12.5px] font-semibold text-[var(--qf-cream-0)] disabled:opacity-60"
          >
            {saving && <Loader2 size={12} className="animate-spin" />}
            {saving ? "Saving…" : "Save"}
          </button>
          <button type="button" onClick={() => setEditing(false)} className="text-[12.5px] font-medium text-[var(--qf-ink-soft)] hover:text-[var(--qf-ink)]">
            Cancel
          </button>
        </div>
      </form>
    );
  }

  return (
    <span className="flex items-center gap-2.5">
      <span aria-hidden>·</span>
      <button onClick={() => setEditing(true)} className="inline-flex items-center gap-1 hover:text-[var(--qf-brass-dark)]">
        <Pencil size={11} /> Edit
      </button>
      <button onClick={handleDelete} disabled={deleting} className="inline-flex items-center gap-1 hover:text-[var(--qf-down)] disabled:opacity-60">
        {deleting ? <Loader2 size={11} className="animate-spin" /> : <Trash2 size={11} />}
        {deleting ? "Deleting…" : "Delete"}
      </button>
      {error && <span className="text-[var(--qf-down)]">{error}</span>}
    </span>
  );
}
