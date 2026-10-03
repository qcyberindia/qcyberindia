import { TradeDetail } from "@/components/fund/views/TradeDetail";

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  // ?edit=1 (the Edit link on the trades list) opens the correction form.
  return <TradeDetail id={id} initialEdit={sp.edit === "1"} />;
}
