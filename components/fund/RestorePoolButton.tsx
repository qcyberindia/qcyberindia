"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { RotateCcw } from "lucide-react";
import { apiFetch, errorMessage } from "@/components/fund/api";
import { btnSecondary } from "@/components/fund/parts";

/** Restores a pool scheduled for deletion (ADMIN of that pool; the API checks). */
export function RestorePoolButton({ poolId }: { poolId: number }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="flex shrink-0 flex-col items-stretch gap-1 sm:items-end">
      <button
        type="button"
        className={btnSecondary}
        disabled={pending}
        onClick={async () => {
          setPending(true);
          setError(null);
          try {
            await apiFetch(`/api/qfinera/pools/${poolId}/restore`, { method: "POST", body: {} });
            router.push(`/qfinera/pools/${poolId}/dashboard`);
          } catch (err) {
            setError(errorMessage(err));
            setPending(false);
          }
        }}
      >
        <RotateCcw size={15} aria-hidden="true" /> {pending ? "Restoring…" : "Restore pool"}
      </button>
      {error && (
        <p role="alert" className="text-[12.5px] text-[var(--qf-down)]">
          {error}
        </p>
      )}
    </div>
  );
}
