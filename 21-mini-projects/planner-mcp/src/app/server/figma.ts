import { z } from "zod";
import { PlannerError } from "@/shared/lib/errors";

export const figmaImportSchema = z
  .object({
    url: z.string().url().max(2000),
    depth: z.number().int().min(1).max(10).default(2),
  })
  .strict();
export type FigmaInput = z.input<typeof figmaImportSchema>;

export function parseFigmaUrl(input: string) {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    throw new PlannerError(
      "FIGMA_URL_INVALID",
      "Figma 파일 또는 노드 URL이 필요합니다.",
    );
  }
  const match = /^\/(?:design|file)\/([a-zA-Z0-9]+)(?:\/|$)/.exec(url.pathname);
  if (
    url.protocol !== "https:" ||
    !["www.figma.com", "figma.com"].includes(url.hostname) ||
    url.port ||
    url.username ||
    url.password ||
    !match
  )
    throw new PlannerError(
      "FIGMA_URL_INVALID",
      "https://www.figma.com/design/ 또는 /file/ URL을 사용하세요.",
    );
  const nodeId = url.searchParams.get("node-id")?.replaceAll("-", ":");
  if (nodeId !== undefined && !/^\d+:\d+$/.test(nodeId))
    throw new PlannerError(
      "FIGMA_URL_INVALID",
      "Figma node-id 형식이 올바르지 않습니다.",
    );
  const version = url.searchParams.get("version-id");
  if (version && !/^[a-zA-Z0-9_-]{1,128}$/.test(version))
    throw new PlannerError(
      "FIGMA_URL_INVALID",
      "Figma version-id 형식이 올바르지 않습니다.",
    );
  const canonical = new URL(`https://www.figma.com/design/${match[1]}`);
  if (nodeId) canonical.searchParams.set("node-id", nodeId);
  if (version) canonical.searchParams.set("version-id", version);
  return { fileKey: match[1], nodeId, version, url: canonical.toString() };
}

export async function fetchFigma(
  input: FigmaInput,
  options: { token?: string; fetch?: typeof fetch; timeoutMs?: number } = {},
) {
  const parsed = figmaImportSchema.parse(input),
    target = parseFigmaUrl(parsed.url);
  const token = options.token ?? process.env.FIGMA_ACCESS_TOKEN;
  if (!token)
    throw new PlannerError(
      "FIGMA_NOT_CONFIGURED",
      "서버에 FIGMA_ACCESS_TOKEN을 설정하고 재시작하세요.",
    );
  const endpoint = new URL(
    `https://api.figma.com/v1/files/${target.fileKey}${target.nodeId ? "/nodes" : ""}`,
  );
  endpoint.searchParams.set("depth", String(parsed.depth));
  if (target.nodeId) endpoint.searchParams.set("ids", target.nodeId);
  if (target.version) endpoint.searchParams.set("version", target.version);
  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(),
    options.timeoutMs ?? 10_000,
  );
  try {
    const response = await (options.fetch ?? fetch)(endpoint, {
      headers: { "X-Figma-Token": token },
      signal: controller.signal,
      redirect: "error",
      cache: "no-store",
    });
    if (!response.ok) {
      await response.body?.cancel();
      const code =
        response.status === 401 || response.status === 403
          ? "FIGMA_FORBIDDEN"
          : response.status === 404
            ? "FIGMA_NOT_FOUND"
            : response.status === 429
              ? "FIGMA_RATE_LIMITED"
              : "FIGMA_UNAVAILABLE";
      const retry = response.headers.get("retry-after");
      throw new PlannerError(
        code,
        code === "FIGMA_FORBIDDEN"
          ? "Figma 토큰의 만료·파일 접근 권한·file_content:read 범위를 확인하세요."
          : code === "FIGMA_NOT_FOUND"
            ? "Figma 파일을 찾을 수 없습니다."
            : code === "FIGMA_RATE_LIMITED"
              ? "Figma 호출 제한입니다. 잠시 후 같은 요청으로 재시도하세요."
              : "Figma 서버가 요청을 처리하지 못했습니다.",
        {
          status: response.status,
          ...(retry && /^\d+$/.test(retry)
            ? { retryAfterSeconds: Number(retry) }
            : {}),
        },
      );
    }
    const reader = response.body?.getReader();
    if (!reader)
      throw new PlannerError(
        "FIGMA_RESPONSE_INVALID",
        "Figma 응답이 비어 있습니다.",
      );
    const chunks: Uint8Array[] = [];
    let size = 0;
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 180_000) {
        await reader.cancel();
        throw new PlannerError(
          "FIGMA_TOO_LARGE",
          "Figma 응답이 너무 큽니다. 노드 링크를 지정하거나 조회 깊이를 줄이세요.",
        );
      }
      chunks.push(value);
    }
    let data: Record<string, unknown>;
    try {
      data = JSON.parse(Buffer.concat(chunks).toString("utf8"));
      if (
        !data ||
        typeof data.name !== "string" ||
        typeof data.lastModified !== "string" ||
        typeof data.version !== "string"
      )
        throw new Error();
      if (target.nodeId) {
        const node = (
          data.nodes as Record<string, { document?: unknown }> | undefined
        )?.[target.nodeId];
        if (!node)
          throw new PlannerError(
            "FIGMA_NODE_NOT_FOUND",
            "선택한 Figma 노드가 없습니다.",
          );
        if (!node.document) throw new Error();
      } else if (!data.document) throw new Error();
    } catch (error) {
      if (error instanceof PlannerError) throw error;
      throw new PlannerError(
        "FIGMA_RESPONSE_INVALID",
        "Figma 응답 형식이 올바르지 않습니다.",
      );
    }
    return {
      kind: "figma" as const,
      title: `Figma · ${data.name}`.slice(0, 2000),
      url: target.url,
      originalText: JSON.stringify({
        provider: "figma",
        fileKey: target.fileKey,
        nodeId: target.nodeId,
        requestedDepth: parsed.depth,
        response: data,
      }),
    };
  } catch (error) {
    if (error instanceof PlannerError) throw error;
    throw new PlannerError(
      controller.signal.aborted ? "FIGMA_TIMEOUT" : "FIGMA_UNAVAILABLE",
      controller.signal.aborted
        ? "Figma 응답 시간이 초과되었습니다. 다시 시도하세요."
        : "Figma에 연결할 수 없습니다.",
    );
  } finally {
    clearTimeout(timer);
  }
}
