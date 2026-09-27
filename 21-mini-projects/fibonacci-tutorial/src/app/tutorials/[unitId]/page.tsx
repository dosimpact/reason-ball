import { TutorialView } from "@/views/tutorial";

export default async function TutorialPage({ params }: { params: Promise<{ unitId: string }> }) {
  const { unitId } = await params;
  return <TutorialView unitId={unitId} />;
}
