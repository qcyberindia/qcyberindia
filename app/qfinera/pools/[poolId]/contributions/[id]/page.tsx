import { ContributionDetail } from "@/components/fund/views/ContributionDetail";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ContributionDetail id={id} />;
}
