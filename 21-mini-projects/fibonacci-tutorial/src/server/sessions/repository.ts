import "server-only";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { candleSchema } from "@/entities/candle";
import { sessionViewSchema, type SessionView } from "@/entities/tutorial";
import { getTutorialContent } from "@/entities/tutorial/content/server";
import { getLessonDefinition } from "@/entities/lesson/server";
import { learningSubmissionSchema, learningGradeSchema } from "@/entities/lesson";
import type { ScenarioSnapshot } from "@/server/candle-data/registry";

const snapshotSchema = z.strictObject({
  source: z.enum(["dummy", "binance"]),
  sourceConfig: z.union([z.strictObject({ type: z.literal("dummy") }), z.strictObject({ type: z.literal("binance"), symbol: z.enum(["BTCUSDT", "ETHUSDT"]), interval: z.enum(["1h", "4h", "1d"]), startTime: z.number().int().nonnegative().optional() })]).optional(),
  id: z.string().min(1), candles: z.array(candleSchema).min(1),
  timeframes: z.strictObject({ "1h": z.array(candleSchema), "4h": z.array(candleSchema), "1d": z.array(candleSchema) }).optional(),
});

const sessionRecordSchema = z.strictObject({
  view: sessionViewSchema,
  snapshot: snapshotSchema,
  laterCandles: z.array(candleSchema).optional(),
  planSnapshots: z.record(z.string(), z.array(candleSchema)).optional(),
  lessonSnapshots: z.record(z.string(), snapshotSchema).optional(),
  lessonCursors: z.record(z.string(), z.number().int().nonnegative()).optional(),
  lessonProgress: z.record(z.string(), z.strictObject({ submission: learningSubmissionSchema, grade: learningGradeSchema, submittedAt: z.iso.datetime() })).optional(),
  lessonAttempts: z.record(z.string(), z.array(z.strictObject({ submission: learningSubmissionSchema, grade: learningGradeSchema, submittedAt: z.iso.datetime() }))).optional(),
});

export interface SessionRecord {
  view: SessionView;
  snapshot: ScenarioSnapshot;
  laterCandles?: SessionView["visibleCandles"];
  planSnapshots?: Record<string, SessionView["visibleCandles"]>;
  lessonSnapshots?: Record<string, ScenarioSnapshot>;
  lessonCursors?: Record<string, number>;
  lessonProgress?: Record<string, { submission: import("@/entities/lesson").LearningSubmission; grade: import("@/entities/lesson").LearningGrade; submittedAt: string }>;
  lessonAttempts?: Record<string, { submission: import("@/entities/lesson").LearningSubmission; grade: import("@/entities/lesson").LearningGrade; submittedAt: string }[]>;
}

let pendingMutation: Promise<unknown> = Promise.resolve();

export function serializeMutation<T>(mutation: () => Promise<T>): Promise<T> {
  const result = pendingMutation.then(mutation, mutation);
  pendingMutation = result.catch(() => undefined);
  return result;
}

export async function readSession(id: string): Promise<SessionRecord | null> {
  if (!z.uuid().safeParse(id).success) return null;
  try {
    const record = sessionRecordSchema.parse(JSON.parse(await readFile(sessionPath(id), "utf8")));
    const content = getTutorialContent(record.view.unitId);
    if (!content && !getLessonDefinition(record.view.unitId)) throw new Error(`Unknown saved unit ${record.view.unitId}.`);
    if (content) {
      record.view.unit ??= content.summary;
      record.view.instruction ??= { title: content.summary.title, description: content.summary.description, showFibonacci: false };
    }
    if (record.view.plan && record.view.plans.length === 0) record.view.plans = [record.view.plan];
    return record;
  } catch (error) {
    if (isNotFound(error)) return null;
    throw error;
  }
}

export async function writeSession(session: SessionRecord): Promise<void> {
  const valid = sessionRecordSchema.parse(session);
  const directory = dataDirectory();
  await mkdir(directory, { recursive: true });
  const temporaryPath = path.join(directory, `${valid.view.id}.${randomUUID()}.tmp`);
  try {
    await writeFile(temporaryPath, JSON.stringify(valid), { flag: "wx" });
    await rename(temporaryPath, sessionPath(valid.view.id));
  } catch (error) {
    await unlink(temporaryPath).catch(() => undefined);
    throw error;
  }
}

function dataDirectory(): string {
  return path.resolve(/* turbopackIgnore: true */ (process.env.FIBONACCI_DATA_DIR ?? path.join(process.cwd(), ".data")));
}

function sessionPath(id: string): string {
  return path.join(dataDirectory(), `${id}.json`);
}

function isNotFound(error: unknown): boolean {
  return error !== null && typeof error === "object" && "code" in error && error.code === "ENOENT";
}
