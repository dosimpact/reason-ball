import { todoRuntime } from "@/server/runtime";
import { respond } from "@/server/http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export function GET(request: Request) {
  return respond(request, () => todoRuntime.service.list());
}
export function POST(request: Request) {
  return respond(
    request,
    async () => todoRuntime.service.create(await request.json()),
    201,
  );
}
