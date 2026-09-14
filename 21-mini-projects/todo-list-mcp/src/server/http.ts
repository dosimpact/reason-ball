import "server-only";
import { ZodError } from "zod";
import { TodoError } from "../shared/todo";
export function guard(request: Request) {
  const host = request.headers.get("host") ?? "";
  const allowedHosts = (process.env.TODO_ALLOWED_HOSTS ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  if (
    !/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host) &&
    !allowedHosts.includes(host)
  )
    throw new TodoError("Host not allowed", 403);
  const origin = request.headers.get("origin");
  if (origin && origin !== "http://" + host)
    throw new TodoError("Origin not allowed", 403);
}
export async function respond(
  request: Request,
  work: () => Promise<unknown>,
  status = 200,
) {
  try {
    guard(request);
    return Response.json(await work(), {
      status,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    const status =
      error instanceof TodoError
        ? error.status
        : error instanceof ZodError || error instanceof SyntaxError
          ? 400
          : 500;
    if (status === 500) console.error(error);
    return Response.json(
      {
        error:
          status === 500
            ? "Storage operation failed"
            : error instanceof Error
              ? error.message
              : "Invalid request",
      },
      { status },
    );
  }
}
