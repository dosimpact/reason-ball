"use client";

import { useEffect, useState } from "react";
import { httpArtifactRepository, type ChatArtifact, type ChatArtifactKind } from "@/entities/chat";
import { ArtifactWorkspace } from "./artifact-workspace";

export function RemoteArtifactWorkspace({ conversationId, initialKind, onClose }: {
  conversationId: string; initialKind?: ChatArtifactKind; onClose: () => void;
}) {
  const [artifacts, setArtifacts] = useState<ChatArtifact[]>();
  const [error, setError] = useState<string>();
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    httpArtifactRepository.list(conversationId).then(
      (items) => { if (active) { setArtifacts(items); setError(undefined); } },
      (cause) => { if (active) setError(cause instanceof Error ? cause.message : "Artifact를 불러오지 못했어요."); },
    );
    return () => { active = false; };
  }, [conversationId, attempt]);

  if (!artifacts) return <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-5" role="dialog" aria-modal="true" aria-label="Artifact 불러오기">
    <div className="rounded-2xl bg-white p-6">
      {error ? <><p role="alert">{error}</p><button type="button" onClick={() => setAttempt((value) => value + 1)}>Artifact 다시 불러오기</button></> : <p role="status">Artifact를 불러오는 중…</p>}
      <button type="button" className="ml-4" onClick={onClose}>Artifact 닫기</button>
    </div>
  </div>;

  return <ArtifactWorkspace artifacts={artifacts} initialKind={initialKind} onChange={setArtifacts} onClose={onClose} persistence={{
    create: (kind, edit) => httpArtifactRepository.create(conversationId, kind, edit),
    save: httpArtifactRepository.save,
  }} />;
}
