export function conversationUrl(input: {
  characterId: string;
  conversationId: string;
  missionId?: string;
  scenario?: string;
}) {
  const query = new URLSearchParams();
  if (input.missionId) query.set("mission", input.missionId);
  query.set("conversation", input.conversationId);
  if (input.scenario) query.set("scenario", input.scenario);
  return `/chat/${encodeURIComponent(input.characterId)}?${query}`;
}
