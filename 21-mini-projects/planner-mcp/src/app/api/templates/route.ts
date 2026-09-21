import { z } from "zod";
import { getStore } from "@/app/server/runtime";
import { assertLocal, httpError, requestJson } from "@/app/server/http";
import { parseInput } from "@/app/server/store";
import { identifier } from "@/entities/document/model/schema";
import { templateDraftSchema } from "@/entities/template/model/schema";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try {
    assertLocal(request);
    return Response.json(
      { result: await (await getStore()).templates.list() },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return httpError(error);
  }
}
export async function POST(request: Request) {
  try {
    assertLocal(request);
    const input = parseInput(
      z
        .object({ requestId: identifier, template: templateDraftSchema })
        .strict(),
      await requestJson(request),
    );
    return Response.json(
      {
        result: await (
          await getStore()
        ).templates.save(input.requestId, input.template),
      },
      { status: 201, headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return httpError(error);
  }
}
