import { redirect } from "next/navigation";

export default async function PoolIndex({ params }: { params: Promise<{ poolId: string }> }) {
  const { poolId } = await params;
  redirect(`/qfinera/pools/${encodeURIComponent(poolId)}/dashboard`);
}
