import { PlannerError, errorResult } from "@/shared/lib/errors";

export function assertLocal(
  request: Request,
  allowedHosts = process.env.PLANNER_ALLOWED_HOSTS ?? "",
) {
  const url = new URL(request.url);
  const authority = request.headers.get("host") ?? url.host;
  let host: string, originUrl: URL | undefined;
  try {
    host = new URL(`http://${authority}`).hostname;
    originUrl = request.headers.has("origin")
      ? new URL(request.headers.get("origin")!)
      : undefined;
  } catch {
    throw new PlannerError("FORBIDDEN", "유효한 출처가 필요합니다.");
  }
  const hosts = [
    "localhost",
    "127.0.0.1",
    "[::1]",
    ...allowedHosts
      .split(",")
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean),
  ];
  if (!hosts.includes(host))
    throw new PlannerError(
      "FORBIDDEN",
      "허용된 서버 주소로만 연결할 수 있습니다.",
    );
  if (
    originUrl &&
    (originUrl.host !== authority || originUrl.protocol !== url.protocol)
  )
    throw new PlannerError(
      "FORBIDDEN",
      "다른 출처의 요청은 허용하지 않습니다.",
    );
}
export async function requestJson(request: Request) {
  const reader = request.body?.getReader();
  if (!reader)
    throw new PlannerError("SCHEMA_INVALID", "JSON 본문이 필요합니다.");
  let size = 0;
  const chunks: Uint8Array[] = [];
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > 2_000_000) {
      await reader.cancel();
      throw new PlannerError(
        "PAYLOAD_TOO_LARGE",
        "입력은 2MB 이하로 제한됩니다.",
      );
    }
    chunks.push(value);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new PlannerError("SCHEMA_INVALID", "JSON 형식이 올바르지 않습니다.");
  }
}
export function httpError(error: unknown) {
  const result = errorResult(error);
  return Response.json(
    { error: result },
    {
      status:
        result.code === "FORBIDDEN"
          ? 403
          : result.code.endsWith("NOT_FOUND")
            ? 404
            : result.code.includes("CONFLICT")
              ? 409
              : result.code === "INTERNAL_ERROR"
                ? 500
                : 400,
    },
  );
}
