import { Suspense } from "react";
import { CharacterExplorer } from "@/widgets/character-explorer";

export default function CharactersPage() {
  return <Suspense fallback={<p role="status" className="p-8">캐릭터를 불러오고 있어요.</p>}><CharacterExplorer /></Suspense>;
}
