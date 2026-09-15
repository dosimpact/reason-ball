import { z } from "zod";
import { getStore } from "@/app/server/runtime";
import { parseInput } from "@/app/server/store";
import { assertLocal, httpError, requestJson } from "@/app/server/http";
import {
  identifier,
  text,
  sourceSchema,
} from "@/entities/document/model/schema";
import { catalog } from "@/app/lib/catalog";
import { flowEditSchema } from "@/features/flow-spec-syntax/parser";
import { figmaImportSchema } from "@/app/server/figma";
import { collaborationOverview } from "@/app/server/collaboration";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const project = { projectId: identifier };
const document = { ...project, documentId: identifier };
const write = {
  ...document,
  requestId: identifier,
  expectedRevision: z.number().int().positive(),
};
const actions = z.discriminatedUnion("action", [
  z.object({ action: z.literal("collaboration") }).strict(),
  z
    .object({
      action: z.literal("importFigma"),
      ...project,
      requestId: identifier,
      ...figmaImportSchema.shape,
    })
    .strict(),
  z
    .object({ action: z.literal("editFlow"), ...write, edit: flowEditSchema })
    .strict(),
  z
    .object({
      action: z.literal("relations"),
      ...document,
      revision: z.number().int().positive().optional(),
    })
    .strict(),
  z
    .object({
      action: z.literal("compare"),
      ...project,
      before: z
        .object({
          documentId: identifier,
          revision: z.number().int().positive(),
        })
        .strict(),
      after: z
        .object({
          documentId: identifier,
          revision: z.number().int().positive(),
        })
        .strict(),
    })
    .strict(),
  z.object({ action: z.literal("projects") }).strict(),
  z.object({ action: z.literal("catalog") }).strict(),
  z.object({ action: z.literal("project"), ...project }).strict(),
  z.object({ action: z.literal("index"), ...project }).strict(),
  z
    .object({
      action: z.literal("document"),
      ...document,
      revision: z.number().int().positive().optional(),
    })
    .strict(),
  z
    .object({
      action: z.literal("createProject"),
      requestId: identifier,
      name: text,
      description: z.string().max(5000).optional(),
    })
    .strict(),
  z
    .object({
      action: z.literal("addSource"),
      requestId: identifier,
      ...project,
      source: sourceSchema.omit({ id: true, capturedAt: true }),
    })
    .strict(),
  z
    .object({
      action: z.literal("review"),
      ...write,
      transition: z.enum(["review", "approve"]),
      actor: text,
    })
    .strict(),
  z
    .object({
      action: z.literal("comment"),
      questionId: identifier.optional(),
      ...write,
      text: z.string().trim().min(1).max(5000),
      author: text,
    })
    .strict(),
  z
    .object({
      action: z.literal("handoff"),
      ...project,
      selections: z
        .array(
          z
            .object({
              documentId: identifier,
              revision: z.number().int().positive(),
            })
            .strict(),
        )
        .min(1),
    })
    .strict(),
]);
export async function POST(request: Request) {
  try {
    assertLocal(request);
    const input = parseInput(actions, await requestJson(request)),
      store = await getStore();
    let result: unknown;
    switch (input.action) {
      case "collaboration":
        result = await collaborationOverview(store);
        break;
      case "importFigma":
        result = await store.importFigma(input.requestId, input.projectId, {
          url: input.url,
          depth: input.depth,
        });
        break;
      case "editFlow":
        result = await store.editFlow(
          input.requestId,
          input.projectId,
          input.documentId,
          input.expectedRevision,
          input.edit,
        );
        break;
      case "relations":
        result = await store.relations(
          input.projectId,
          input.documentId,
          input.revision,
        );
        break;
      case "compare":
        result = await store.compareDocuments(
          input.projectId,
          input.before,
          input.after,
        );
        break;
      case "projects":
        result = await store.listProjects();
        break;
      case "catalog":
        result = catalog();
        break;
      case "project":
        result = await store.getProject(input.projectId);
        break;
      case "index":
        result = await store.index(input.projectId);
        break;
      case "document":
        result = await store.getDocument(
          input.projectId,
          input.documentId,
          input.revision,
        );
        break;
      case "createProject":
        result = await store.createProject(input.requestId, input);
        break;
      case "addSource":
        result = await store.addSource(
          input.requestId,
          input.projectId,
          input.source,
        );
        break;
      case "review":
        result = await store.review(
          input.requestId,
          input.projectId,
          input.documentId,
          input.expectedRevision,
          input.transition,
          input.actor,
        );
        break;
      case "comment":
        result = await store.comment(
          input.requestId,
          input.projectId,
          input.documentId,
          input.expectedRevision,
          input.text,
          input.author,
          input.questionId,
        );
        break;
      case "handoff":
        result = await store.handoff(input.projectId, input.selections);
        break;
    }
    return Response.json(
      { result },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return httpError(e);
  }
}
