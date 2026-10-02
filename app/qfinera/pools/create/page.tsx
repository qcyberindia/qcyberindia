import type { Metadata } from "next";
import { PoolsChrome, SignInGate } from "@/components/fund/PoolsChrome";
import { CreatePool } from "@/components/fund/views/CreatePool";
import { getQFinanceServerSession } from "@/lib/qfinance-community-auth";

export const metadata: Metadata = { title: "Create a pool" };

export default async function CreatePoolPage() {
  const session = await getQFinanceServerSession();
  return <PoolsChrome>{session ? <CreatePool /> : <SignInGate message="Sign in to create a private pool." next="/qfinera/pools/create" />}</PoolsChrome>;
}
