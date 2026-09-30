import { CharacterBuilder } from "@/features/character-create";

export default async function Page(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  return <CharacterBuilder characterId={id} />;
}
