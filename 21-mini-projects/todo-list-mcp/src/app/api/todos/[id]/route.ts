import { todoRuntime } from "@/server/runtime";
import { respond } from "@/server/http";
export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };
export function GET(request: Request, context: Context) {
  return respond(request, async () =>
    todoRuntime.service.get((await context.params).id),
  );
}
export function PATCH(request: Request, context: Context) {
  return respond(request, async () =>
    todoRuntime.service.update((await context.params).id, await request.json()),
  );
}
export function DELETE(request: Request, context: Context) {
  return respond(request, async () =>
    todoRuntime.service.delete((await context.params).id),
  );
}
