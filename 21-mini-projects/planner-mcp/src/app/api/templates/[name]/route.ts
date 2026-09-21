import { z } from "zod";
import { getStore } from "@/app/server/runtime";
import { assertLocal, httpError, requestJson } from "@/app/server/http";
import { parseInput } from "@/app/server/store";
import { identifier } from "@/entities/document/model/schema";
import {
  templateDraftSchema,
  templateName,
} from "@/entities/template/model/schema";
import { PlannerError } from "@/shared/lib/errors";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ name: string }> };
const writeSchema = z
  .object({
    requestId: identifier,
    expectedRevision: z.number().int().positive(),
  })
  .strict();
export async function GET(request: Request, context: Context) {
  try {
    assertLocal(request);
    const name = parseInput(templateName, (await context.params).name);
    return Response.json(
      { result: await (await getStore()).templates.get(name) },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return httpError(error);
  }
}
export async function PUT(request: Request, context: Context) {
  try {
    assertLocal(request);
    const name = parseInput(templateName, (await context.params).name);
    const input = parseInput(
      writeSchema.extend({ template: templateDraftSchema }),
      await requestJson(request),
    );
    if (input.template.name !== name)
      throw new PlannerError(
        "SCHEMA_INVALID",
        "경로와 템플릿 이름이 일치해야 합니다.",
      );
    return Response.json(
      {
        result: await (
          await getStore()
        ).templates.save(
          input.requestId,
          input.template,
          input.expectedRevision,
        ),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return httpError(error);
  }
}
export async function DELETE(request: Request, context: Context) {
  try {
    assertLocal(request);
    const name = parseInput(templateName, (await context.params).name);
    const input = parseInput(writeSchema, await requestJson(request));
    return Response.json(
      {
        result: await (
          await getStore()
        ).templates.delete(input.requestId, name, input.expectedRevision),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return httpError(error);
  }
}
