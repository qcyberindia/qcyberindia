import { WithdrawalDetail } from "@/components/fund/views/WithdrawalDetail";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <WithdrawalDetail id={id} />;
}
