import { todoRuntime } from "@/server/runtime";
import { guard } from "@/server/http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
async function handle(request: Request) {
  try {
    guard(request);
  } catch {
    return Response.json(
      { error: "Origin or host not allowed" },
      { status: 403 },
    );
  }
  return todoRuntime.sessions.handle(request);
}
export { handle as GET, handle as POST, handle as DELETE };
