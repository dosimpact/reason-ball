import "server-only";

import { z } from "zod";

import { resourceIdSchema, uuidSchema } from "./domain";
import { resolveChatModelId } from "../ai/config";
import { AiHttpError } from "../ai/errors";
import { SupabaseHttpError } from "./http";

export function requireAllowedChatModel(requested?: string) {
  try { return resolveChatModelId(requested); }
  catch (error) {
    if (error instanceof AiHttpError) throw new SupabaseHttpError(error.status, error.code, error.message, error.retryable);
    throw error;
  }
}

export const conversationCreateSchema = z
  .object({
    id: uuidSchema.optional(),
    characterId: resourceIdSchema,
    missionId: resourceIdSchema.optional(),
    title: z.string().trim().min(1).max(200).default("New conversation"),
    visibility: z.enum(["private", "unlisted", "public"]).default("private"),
    modelId: z.string().trim().min(1).max(200).optional(),
  })
  .strict();

export const conversationPatchSchema = z.discriminatedUnion("action", [
  z
    .object({
      action: z.literal("update"),
      title: z.string().trim().min(1).max(200).optional(),
      visibility: z.enum(["private", "unlisted", "public"]).optional(),
      modelId: z.string().trim().min(1).max(100).regex(/^[a-zA-Z0-9._:-]+$/).optional(),
    })
    .strict()
    .refine((value) => value.title !== undefined || value.visibility !== undefined || value.modelId !== undefined, {
      message: "At least one conversation field is required.",
    }),
  z.object({ action: z.literal("archive") }).strict(),
  z.object({ action: z.literal("restore") }).strict(),
  z.object({ action: z.literal("rotate-share-token") }).strict(),
]);

const textPartSchema = z
  .object({
    type: z.literal("text"),
    text: z.string().min(1).max(32_000),
  })
  .strict();

const filePartSchema = z
  .object({
    type: z.literal("file"),
    url: z.url().max(4_096),
    mediaType: z.string().trim().min(1).max(200),
    filename: z.string().trim().min(1).max(500).optional(),
  })
  .strict();

export const userMessagePartsSchema = z
  .array(z.discriminatedUnion("type", [textPartSchema, filePartSchema]))
  .min(1)
  .max(20)
  .refine((parts) => parts.some((part) => part.type === "text"), {
    message: "A user message requires a text part.",
  });

export const appendMessageSchema = z
  .object({
    id: uuidSchema.optional(),
    clientMessageId: z.string().trim().min(1).max(200).optional(),
    parentMessageId: uuidSchema.optional(),
    parts: userMessagePartsSchema,
  })
  .strict();

export const branchMessageSchema = z
  .object({
    requestId: uuidSchema,
    expectedTailId: uuidSchema,
    parts: userMessagePartsSchema,
  })
  .strict();

export const voteSchema = z
  .object({ rating: z.union([z.literal(-1), z.literal(1)]), reason: z.string().trim().max(500).optional() })
  .strict();

const artifactContentFields = {
  contentText: z.string().max(2_000_000).optional(),
  contentJson: z.json().optional(),
  storageBucket: z.enum(["chat-attachments", "artifact-images"]).optional(),
  storagePath: z.string().trim().min(1).max(1_024).optional(),
  sourceMessageId: uuidSchema.optional(),
};

function hasArtifactContent(value: {
  contentText?: string;
  contentJson?: unknown;
  storageBucket?: string;
  storagePath?: string;
}) {
  return (
    Boolean(value.contentText) ||
    value.contentJson !== undefined ||
    (Boolean(value.storageBucket) && Boolean(value.storagePath))
  );
}

export const artifactCreateSchema = z
  .object({
    requestId: uuidSchema,
    conversationId: uuidSchema,
    kind: z.enum(["text", "code", "image", "sheet"]),
    title: z.string().trim().min(1).max(200),
    status: z.enum(["draft", "published"]).default("draft"),
    ...artifactContentFields,
  })
  .strict()
  .refine(hasArtifactContent, { message: "Artifact content is required." });

export const artifactVersionSchema = z
  .object({
    requestId: uuidSchema,
    expectedVersionId: uuidSchema,
    title: z.string().trim().min(1).max(200).optional(),
    status: z.enum(["draft", "published"]).default("draft"),
    ...artifactContentFields,
  })
  .strict()
  .refine(hasArtifactContent, { message: "Artifact content is required." });

export const artifactPatchSchema = z
  .object({
    title: z.string().trim().min(1).max(200).optional(),
    status: z.enum(["draft", "published", "archived"]).optional(),
  })
  .strict()
  .refine((value) => value.title !== undefined || value.status !== undefined, {
    message: "At least one artifact field is required.",
  });

export function plainTextFromParts(parts: z.infer<typeof userMessagePartsSchema>) {
  return parts
    .flatMap((part) => (part.type === "text" ? [part.text] : []))
    .join("\n")
    .trim();
}

export function conversationDto(row: Record<string, unknown>) {
  return {
    id: row.id,
    characterId: row.character_id,
    characterVersionId: row.character_version_id,
    missionId: row.mission_id,
    missionVersionId: row.mission_version_id,
    title: row.title,
    visibility: row.visibility,
    status: row.status,
    modelId: row.model_id,
    lastMessageAt: row.last_message_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function messageDto(row: Record<string, unknown>) {
  return {
    id: row.id,
    clientMessageId: row.client_message_id,
    conversationId: row.conversation_id,
    role: row.role,
    status: row.status,
    parts: row.parts,
    text: row.plain_text,
    parentMessageId: row.parent_message_id,
    modelId: row.model_id,
    finishReason: row.finish_reason,
    sequenceNumber: row.sequence_number,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function artifactDto(row: Record<string, unknown>) {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    kind: row.kind,
    title: row.title,
    status: row.status,
    currentVersionId: row.current_version_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function artifactVersionDto(row: Record<string, unknown>) {
  return {
    id: row.id,
    artifactId: row.artifact_id,
    versionNumber: row.version_number,
    sourceMessageId: row.source_message_id,
    contentText: row.content_text,
    contentJson: row.content_json,
    storageBucket: row.storage_bucket,
    storagePath: row.storage_path,
    publishedAt: row.published_at,
    createdAt: row.created_at,
  };
}
