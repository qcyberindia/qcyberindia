"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useCommunityAuth } from "./CommunityAuthContext";
import SignInForm from "./SignInForm";

function ReplyFormInner({ postId }: { postId: number }) {
  const { user, checking } = useCommunityAuth();
  const router = useRouter();
  const [body, setBody] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [error, setError] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 24 * 8)}px`;
  }, [body]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim() || status === "submitting") return;
    setStatus("submitting");
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
        setStatus("error");
        return;
      }
      setBody("");
      setStatus("success");
      router.refresh();
      // Don't linger on "success" once the fresh reply is visible in the list.
      setTimeout(() => setStatus("idle"), 1200);
    } catch {
      setError("Something went wrong. Please try again.");
      setStatus("error");
    }
  }

  if (checking) return null;

  if (!user) {
    return <SignInForm prompt="Sign in to reply" />;
  }

  return (
    <form onSubmit={handleSubmit}>
      <p className="mb-2 font-display text-[13.5px] font-semibold text-[var(--qf-ink)]">What do you think?</p>
      <textarea
        ref={textareaRef}
        placeholder="Share your understanding…"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        maxLength={4000}
        required
        rows={2}
        className="w-full resize-none rounded-md border border-[var(--qf-line)] bg-[var(--qf-cream-0)] px-3.5 py-2.5 text-[15px] leading-6 text-[var(--qf-ink)] outline-none transition-colors duration-200 placeholder:text-[var(--qf-ink-soft)]/60 focus:border-[var(--qf-brass)] focus:ring-2 focus:ring-[var(--qf-brass)]/15"
      />
      {error && <p className="mt-2 text-[13px] text-[var(--qf-down)]">{error}</p>}
      <button
        type="submit"
        disabled={!body.trim() || status === "submitting"}
        className="mt-2.5 inline-flex items-center gap-1.5 rounded-full bg-[var(--qf-brass)] px-4 py-2 text-sm font-semibold text-[var(--qf-cream-0)] transition-all duration-150 hover:opacity-90 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {status === "submitting" && <Loader2 size={14} className="animate-spin" />}
        {status === "submitting" ? "Posting…" : status === "success" ? "Posted ✓" : "Reply"}
      </button>
    </form>
  );
}

export default function ReplyForm({ postId }: { postId: number }) {
  return <ReplyFormInner postId={postId} />;
}
