import { activityResponseSchema, type ActivityRequest } from "../model/activity";

export function createActivityRecorder(conversationId: string, onSaved: () => void, onError: (message?: string) => void, fetcher: typeof fetch = fetch) {
  let pending: ActivityRequest | undefined;
  let acknowledged = false;
  let desired = false;
  let running = false;
  return {
    async pulse(active: boolean) {
      desired = active;
      if (running || (!pending && !active && !acknowledged)) return;
      running = true;
      try {
        do {
          pending ??= { conversationId, requestId: crypto.randomUUID(), active: desired };
          const response = await fetcher("/api/me/activity", { method: "POST", keepalive: true,
            headers: { "Content-Type": "application/json" }, body: JSON.stringify(pending) });
          if (!response.ok) throw new Error("학습 시간 기록을 저장하지 못했어요. 대화는 계속할 수 있습니다.");
          activityResponseSchema.parse((await response.json()).activity);
          acknowledged = pending.active;
          pending = undefined;
          onError(undefined);
          onSaved();
          // A hide/unmount during an in-flight start still closes that start.
        } while (desired !== acknowledged);
      } catch {
        onError("학습 시간 기록을 저장하지 못했어요. 대화는 계속할 수 있습니다.");
      } finally { running = false; }
    },
  };
}
