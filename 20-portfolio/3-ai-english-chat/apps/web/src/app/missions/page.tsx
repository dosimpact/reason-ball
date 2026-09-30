import { MissionExplorer } from "@/widgets/mission-explorer";

export default async function MissionsPage({ searchParams }: { searchParams: Promise<{ character?: string | string[] }> }) {
  const params = await searchParams;
  const character = typeof params.character === "string" ? params.character : undefined;
  return <MissionExplorer key={character ?? "all"} initialCharacterId={character} />;
}
