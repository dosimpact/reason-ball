export const STORAGE_BUCKETS = {
  artifactImages: "artifact-images",
  characterPrivate: "character-private",
  characterPublic: "character-public",
  chatAttachments: "chat-attachments",
  missionPrivate: "mission-private",
  missionPublic: "mission-public",
  profileAvatars: "profile-avatars",
} as const;

export type StorageBucket =
  (typeof STORAGE_BUCKETS)[keyof typeof STORAGE_BUCKETS];

export function createUserStoragePath(
  userId: string,
  resourceId: string,
  filename: string,
) {
  const safeFilename = filename
    .normalize("NFKC")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();

  if (!safeFilename) {
    throw new Error("A valid filename is required.");
  }

  return `${userId}/${resourceId}/${safeFilename}`;
}
