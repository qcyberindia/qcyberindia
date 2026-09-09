"use client";

import { useState } from "react";
import { Flag, Check } from "lucide-react";
import { useCommunityAuth } from "./CommunityAuthContext";

const REASONS: { value: string; label: string }[] = [
  { value: "spam", label: "Spam" },
  { value: "scam", label: "Scam" },
  { value: "harassment", label: "Harassment" },
  { value: "misleading_claim", label: "Misleading financial claim" },
  { value: "personal_info", label: "Personal information" },
  { value: "other", label: "Other" },
];

function ReportButtonInner({ targetType, targetId }: { targetType: "post" | "reply"; targetId: number }) {
  const { user } = useCommunityAuth();
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState(false);

  async function submit(reason: string) {
    setOpen(false);
    await fetch("/api/qfinance/community/reports", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetType, targetId, reason }),
    });
    setDone(true);
  }

  if (done) {
    return (
      <span className="inline-flex items-center gap-1 text-[12.5px] text-[var(--qf-ink-soft)]">
        <Check size={12} /> Reported
      </span>
    );
  }

  if (!user) return null; // reporting requires sign-in; keep this unobtrusive for anonymous readers

  if (open) {
    return (
      <div className="flex flex-wrap items-center gap-1.5">
        {REASONS.map((r) => (
          <button
            key={r.value}
            onClick={() => submit(r.value)}
            className="rounded-full border border-[var(--qf-line)] px-2.5 py-1 text-[12px] text-[var(--qf-ink-soft)] hover:border-[var(--qf-brass)]"
          >
            {r.label}
          </button>
        ))}
        <button onClick={() => setOpen(false)} className="text-[12px] text-[var(--qf-ink-soft)] underline">
          Cancel
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => setOpen(true)}
      className="inline-flex items-center gap-1 text-[12.5px] text-[var(--qf-ink-soft)] hover:text-[var(--qf-down)]"
    >
      <Flag size={12} /> Report
    </button>
  );
}

export default function ReportButton(props: { targetType: "post" | "reply"; targetId: number }) {
  return <ReportButtonInner {...props} />;
}
