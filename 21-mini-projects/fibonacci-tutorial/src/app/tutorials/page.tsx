import { catalog } from "@/entities/tutorial";
import { CurriculumView } from "@/views/curriculum";

export default function TutorialsPage() {
  return <CurriculumView catalog={catalog} />;
}
