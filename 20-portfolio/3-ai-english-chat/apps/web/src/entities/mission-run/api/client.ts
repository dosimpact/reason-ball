import type {
  CompleteMissionRunInput,
  EvaluateMissionInput,
  MissionCompletionResponse,
  MissionEvaluationResponse,
  MissionRun,
  ReviewNote,
  StartMissionRunInput,
  UpdateMissionProgressInput,
} from "../model/types";

type ApiError = {
  error?: string | { code?: string; message?: string };
  message?: string;
};

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: {
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
  });
  if (!response.ok) {
    let detail = response.statusText;
    try {
      const payload = (await response.json()) as ApiError;
      detail =
        typeof payload.error === "string"
          ? payload.error
          : payload.error?.message ?? payload.message ?? detail;
    } catch {
      // Retain the HTTP status text for a non-JSON error response.
    }
    throw new Error(`${init?.method ?? "GET"} ${path} failed (${response.status}): ${detail}`);
  }
  return (await response.json()) as T;
}

export async function listMissionRuns() {
  const payload = await requestJson<{ runs: MissionRun[] }>("/api/mission-runs");
  return payload.runs;
}

export async function getMissionRun(runId: string) {
  const payload = await requestJson<{ run: MissionRun }>(
    `/api/mission-runs/${encodeURIComponent(runId)}`,
  );
  return payload.run;
}

export async function startMissionRun(input: StartMissionRunInput) {
  const payload = await requestJson<{ run: MissionRun }>("/api/mission-runs", {
    method: "POST",
    body: JSON.stringify(input),
  });
  return payload.run;
}

export async function updateMissionProgress(input: UpdateMissionProgressInput) {
  const { runId, ...body } = input;
  const payload = await requestJson<{ run: MissionRun }>(
    `/api/mission-runs/${encodeURIComponent(runId)}/progress`,
    { method: "PATCH", body: JSON.stringify(body) },
  );
  return payload.run;
}

export function evaluateMission(input: EvaluateMissionInput) {
  return requestJson<MissionEvaluationResponse>("/api/ai/evaluate", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function completeMissionRun(input: CompleteMissionRunInput) {
  const { runId, ...body } = input;
  return requestJson<MissionCompletionResponse>(
    `/api/mission-runs/${encodeURIComponent(runId)}/complete`,
    { method: "POST", body: JSON.stringify(body) },
  );
}

export async function getReviewNote(runId: string) {
  const payload = await requestJson<{ note: ReviewNote }>(
    `/api/mission-runs/${encodeURIComponent(runId)}/review-note`,
  );
  return payload.note;
}

export async function saveReviewNote(runId: string, note: string) {
  const payload = await requestJson<{ note: ReviewNote }>(
    `/api/mission-runs/${encodeURIComponent(runId)}/review-note`,
    { method: "PUT", body: JSON.stringify({ note }) },
  );
  return payload.note;
}
