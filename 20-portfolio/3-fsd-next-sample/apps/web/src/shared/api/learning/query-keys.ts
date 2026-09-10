export const learningQueryKeys = {
  all: ["learning"] as const,
  ownedCreations: () => [...learningQueryKeys.all, "owned-creations"] as const,
  characters: () => [...learningQueryKeys.all, "characters"] as const,
  character: (id: string) =>
    [...learningQueryKeys.characters(), "detail", id] as const,
  missions: () => [...learningQueryKeys.all, "missions"] as const,
  mission: (id: string) =>
    [...learningQueryKeys.missions(), "detail", id] as const,
  snapshot: () => [...learningQueryKeys.all, "snapshot"] as const,
};
