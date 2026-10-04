"use client";

import { useEffect, useState } from "react";
import { ApiError, apiFetch, errorMessage, type WatchItemDetailDto } from "@/components/fund/api";
import { ErrorState, LoadingSkeleton } from "@/components/fund/parts";
import { WatchForm } from "@/components/watch/WatchForm";

/** Loads the item, then the form: direct edit for the author/ADMIN, a suggestion for a MANAGER. */
export function WatchEdit({ id }: { id: number }) {
  const [item, setItem] = useState<WatchItemDetailDto | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  useEffect(() => {
    apiFetch<{ item: WatchItemDetailDto }>(`/api/qfinera/watch/${id}`)
      .then((r) => setItem(r.item))
      .catch((err: unknown) => setError(err instanceof ApiError ? err : new ApiError("ERROR", errorMessage(err), 0)));
  }, [id]);
  if (error) return <ErrorState error={error} />;
  if (!item) return <LoadingSkeleton label="Loading" />;
  if (item.can.edit === "deny") return <ErrorState error="Only the author or a moderator can edit this item." />;
  return <WatchForm item={item} proposing={item.can.edit === "propose"} />;
}
