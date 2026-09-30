import { LoadingIndicator } from "@/shared/ui/loading-indicator";
import { Suspense } from "react";
import { CharacterExplorer } from "@/widgets/character-explorer";

export default function CharactersPage() {
  return <Suspense fallback={<LoadingIndicator variant="page" label="캐릭터를 불러오고 있어요." />}><CharacterExplorer /></Suspense>;
}
