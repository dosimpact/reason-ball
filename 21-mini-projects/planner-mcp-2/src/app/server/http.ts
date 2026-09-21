import { ZodError } from "zod";
import { DomainError, ensure } from "@/entities/planner/rules";
export function assertAllowedRequest(request: Request) {
  const url = new URL(request.url);
  const host = request.headers.get("host") ?? url.host;
  const publicUrl = new URL(`${url.protocol}//${host}`);
  const hostname = publicUrl.hostname;
  const allowedOrigins = (process.env.PLANNER_ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  ensure(
    ["localhost", "127.0.0.1", "[::1]"].includes(hostname) ||
      allowedOrigins.includes(publicUrl.origin),
    "Request host is not allowed",
    403,
  );
  const origin = request.headers.get("origin");
  if (origin)
    ensure(origin === publicUrl.origin, "Cross-origin request rejected", 403);
}
export async function requestJson(request: Request) {
  const text = await request.text();
  ensure(text.length <= 400000, "Request too large", 413);
  try {
    return JSON.parse(text);
  } catch {
    throw new DomainError(400, "Invalid JSON");
  }
}
export function httpError(error: unknown) {
  if (error instanceof DomainError)
    return Response.json({ error: error.message }, { status: error.status });
  if (error instanceof ZodError)
    return Response.json(
      { error: "Invalid input", issues: error.issues },
      { status: 400 },
    );
  console.error(error);
  return Response.json({ error: "Internal server error" }, { status: 500 });
}
