import { getVendorSummaries } from "@/entities/vendor/server";
import { ExplorePage } from "@/pages/explore";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  return (
    <ExplorePage
      vendors={getVendorSummaries()}
      initialQuery={typeof params.q === "string" ? params.q : ""}
      initialRegion={typeof params.region === "string" ? params.region : "서울"}
      initialKind={params.kind === "planning" ? "planning" : "venue"}
    />
  );
}
