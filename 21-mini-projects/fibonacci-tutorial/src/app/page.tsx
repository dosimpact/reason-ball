import { catalog } from "@/entities/tutorial";
import { CurriculumView } from "@/views/curriculum";

export default function HomePage() {
  return <CurriculumView catalog={catalog} />;
}
