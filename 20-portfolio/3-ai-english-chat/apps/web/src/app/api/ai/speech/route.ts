import { createHash } from "node:crypto";

import { generateSpeech } from "ai";
import { z } from "zod";

import {
  createAiCapabilities,
  createRequestId,
  enforceAiRateLimit,
  parseJsonBody,
  recordAiObservation,
  safeAiErrorResponse,
} from "@/shared/api/ai";
import {
  assertDatabaseSuccess,
  assertTrustedMutationRequest,
  createPrivilegedClient,
  createRequestClient,
  requireAuthenticatedUser,
  safeSupabaseErrorResponse,
  SupabaseHttpError,
} from "@/shared/api/supabase/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const speechSchema = z
  .object({
    text: z.string().trim().min(1).max(4_000),
    voice: z.string().trim().regex(/^[a-zA-Z0-9_-]{1,40}$/).default("marin"),
    speed: z.number().min(0.5).max(2).default(1),
    messageId: z.uuid().optional(),
    messageRevision: z.number().int().min(1).max(100_000).default(1),
  })
  .strict();

const invalidateSchema = z
  .object({
    messageId: z.uuid(),
    beforeRevision: z.number().int().min(1).max(100_000).optional(),
  })
  .strict();

type MockAudioEntry = {
  bytes: Uint8Array;
  mediaType: string;
  messageId?: string;
  revision: number;
  modelId: string;
  voice: string;
  speed: number;
};

type AudioGlobal = typeof globalThis & {
  __linguaSpeechCache?: Map<string, MockAudioEntry>;
};

function mockCache() {
  const state = globalThis as AudioGlobal;
  state.__linguaSpeechCache ??= new Map();
  return state.__linguaSpeechCache;
}

function normalizeSpeechText(text: string) {
  return text.normalize("NFC").replace(/\s+/g, " ").trim();
}

function hashText(text: string) {
  return createHash("sha256").update(text).digest("hex");
}

function cacheKey(input: {
  messageId?: string;
  revision: number;
  textHash: string;
  modelId: string;
  voice: string;
  speed: number;
}) {
  return [
    input.messageId ?? "anonymous",
    `r${input.revision}`,
    input.textHash,
    input.modelId,
    input.voice,
    input.speed.toFixed(2),
  ].join(":");
}

function audioResponse(
  bytes: Uint8Array,
  mediaType: string,
  headers: {
    requestId: string;
    modelId: string;
    provider: string;
    cache: "HIT" | "MISS" | "BYPASS";
    key: string;
  },
) {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return new Response(copy.buffer, {
    headers: {
      "Cache-Control": "private, no-store",
      "Content-Length": String(copy.byteLength),
      "Content-Type": mediaType,
      "X-AI-Model": headers.modelId,
      "X-AI-Provider": headers.provider,
      "X-AI-Voice-Disclosure": "AI-generated",
      "X-Request-Id": headers.requestId,
      "X-TTS-Cache": headers.cache,
      "X-TTS-Cache-Key": headers.key,
    },
  });
}

function assertStorageSuccess(error: { message?: string } | null, diagnosticCode: string) {
  if (!error) return;
  throw new SupabaseHttpError(
    502,
    "DATA_SERVICE_ERROR",
    "The audio storage service could not complete the request.",
    true,
    `${diagnosticCode}:storage`,
  );
}

type SpeechAuth = {
  client: Awaited<ReturnType<typeof createRequestClient>>;
  user: Awaited<ReturnType<typeof requireAuthenticatedUser>>;
};
async function authenticateSpeechRequest(request: Request): Promise<SpeechAuth | undefined> {
  assertTrustedMutationRequest(request);
  if (process.env.APP_RUNTIME_MODE === "mock" || process.env.AI_PROVIDER === "mock") return undefined;
  const client = await createRequestClient();
  return { client, user: await requireAuthenticatedUser(client) };
}

async function requireMessageOwner(messageId: string, authenticated?: SpeechAuth) {
  const client = authenticated?.client ?? await createRequestClient();
  const user = authenticated?.user ?? await requireAuthenticatedUser(client);
  const admin = createPrivilegedClient();
  const messageResult = await admin
    .from("messages")
    .select("conversation_id")
    .eq("id", messageId)
    .limit(1);
  assertDatabaseSuccess(messageResult.error, "messages.verify_audio");
  const conversationId = ((messageResult.data ?? []) as Array<{ conversation_id: string }>)[0]
    ?.conversation_id;
  if (!conversationId) {
    throw new SupabaseHttpError(404, "MESSAGE_NOT_FOUND", "The message could not be found.");
  }
  const ownerResult = await admin
    .from("conversations")
    .select("owner_id")
    .eq("id", conversationId)
    .eq("owner_id", user.id)
    .limit(1);
  assertDatabaseSuccess(ownerResult.error, "conversations.verify_audio");
  if (!ownerResult.data?.length) {
    throw new SupabaseHttpError(403, "MESSAGE_AUDIO_FORBIDDEN", "The message does not belong to the authenticated user.");
  }
  return { admin, user };
}

export async function POST(request: Request) {
  const requestId = createRequestId();
  const startedAt = Date.now();
  let observedProvider: string | undefined;
  let observedModel: string | undefined;

  try {
    const authenticated = await authenticateSpeechRequest(request);
    const rateLimited = enforceAiRateLimit(request, requestId, {
      operation: "speech",
      authenticatedUserId: authenticated?.user.id,
      limit: 30,
      windowMs: 60_000,
    });
    if (rateLimited) return rateLimited;
    const parsed = await parseJsonBody(request, speechSchema, requestId, 32 * 1024);
    if (!parsed.ok) return parsed.response;

    const capabilities = createAiCapabilities({ operation: "speech" });
    observedProvider = capabilities.providerName;
    observedModel = capabilities.modelIds.speech;
    const normalizedText = normalizeSpeechText(parsed.data.text);
    const textHash = hashText(normalizedText);
    const key = cacheKey({
      messageId: parsed.data.messageId,
      revision: parsed.data.messageRevision,
      textHash,
      modelId: capabilities.modelIds.speech,
      voice: parsed.data.voice,
      speed: parsed.data.speed,
    });

    if (capabilities.providerName === "mock") {
      const cached = mockCache().get(key);
      if (cached) {
        const response = audioResponse(cached.bytes, cached.mediaType, {
          requestId,
          modelId: cached.modelId,
          provider: capabilities.providerName,
          cache: "HIT",
          key,
        });
        recordAiObservation({ requestId, operation: "speech", provider: observedProvider, model: observedModel, outcome: "success", startedAt, usage: { cache: "hit" } });
        return response;
      }
    }

    let productionContext:
      | Awaited<ReturnType<typeof requireMessageOwner>>
      | undefined;
    if (parsed.data.messageId && capabilities.providerName !== "mock") {
      productionContext = await requireMessageOwner(parsed.data.messageId, authenticated);
      const cachedResult = await productionContext.admin
        .from("message_audio")
        .select("storage_bucket, storage_path, mime_type")
        .eq("message_id", parsed.data.messageId)
        .eq("owner_id", productionContext.user.id)
        .eq("message_revision", parsed.data.messageRevision)
        .eq("text_hash", textHash)
        .eq("model_id", capabilities.modelIds.speech)
        .eq("voice_id", parsed.data.voice)
        .eq("speaking_rate", parsed.data.speed)
        .limit(1);
      assertDatabaseSuccess(cachedResult.error, "message_audio.lookup");
      const cached = (cachedResult.data ?? [])[0] as
        | { storage_bucket: string; storage_path: string; mime_type: string }
        | undefined;
      if (cached) {
        const download = await productionContext.admin.storage
          .from(cached.storage_bucket)
          .download(cached.storage_path);
        assertStorageSuccess(download.error, "message_audio.download");
        if (!download.data) {
          throw new SupabaseHttpError(
            502,
            "AUDIO_CACHE_EMPTY",
            "The cached audio file is unavailable.",
            true,
          );
        }
        const bytes = new Uint8Array(await download.data.arrayBuffer());
        const response = audioResponse(bytes, cached.mime_type, {
          requestId,
          modelId: capabilities.modelIds.speech,
          provider: capabilities.providerName,
          cache: "HIT",
          key,
        });
        recordAiObservation({ requestId, operation: "speech", provider: observedProvider, model: observedModel, outcome: "success", startedAt, usage: { cache: "hit" } });
        return response;
      }
    }

    const result = await generateSpeech({
      model: capabilities.speechModel,
      text: normalizedText,
      voice: parsed.data.voice,
      speed: parsed.data.speed,
      language: "en",
      outputFormat: "wav",
      instructions: "Speak clearly, warmly, and naturally for a beginner English learner.",
      abortSignal: request.signal,
      maxRetries: 1,
    });
    const audioBytes = new Uint8Array(result.audio.uint8Array.byteLength);
    audioBytes.set(result.audio.uint8Array);

    if (capabilities.providerName === "mock") {
      mockCache().set(key, {
        bytes: audioBytes,
        mediaType: result.audio.mediaType,
        messageId: parsed.data.messageId,
        revision: parsed.data.messageRevision,
        modelId: capabilities.modelIds.speech,
        voice: parsed.data.voice,
        speed: parsed.data.speed,
      });
    } else if (parsed.data.messageId && productionContext) {
      const storagePath = `tts/${productionContext.user.id}/${parsed.data.messageId}/r${parsed.data.messageRevision}/${textHash}-${capabilities.modelIds.speech}-${parsed.data.voice}-${parsed.data.speed.toFixed(2)}.wav`;
      const upload = await productionContext.admin.storage
        .from("chat-attachments")
        .upload(storagePath, audioBytes, {
          contentType: result.audio.mediaType,
          upsert: false,
        });
      if (upload.error && !String(upload.error.message).toLowerCase().includes("exist")) {
        assertStorageSuccess(upload.error, "message_audio.upload");
      }
      const insert = await productionContext.admin.from("message_audio").insert({
        message_id: parsed.data.messageId,
        owner_id: productionContext.user.id,
        message_revision: parsed.data.messageRevision,
        text_hash: textHash,
        voice_id: parsed.data.voice,
        model_id: capabilities.modelIds.speech,
        speaking_rate: parsed.data.speed,
        storage_bucket: "chat-attachments",
        storage_path: storagePath,
        mime_type: result.audio.mediaType,
      });
      if (insert.error && insert.error.code !== "23505") {
        assertDatabaseSuccess(insert.error, "message_audio.insert");
      }
    }

    const response = audioResponse(audioBytes, result.audio.mediaType, {
      requestId,
      modelId: capabilities.modelIds.speech,
      provider: capabilities.providerName,
      cache: parsed.data.messageId ? "MISS" : "BYPASS",
      key,
    });
    recordAiObservation({
      requestId,
      operation: "speech",
      provider: capabilities.providerName,
      model: capabilities.modelIds.speech,
      outcome: "success",
      startedAt,
    });
    return response;
  } catch (error) {
    recordAiObservation({
      requestId,
      operation: "speech",
      provider: observedProvider,
      model: observedModel,
      outcome: request.signal.aborted ? "aborted" : "error",
      startedAt,
    });
    return error instanceof SupabaseHttpError
      ? safeSupabaseErrorResponse(error, requestId)
      : safeAiErrorResponse(error, requestId);
  }
}

export async function DELETE(request: Request) {
  const requestId = createRequestId();
  try {
    const authenticated = await authenticateSpeechRequest(request);
    const parsed = await parseJsonBody(request, invalidateSchema, requestId, 8 * 1024);
    if (!parsed.ok) return parsed.response;

    const capabilities = createAiCapabilities({ operation: "speech" });
    if (capabilities.providerName === "mock") {
      let invalidated = 0;
      for (const [key, entry] of mockCache()) {
        if (
          entry.messageId === parsed.data.messageId &&
          (!parsed.data.beforeRevision || entry.revision <= parsed.data.beforeRevision)
        ) {
          mockCache().delete(key);
          invalidated += 1;
        }
      }
      return Response.json(
        { invalidated },
        { headers: { "Cache-Control": "no-store", "X-Request-Id": requestId } },
      );
    }

    const { admin, user } = await requireMessageOwner(parsed.data.messageId, authenticated);
    let query = admin
      .from("message_audio")
      .select("id, storage_bucket, storage_path")
      .eq("message_id", parsed.data.messageId)
      .eq("owner_id", user.id);
    if (parsed.data.beforeRevision) {
      query = query.lte("message_revision", parsed.data.beforeRevision);
    }
    const rowsResult = await query;
    assertDatabaseSuccess(rowsResult.error, "message_audio.invalidate_lookup");
    const rows = (rowsResult.data ?? []) as Array<{
      id: string;
      storage_bucket: string;
      storage_path: string;
    }>;
    const byBucket = Map.groupBy(rows, (row) => row.storage_bucket);
    for (const [bucket, bucketRows] of byBucket) {
      const removal = await admin.storage
        .from(bucket)
        .remove(bucketRows.map((row) => row.storage_path));
      assertStorageSuccess(removal.error, "message_audio.invalidate_storage");
    }
    if (rows.length) {
      const deletion = await admin
        .from("message_audio")
        .delete()
        .in("id", rows.map((row) => row.id));
      assertDatabaseSuccess(deletion.error, "message_audio.invalidate_rows");
    }
    return Response.json(
      { invalidated: rows.length },
      { headers: { "Cache-Control": "no-store", "X-Request-Id": requestId } },
    );
  } catch (error) {
    return error instanceof SupabaseHttpError
      ? safeSupabaseErrorResponse(error, requestId)
      : safeAiErrorResponse(error, requestId);
  }
}
