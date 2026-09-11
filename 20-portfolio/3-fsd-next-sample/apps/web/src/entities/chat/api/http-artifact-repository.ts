import { createUuid } from "@/shared/lib/uuid";
import type { ChatArtifact, ChatArtifactKind } from "../model/types";
import { ChatRepositoryError } from "./http-chat-repository";

type ArtifactItem = {
  id: string; conversationId: string; kind: ChatArtifactKind; title: string;
  status: "draft" | "published" | "archived"; currentVersionId: string;
  createdAt: string; updatedAt: string;
};
type VersionItem = {
  id: string; artifactId: string; versionNumber: number; contentText: string | null;
  contentJson: { imageUrl?: string } | null; createdAt: string;
  storageBucket?: string | null; storagePath?: string | null;
};
type ImageReference = { storageBucket: "artifact-images"; storagePath: string };
type VersionPage = { versions: VersionItem[]; hasMore?: boolean; nextCursor?: number | null; snapshotVersionId?: string };
export type ArtifactEdit = { title: string; content: string; imageUrl?: string };

export function artifactFromHttp(item: ArtifactItem, rows: readonly VersionItem[]): ChatArtifact {
  const ordered = [...rows].sort((a, b) => a.versionNumber - b.versionNumber);
  if (ordered.some((row) => row.artifactId !== item.id) || ordered.at(-1)?.id !== item.currentVersionId) {
    throw new Error("Artifact 버전 정보를 확인하지 못했어요.");
  }
  const versions = ordered.map((row) => ({
    id: row.id, createdAt: row.createdAt, content: row.contentText ?? "",
    ...(row.storageBucket === "artifact-images" && row.storagePath
      ? { imageUrl: `/api/artifacts/${encodeURIComponent(item.id)}/versions/${encodeURIComponent(row.id)}/image` }
      : typeof row.contentJson?.imageUrl === "string" ? { imageUrl: row.contentJson.imageUrl } : {}),
  }));
  const current = versions.find((version) => version.id === item.currentVersionId)!;
  return {
    id: item.id, kind: item.kind, title: item.title, createdAt: item.createdAt,
    updatedAt: item.updatedAt, autosavedAt: item.updatedAt, draft: current.content, versions,
  };
}

export function createHttpArtifactRepository(fetchJson: typeof fetch = fetch) {
  const pendingCreates = new Map<string, string>();
  const pendingSaves = new Map<string, string>();
  const imageReferences = new Map<string, ImageReference>();
  async function request<T>(url: string, method = "GET", body?: unknown): Promise<T> {
    const response = await fetchJson(url, {
      method, cache: "no-store",
      ...(body === undefined ? {} : { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }),
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) throw new ChatRepositoryError(
      payload?.error?.message ?? "Artifact 요청을 처리하지 못했어요.",
      payload?.error?.code ?? "ARTIFACT_REQUEST_FAILED", response.status,
    );
    if (!payload) throw new Error("Artifact 응답을 읽지 못했어요.");
    return payload;
  }
  async function get(id: string) {
    const payload = await request<{ item: ArtifactItem } & VersionPage>(`/api/artifacts/${encodeURIComponent(id)}`);
    if (payload.item.status === "archived") throw new Error("보관된 Artifact는 편집할 수 없어요.");
    const versions: VersionItem[] = [];
    const seenVersions = new Set<string>();
    const seenNumbers = new Set<number>();
    let page: VersionPage = payload;
    let after = 0;
    const snapshot = payload.item.currentVersionId;
    while (true) {
      if (!Array.isArray(page.versions) || (page.snapshotVersionId !== undefined && page.snapshotVersionId !== snapshot)) throw new Error("Artifact 조회 기준 버전이 달라졌어요.");
      if (page.versions.some((version) => version.versionNumber <= after)) throw new Error("Artifact 버전 페이지가 반복됐어요.");
      for (const version of page.versions) {
        if (seenVersions.has(version.id) || seenNumbers.has(version.versionNumber)) throw new Error("Artifact 버전 페이지가 반복됐어요.");
        seenVersions.add(version.id);
        seenNumbers.add(version.versionNumber);
      }
      versions.push(...page.versions);
      if (!page.hasMore) break;
      const cursor = page.nextCursor;
      if (typeof cursor !== "number" || !Number.isSafeInteger(cursor) || cursor <= after || cursor !== page.versions.at(-1)?.versionNumber) throw new Error("Artifact 버전의 다음 페이지를 확인하지 못했어요.");
      after = cursor;
      page = await request<VersionPage>(`/api/artifacts/${encodeURIComponent(id)}/versions?after=${after}&snapshotVersionId=${encodeURIComponent(snapshot)}`);
      if (page.snapshotVersionId !== snapshot) throw new Error("Artifact 조회 기준 버전이 달라졌어요.");
    }
    const artifact = artifactFromHttp(payload.item, versions);
    for (const version of versions) {
      if (version.storageBucket === "artifact-images" && version.storagePath) imageReferences.set(
        `${id}:/api/artifacts/${encodeURIComponent(id)}/versions/${encodeURIComponent(version.id)}/image`,
        { storageBucket: "artifact-images", storagePath: version.storagePath },
      );
    }
    return artifact;
  }
  async function content(edit: ArtifactEdit, artifactId?: string) {
    // JSON also represents an intentionally empty editor, which is valid content.
    const fields = { contentText: edit.content, contentJson: {}, status: "draft" };
    if (!edit.imageUrl) return fields;
    if (!artifactId) throw new Error("Image Artifact를 만든 뒤 이미지를 저장해 주세요.");
    let reference = imageReferences.get(`${artifactId}:${edit.imageUrl}`);
    if (!reference && edit.imageUrl.startsWith("data:")) {
      const uploaded = await request<{ image: ImageReference }>(`/api/artifacts/${encodeURIComponent(artifactId)}/image`, "POST", { dataUrl: edit.imageUrl });
      reference = uploaded.image;
      if (reference.storageBucket !== "artifact-images" || !reference.storagePath) throw new Error("이미지 저장 경로를 확인하지 못했어요.");
      imageReferences.set(`${artifactId}:${edit.imageUrl}`, reference);
    }
    if (!reference) throw new Error("저장된 이미지 경로를 확인하지 못했어요. Artifact를 다시 불러와 주세요.");
    return { ...fields, ...reference };
  }
  return {
    get,
    async list(conversationId: string) {
      const items: ArtifactItem[] = [];
      const seen = new Set<string>();
      let after = "";
      while (true) {
        const payload = await request<{ items: ArtifactItem[]; hasMore?: boolean; nextCursor?: string | null }>(`/api/artifacts?conversationId=${encodeURIComponent(conversationId)}${after ? `&after=${encodeURIComponent(after)}` : ""}`);
        if (!Array.isArray(payload.items)) throw new Error("Artifact 목록을 읽지 못했어요.");
        for (const item of payload.items) {
          if (seen.has(item.id) || (after && item.id <= after)) throw new Error("Artifact 목록 페이지가 반복됐어요.");
          seen.add(item.id);
          if (item.status !== "archived") items.push(item);
        }
        if (!payload.hasMore) break;
        const cursor = payload.nextCursor;
        if (!cursor || cursor <= after || cursor !== payload.items.at(-1)?.id) throw new Error("Artifact 목록의 다음 페이지를 확인하지 못했어요.");
        after = cursor;
      }
      // Bound fan-out while retaining all artifacts and their full histories.
      const artifacts: ChatArtifact[] = [];
      for (let offset = 0; offset < items.length; offset += 4) {
        artifacts.push(...await Promise.all(items.slice(offset, offset + 4).map((item) => get(item.id))));
      }
      return artifacts.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || a.id.localeCompare(b.id));
    },
    async create(conversationId: string, kind: ChatArtifactKind, edit: ArtifactEdit) {
      const body = { conversationId, kind, title: edit.title, ...await content(edit) };
      const key = JSON.stringify(body);
      const requestId = pendingCreates.get(key) ?? createUuid();
      pendingCreates.set(key, requestId);
      const payload = await request<{ item: ArtifactItem }>("/api/artifacts", "POST", {
        ...body, requestId,
      });
      const saved = await get(payload.item.id);
      pendingCreates.delete(key);
      return saved;
    },
    async save(id: string, edit: ArtifactEdit, expectedVersionId: string, forceVersion = false) {
      const key = JSON.stringify([id, edit.title, edit.content, edit.imageUrl, expectedVersionId]);
      let requestId = pendingSaves.get(key);
      if (!requestId) {
        const saved = await get(id);
        const latest = saved.versions.at(-1)!;
        if (latest.id !== expectedVersionId) throw new ChatRepositoryError(
          "다른 창에서 Artifact가 변경됐어요. 초안을 복사한 뒤 최신 버전을 다시 불러와 주세요.", "VERSION_CONFLICT", 409,
        );
        if (!forceVersion && saved.title === edit.title && latest.content === edit.content && latest.imageUrl === edit.imageUrl) return saved;
        requestId = createUuid();
        pendingSaves.set(key, requestId);
      }
      const body = { title: edit.title, ...await content(edit, id), expectedVersionId };
      await request(`/api/artifacts/${encodeURIComponent(id)}/versions`, "POST", { ...body, requestId });
      const committed = await get(id);
      pendingSaves.delete(key);
      if (edit.imageUrl?.startsWith("data:")) imageReferences.delete(`${id}:${edit.imageUrl}`);
      if (committed.versions.at(-1)?.id !== requestId) throw new ChatRepositoryError(
        "저장 이후 다른 변경이 추가됐어요. 초안을 복사한 뒤 최신 버전을 다시 불러와 주세요.", "VERSION_CONFLICT", 409,
      );
      return committed;
    },
  };
}

export const httpArtifactRepository = createHttpArtifactRepository();
