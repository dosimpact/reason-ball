import { POST as generate } from "@/app/api/ai/image/route";
import { playgroundUnavailableResponse } from "@/shared/lib/playground-policy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const unavailable = playgroundUnavailableResponse(process.env);
  if (unavailable) return unavailable;
  return generate(request);
}
