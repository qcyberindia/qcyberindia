"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useCommunityAuth } from "./CommunityAuthContext";
import SignInForm from "./SignInForm";

function ReplyFormInner({ postId }: { postId: number }) {
  const { user, checking } = useCommunityAuth();
  const router = useRouter();
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch(`/api/qfinance/community/posts/${postId}/replies`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body }),
      });
      const json = await res.json();
      if (!json.ok) {
        setError(json.error || "Something went wrong. Please try again.");
        setSubmitting(false);
        return;
      }
      setBody("");
      router.refresh();
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (checking) return null;

  if (!user) {
    return <SignInForm prompt="Sign in to reply" />;
  }

  return (
    <form onSubmit={handleSubmit}>
      <textarea
        placeholder="Write a reply…"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        maxLength={4000}
        required
        rows={3}
        className="w-full rounded-md border border-[var(--qf-line)] bg-[var(--qf-cream-0)] px-3.5 py-2.5 text-[15px] text-[var(--qf-ink)] outline-none transition-colors focus:border-[var(--qf-brass)]"
      />
      {error && <p className="mt-2 text-[13px] text-[var(--qf-down)]">{error}</p>}
      <button
        type="submit"
        disabled={submitting}
        className="mt-2.5 inline-flex items-center gap-1.5 rounded-full bg-[var(--qf-brass)] px-4 py-2 text-sm font-semibold text-[var(--qf-cream-0)] transition-opacity hover:opacity-90 disabled:opacity-60"
      >
        {submitting && <Loader2 size={14} className="animate-spin" />}
        {submitting ? "Posting…" : "Reply"}
      </button>
    </form>
  );
}

export default function ReplyForm({ postId }: { postId: number }) {
  return <ReplyFormInner postId={postId} />;
}
