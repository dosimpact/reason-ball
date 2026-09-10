import { MissionDetailPage } from "./_components/mission-detail";

export default async function Page(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  return <MissionDetailPage id={id} />;
}
