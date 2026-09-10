import { MissionBuilder } from "@/features/mission-create";

export default async function Page(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  return <MissionBuilder missionId={id} />;
}
