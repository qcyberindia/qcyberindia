import { redirect } from "next/navigation";

// The single-fund workspace became QFinera Pools; keep the old path working.
export default function LegacyFundPage() {
  redirect("/qfinera/pools");
}
