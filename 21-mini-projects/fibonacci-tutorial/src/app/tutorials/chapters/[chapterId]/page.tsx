import { notFound } from "next/navigation";
import { catalog } from "@/entities/tutorial";
import { CurriculumView } from "@/views/curriculum";

export default async function ChapterPage({ params }: { params: Promise<{ chapterId: string }> }) {
  const { chapterId } = await params;
  if (!catalog.chapters.some((chapter) => chapter.id === chapterId)) notFound();
  return <CurriculumView catalog={catalog} chapterId={chapterId} />;
}
