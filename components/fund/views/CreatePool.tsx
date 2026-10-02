"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { ApiError, apiFetch } from "@/components/fund/api";
import { TextAreaField, TextField } from "@/components/fund/forms";
import { poolBase } from "@/components/fund/nav";
import { PageHeader, SectionCard, btnPrimary } from "@/components/fund/parts";
import { CREATE_POOL_ACKNOWLEDGEMENT, MAX_POOL_MEMBERS } from "@/lib/fund/product-gate";

export function CreatePool() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [ack, setAck] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  async function submit() {
    setPending(true);
    setError(null);
    try {
      const { pool } = await apiFetch<{ pool: { id: number } }>("/api/qfinera/pools", {
        body: { name, description, acknowledgePrivate: ack },
      });
      router.push(`${poolBase(pool.id)}/members`);
    } catch (err) {
      setError(err instanceof ApiError ? err : new ApiError("ERROR", "Could not create the pool.", 0));
      setPending(false);
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="QFinera Pools"
        title="Create a private pool"
        description={`You become the pool's administrator. Invite up to ${MAX_POOL_MEMBERS} people you know; the pool starts with no capital and an initial NAV of ₹10.0000.`}
      />
      <SectionCard>
        <form
          className="max-w-xl space-y-5"
          onSubmit={(e) => {
            e.preventDefault();
            if (!pending) void submit();
          }}
        >
          <TextField label="Pool name" value={name} onChange={setName} required maxLength={120} error={error?.fields?.name} />
          <TextAreaField
            label="Description"
            value={description}
            onChange={setDescription}
            maxLength={1000}
            hint="Optional. Visible to pool members only."
            error={error?.fields?.description}
          />
          <label className="flex items-start gap-3 rounded-md border border-[var(--qf-line)] bg-[var(--qf-cream-1)] p-3 text-[13.5px] text-[var(--qf-ink)]">
            <input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} className="mt-0.5 h-4 w-4 shrink-0" required />
            <span>{CREATE_POOL_ACKNOWLEDGEMENT}</span>
          </label>
          {error && !error.fields && (
            <p role="alert" className="rounded-md border border-[var(--qf-down)]/30 bg-[var(--qf-down)]/10 px-3 py-2 text-[13px] text-[var(--qf-down)]">
              {error.message}
            </p>
          )}
          <button type="submit" className={btnPrimary} disabled={pending || !ack || name.trim().length < 3}>
            {pending && <Loader2 size={14} className="animate-spin motion-reduce:animate-none" aria-hidden="true" />}
            Create pool
          </button>
        </form>
      </SectionCard>
    </>
  );
}
