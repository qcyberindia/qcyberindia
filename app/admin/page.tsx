"use client";

import { useEffect, useState } from "react";
import { Building2, Landmark, AlertTriangle } from "lucide-react";
import AdminStat from "@/components/admin/AdminStat";
import AdminLoadingState from "@/components/admin/AdminLoadingState";

type Overview = { qbids: number; qfinance: number; dbConfigured: boolean } | null;

export default function AdminOverviewPage() {
  const [data, setData] = useState<Overview>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/admin/overview")
      .then((res) => res.json())
      .then((json) => {
        if (!json.ok) {
          setError(json.error || "Failed to load overview");
          return;
        }
        setData(json);
      })
      .catch(() => setError("Failed to load overview"))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <p className="font-display text-xs font-semibold uppercase tracking-[0.12em] text-[var(--color-red)]">
        Overview
      </p>
      <h1 className="mt-1.5 font-display text-2xl font-bold tracking-tight text-[var(--color-ink)] sm:text-3xl">
        QCyberIndia Admin
      </h1>

      {loading && <AdminLoadingState label="Loading overview…" />}

      {!loading && error && (
        <p className="mt-6 rounded-md border border-[var(--color-red)]/30 bg-[var(--color-red)]/5 px-3 py-2 text-sm text-[var(--color-red-deep)]">
          {error}
        </p>
      )}

      {!loading && !error && data && (
        <>
          {!data.dbConfigured && (
            <p className="mt-4 flex items-center gap-2 rounded-md border border-[var(--color-gold)]/40 bg-[var(--color-gold)]/10 px-3 py-2 text-sm text-[#8a5a00]">
              <AlertTriangle size={14} />
              No DATABASE_URL configured — counts below are 0 until a database is connected.
            </p>
          )}
          <div className="mt-6 grid grid-cols-2 gap-4 sm:max-w-md">
            <AdminStat label="Qbids registrations" value={data.qbids} icon={Building2} href="/admin/qbids" />
            <AdminStat label="QFinance registrations" value={data.qfinance} icon={Landmark} href="/admin/qfinance" />
          </div>
        </>
      )}
    </div>
  );
}
