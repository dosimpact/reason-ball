import { NextRequest, NextResponse } from "next/server";
import { createParser } from "@openuidev/lang-core";
import spec from "@/features/sec-chat/generated/system-prompt.spec.json";

export const runtime = "nodejs";
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (typeof body?.program !== "string" || body.program.length > 60000 || !body.program.trim()) return NextResponse.json({ valid: false, errors: ["program must contain 1–60000 characters"] }, { status: 422 });
  try {
    const parsed = createParser(spec.schema, spec.root).parse(body.program);
    const errors = [...parsed.meta.errors, ...parsed.meta.unresolved].map(error => String(typeof error === "string" ? error : JSON.stringify(error))).slice(0, 12);
    if (!parsed.root) errors.push("Missing root component");
    if (parsed.meta.incomplete) errors.push("Incomplete program");
    return NextResponse.json({ valid: errors.length === 0, errors });
  } catch {
    return NextResponse.json({ valid: false, errors: ["Unable to parse OpenUI program"] });
  }
}
