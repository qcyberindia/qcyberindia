"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError, apiFetch, errorMessage, poolApi } from "@/components/fund/api";
import { useFund } from "@/components/fund/session";

type Query = Record<string, string | number | boolean | null | undefined>;

type Settled<T> = { key: string; data: T | null; error: ApiError | null };

/**
 * GET a resource of the current pool (`path` is relative, e.g. "trades").
 * `loading` is derived (no result for the current request key yet), so the
 * effect never sets state synchronously. Changing path/query or calling
 * reload() refetches. Pass `path = null` to skip.
 */
export function usePoolResource<T>(path: string | null, query: Query = {}) {
  const { poolId } = useFund();
  const [version, setVersion] = useState(0);
  const [settled, setSettled] = useState<Settled<T> | null>(null);
  const queryKey = JSON.stringify(query);
  const key = path === null ? null : `${poolId}|${path}|${queryKey}|${version}`;

  useEffect(() => {
    if (path === null || key === null) return;
    const controller = new AbortController();
    apiFetch<T>(poolApi(poolId, path), { query: JSON.parse(queryKey) as Query, signal: controller.signal })
      .then((data) => setSettled({ key, data, error: null }))
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        setSettled({
          key,
          data: null,
          error: err instanceof ApiError ? err : new ApiError("ERROR", errorMessage(err), 0),
        });
      });
    return () => controller.abort();
  }, [path, key, poolId, queryKey]);

  const current = settled && settled.key === key ? settled : null;
  const reload = useCallback(() => setVersion((v) => v + 1), []);
  return { data: current?.data ?? null, error: current?.error ?? null, loading: key !== null && current === null, reload };
}

/** POST/PATCH to the current pool with a pending flag. Throws ApiError. */
export function usePoolMutation() {
  const { poolId } = useFund();
  const [pending, setPending] = useState(false);
  const busy = useRef(false);

  const run = useCallback(
    async <T,>(path: string, body: Record<string, unknown> = {}, method: "POST" | "PATCH" = "POST"): Promise<T> => {
      // A second click while a request is in flight is ignored, never sent twice.
      if (busy.current) throw new ApiError("BUSY", "Please wait for the current action to finish.", 0);
      busy.current = true;
      setPending(true);
      try {
        return await apiFetch<T>(poolApi(poolId, path), { method, body });
      } finally {
        busy.current = false;
        setPending(false);
      }
    },
    [poolId]
  );
  return { run, pending };
}
