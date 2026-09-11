import { expect, test } from "@playwright/test";
import { generateStableTurnEvaluation, TurnEvaluationContextChanged } from "../../src/entities/mission-run/api/stable-turn-evaluation";
import { selectTurnEvaluationContext, type TurnEvaluationRow } from "../../src/entities/mission-run/model/turn-evaluation";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
function row(id: string, sequence: number, text: string, role = "user"): TurnEvaluationRow {
  return { id, sequence_number: sequence, role, status: "complete", author_id: role === "user" ? "owner" : null, parts: [{ type: "text", text }] };
}
function fixture() {
  return { target: row("selected", 2, "I wants tea."), previous: [row("question", 1, "What would you like?", "assistant")], mission: { id: "pinned-v1", learningGoals: ["Order tea"] } };
}
function context(state: ReturnType<typeof fixture>) {
  return { ...selectTurnEvaluationContext(state.target, state.previous, "owner"), mission: structuredClone(state.mission) };
}

test("provider must finish before authoritative revalidation; a later correction does not contaminate the selected turn", async () => {
  const state = fixture();
  const initial = context(state);
  const provider = deferred<{ axes: string }>();
  const events: string[] = [];
  const pending = generateStableTurnEvaluation(initial, () => { events.push("generate"); return provider.promise; }, async () => { events.push("reload"); return context(state); });
  expect(events).toEqual(["generate"]);
  state.previous.push(row("later-correction", 3, "I want tea."));
  provider.resolve({ axes: "original selected-turn result" });
  await expect(pending).resolves.toEqual({ axes: "original selected-turn result" });
  expect(events).toEqual(["generate", "reload"]);
  expect(context(state).target.text).toBe("I wants tea.");
  expect(context(state).context.map(message => message.id)).toEqual(["question"]);
});

test("target, preceding context and pinned mission changes during generation reject the result", async () => {
  const edits: Array<(state: ReturnType<typeof fixture>) => void> = [
    state => { state.target.parts = [{ type: "text", text: "I want tea." }]; },
    state => { state.previous[0].parts = [{ type: "text", text: "How many teas?" }]; },
    state => { state.mission.id = "different-pinned-version"; },
  ];
  for (const edit of edits) {
    const state = fixture();
    const provider = deferred<string>();
    const pending = generateStableTurnEvaluation(context(state), () => provider.promise, async () => context(state));
    const assertion = expect(pending).rejects.toBeInstanceOf(TurnEvaluationContextChanged);
    edit(state);
    provider.resolve("stale generated result");
    await assertion;
  }
});

test("missing or newly unauthorized context after generation rejects, while provider failure propagates without a reload", async () => {
  const provider = deferred<string>();
  let reloads = 0;
  const missing = generateStableTurnEvaluation(context(fixture()), () => provider.promise, async () => { reloads++; throw new Error("Selected message no longer exists"); });
  const assertion = expect(missing).rejects.toBeInstanceOf(TurnEvaluationContextChanged);
  expect(reloads).toBe(0);
  provider.resolve("result");
  await assertion;
  expect(reloads).toBe(1);
  const failedProvider = deferred<string>();
  const originalError = new Error("Provider failed");
  const failed = generateStableTurnEvaluation(context(fixture()), () => failedProvider.promise, async () => { reloads++; return context(fixture()); });
  const failedAssertion = expect(failed).rejects.toBe(originalError);
  failedProvider.reject(originalError);
  await failedAssertion;
  expect(reloads).toBe(1);
});
