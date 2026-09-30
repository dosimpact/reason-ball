type Context = {
  owner_id: string;
  mission_id: string | null;
  mission_version_id: string | null;
  character_id: string;
  character_version_id: string;
};

type Conversation = Context & { id: string; status: string };
type Run = Context & { conversation_id: string };
type Input = { ownerId: string; conversationId?: string; missionId: string; characterId: string };
type Ports<T extends Run> = {
  conversation: (id: string, ownerId: string) => Promise<Conversation | undefined>;
  run: (id: string, ownerId: string) => Promise<T | undefined>;
  slug: (table: "missions" | "characters", id: string) => Promise<string | undefined>;
};

// I/O orchestration, not a pure function. Resource aliases are read only after
// ownership and the persisted version context have both been verified.
export async function resumeOwnedRun<T extends Run>(input: Input, ports: Ports<T>): Promise<
  { kind: "create" } | { kind: "conflict" } | { kind: "resume"; run: T }
> {
  if (!input.conversationId) return { kind: "create" };
  const conversation = await ports.conversation(input.conversationId, input.ownerId);
  if (!conversation || conversation.id !== input.conversationId ||
    conversation.owner_id !== input.ownerId || conversation.status !== "active") {
    return { kind: "conflict" };
  }
  const run = await ports.run(conversation.id, input.ownerId);
  if (!run) return { kind: "create" };
  if (run.owner_id !== input.ownerId || run.conversation_id !== conversation.id ||
    !run.mission_id || !run.mission_version_id ||
    run.mission_id !== conversation.mission_id ||
    run.mission_version_id !== conversation.mission_version_id ||
    run.character_id !== conversation.character_id ||
    run.character_version_id !== conversation.character_version_id) {
    return { kind: "conflict" };
  }
  const matches = async (table: "missions" | "characters", id: string, requested: string) =>
    id === requested || await ports.slug(table, id) === requested;
  const [missionMatches, characterMatches] = await Promise.all([
    matches("missions", run.mission_id, input.missionId),
    matches("characters", run.character_id, input.characterId),
  ]);
  return missionMatches && characterMatches ? { kind: "resume", run } : { kind: "conflict" };
}
