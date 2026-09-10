import { CharacterDetailPage } from "./_components/character-detail";

export default async function Page(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  return <CharacterDetailPage id={id} />;
}
