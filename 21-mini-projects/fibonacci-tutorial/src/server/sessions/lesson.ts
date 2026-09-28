import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { getLessonDefinition, getLearningView } from "@/entities/lesson/server";
import { gradeLearningSubmission } from "@/entities/lesson/server";
import type { LearningSubmission, LearningView } from "@/entities/lesson";
import { analysisPlanSchema, validateMultiscaleSelection } from "@/entities/lesson";
import { getUnitSummary, type SessionView, type SourceConfig } from "@/entities/tutorial";
import { createLessonSnapshot, type ScenarioSnapshot } from "@/server/candle-data/registry";
import { readSession, serializeMutation, writeSession } from "./repository";
import { SessionError } from "./service";

export function visibleSnapshotId(candles: SessionView["visibleCandles"], timeframes?: LearningView["timeframes"]): string {
  return `sha256:${createHash("sha256").update(JSON.stringify(timeframes ? { candles, timeframes } : candles)).digest("hex")}`;
}

function visibleTimeframes(snapshot: ScenarioSnapshot, asOf: number): LearningView["timeframes"] {
  if (!snapshot.timeframes) return undefined;
  const end = asOf + 3600;
  return {
    "1h": snapshot.timeframes["1h"].filter((bar) => bar.time + 3600 <= end),
    "4h": snapshot.timeframes["4h"].filter((bar) => bar.time + 14400 <= end),
    "1d": snapshot.timeframes["1d"].filter((bar) => bar.time + 86400 <= end),
  };
}

export function lessonView(unitId: string, caseIndex: number, stepIndex: number, snapshot: ScenarioSnapshot, cursor: number, feedback: string[] = [], objectivePassed = false, submitted = false, visibleOverride?: SessionView["visibleCandles"]): LearningView {
  const view = getLearningView(unitId, caseIndex, stepIndex, feedback, objectivePassed, submitted);
  if (!view) throw new SessionError(400, "VALIDATION_ERROR", "Unknown advanced lesson or case.");
  const visibleCandles = visibleOverride ?? snapshot.candles.slice(0, cursor + 1);
  const asOf = visibleCandles.at(-1)?.time;
  if (asOf === undefined) throw new SessionError(400, "VALIDATION_ERROR", "Lesson has no visible candle.");
  const timeframes = visibleTimeframes(snapshot, asOf);
  const intervalSeconds = snapshot.sourceConfig?.type === "binance" ? snapshot.sourceConfig.interval === "1d" ? 86400 : snapshot.sourceConfig.interval === "4h" ? 14400 : 3600 : 3600;
  const currentCase = view.currentCase && snapshot.sourceConfig?.type === "binance" ? {
    ...view.currentCase,
    sourceNote: `${view.currentCase.sourceNote} ${snapshot.sourceConfig.symbol} ${snapshot.sourceConfig.interval}; UTC ${new Date(snapshot.candles[0].time * 1000).toISOString()}–${new Date((snapshot.candles.at(-1)!.time + intervalSeconds) * 1000 - 1).toISOString()}; frozen ${snapshot.id}.`,
  } : view.currentCase;
  return { ...view, currentCase, selfAssessment: false, asOf, snapshotId: visibleSnapshotId(visibleCandles, timeframes), timeframes };
}

export async function createAdvancedSession(unitId: string, source: SourceConfig): Promise<SessionView> {
  return serializeMutation(async () => {
    const definition = getLessonDefinition(unitId);
    if (!definition) throw new SessionError(400, "VALIDATION_ERROR", "Unknown advanced lesson.");
    const { snapshot, initialCursor } = await createLessonSnapshot(unitId, 0, source);
    const learning = lessonView(unitId, 0, 0, snapshot, initialCursor);
    const firstStep = definition.steps?.[0];
    const firstCase = definition.cases?.[0];
    const view: SessionView = {
      id: randomUUID(), unitId, unit: getUnitSummary(unitId), source: snapshot.sourceConfig ?? source,
      cursor: initialCursor, visibleCandles: snapshot.candles.slice(0, initialCursor + 1), totalCandles: snapshot.candles.length,
      plan: null, plans: [], evaluations: [], complete: false,
      theoryStep: 0, theoryStepCount: definition.steps?.length ?? 0,
      instruction: { title: firstStep?.title ?? firstCase?.title ?? definition.title, description: firstStep?.body ?? firstCase?.instruction ?? definition.objective, showFibonacci: false },
      selectedIndices: firstStep?.focusIndices ?? [], validation: [], hint: null, exampleIndices: null, reflection: null,
      learning, analysis: definition.kind === "practice" ? { plans: [], activePlanId: null, evaluations: [], reflection: null, reflections: [] } : null,
      monitoring: null, monitoringHistory: [],
    };
    await writeSession({ view, snapshot, lessonSnapshots: firstCase ? { [firstCase.id]: snapshot } : undefined, lessonCursors: firstCase ? { [firstCase.id]: initialCursor } : undefined, lessonProgress: {} });
    return view;
  });
}

export function advanceAdvancedTheory(id: string, expectedStep: number, direction: "next" | "prev"): Promise<SessionView> {
  return serializeMutation(async () => {
    const record = await readSession(id);
    if (!record) throw new SessionError(404, "NOT_FOUND", "Session not found.");
    const { view: session, snapshot } = record;
    const definition = getLessonDefinition(session.unitId);
    if (!definition || definition.kind !== "theory") throw new SessionError(409, "CONFLICT", "Not an advanced theory lesson.");
    if (session.theoryStep !== expectedStep) throw new SessionError(409, "CONFLICT", "Theory step is stale.");
    const target = expectedStep + (direction === "prev" ? -1 : 1);
    if (target < 0 || target >= (definition.steps?.length ?? 0)) throw new SessionError(409, "CONFLICT", "Complete the 3-question check before finishing the lesson.");
    const step = definition.steps![target];
    const cursor = Math.min(step.visibleCount, snapshot.candles.length) - 1;
    const learning = lessonView(session.unitId, 0, target, snapshot, cursor, session.learning?.feedback, session.learning?.objectivePassed, session.learning?.submitted);
    const updated: SessionView = { ...session, cursor, visibleCandles: snapshot.candles.slice(0, cursor + 1), theoryStep: target, complete: direction === "prev" ? false : session.complete,
      selectedIndices: step.focusIndices, instruction: { title: step.title, description: step.body, showFibonacci: false }, learning };
    await writeSession({ ...record, view: updated });
    return updated;
  });
}

export function submitLesson(id: string, submission: LearningSubmission): Promise<SessionView> {
  return serializeMutation(async () => {
    const record = await readSession(id);
    if (!record) throw new SessionError(404, "NOT_FOUND", "Session not found.");
    const session = record.view;
    const definition = getLessonDefinition(session.unitId);
    if (!definition || !session.learning) throw new SessionError(409, "CONFLICT", "This unit has no advanced lesson submission.");
    if (definition.kind === "theory" && session.theoryStep !== (definition.steps?.length ?? 0) - 1) throw new SessionError(409, "CONFLICT", "Read all five steps before the check.");
    const caseIndex = session.learning.caseIndex;
    const embeddedPlan = submission.values?.analysis;
    if (embeddedPlan !== undefined) {
      const parsed = analysisPlanSchema.safeParse(embeddedPlan);
      if (!parsed.success) throw new SessionError(400, "VALIDATION_ERROR", "Invalid submitted analysis plan.");
      const matchesCurrent = parsed.data.asOf === session.learning.asOf && parsed.data.snapshotId === session.learning.snapshotId;
      const matchesFrozenPlan = session.analysis?.plans.some((item) => item.caseId === definition.cases?.[caseIndex]?.id &&
        item.plan.asOf === parsed.data.asOf && item.plan.snapshotId === parsed.data.snapshotId && JSON.stringify(item.plan) === JSON.stringify(parsed.data));
      if (!matchesCurrent && !matchesFrozenPlan) {
        throw new SessionError(409, "CONFLICT", "Submitted analysis refers to another visible snapshot or time.");
      }
    }
    const observedAt = session.unitId === "ew-live-followup" ? session.analysis?.evaluations
      .filter((item) => item.caseId === definition.cases?.[caseIndex]?.id && item.mode === "later-market")
      .at(-1)?.observedThrough : undefined;
    const effectiveSubmission = session.unitId === "ew-live-followup" ? { ...submission, observedAt } : submission;
    let grade;
    try { grade = gradeLearningSubmission(session.unitId, effectiveSubmission, caseIndex, session.cursor + 1); }
    catch (error) { throw new SessionError(400, "VALIDATION_ERROR", error instanceof Error ? error.message : "Invalid lesson submission."); }
    if (session.unitId === "ew-aligned-count") {
      const timeframes = session.learning.timeframes;
      const parent = effectiveSubmission.values?.parent;
      const children = effectiveSubmission.values?.children;
      if (!timeframes || !Array.isArray(parent) || !Array.isArray(children) ||
          !parent.every((value) => typeof value === "number") || !children.every((value) => typeof value === "number")) {
        grade = { ...grade, passed: false, objectivePassed: false, feedback: [...grade.feedback, "닫힌 1d 부모 구간과 1h 하위 구간 두 점을 제출하세요."] };
      } else {
        const failures = validateMultiscaleSelection(parent as number[], children as number[], timeframes).filter((item) => !item.pass);
        if (failures.length) grade = { ...grade, passed: false, objectivePassed: false, feedback: [...grade.feedback, ...failures.map((item) => `${item.rule}: ${item.reason}`)] };
      }
    }
    const lessonCase = definition.cases?.[caseIndex];
    const attempt = { submission: effectiveSubmission, grade, submittedAt: new Date().toISOString() };
    const previousProgress = lessonCase ? record.lessonProgress?.[lessonCase.id] : undefined;
    const lessonProgress = lessonCase ? { ...record.lessonProgress, [lessonCase.id]: previousProgress?.grade.passed && !grade.passed ? previousProgress : attempt } : record.lessonProgress;
    const lessonAttempts = lessonCase ? { ...record.lessonAttempts, [lessonCase.id]: [...(record.lessonAttempts?.[lessonCase.id] ?? []), attempt] } : record.lessonAttempts;
    const learning = lessonView(session.unitId, caseIndex, session.theoryStep, record.snapshot, session.cursor, grade.feedback, grade.objectivePassed, true, session.visibleCandles);
    learning.selfAssessment = grade.selfAssessmentPassed;
    const allCasesPassed = definition.kind === "practice" && definition.cases!.every((item) => lessonProgress?.[item.id]?.grade.passed);
    const needsObservation = ["D60R", "D96R", "H", "HR", "M", "L"].includes(definition.profile);
    const observedEveryCase = definition.cases?.every((item) => session.analysis?.plans.some((plan) => plan.caseId === item.id &&
      session.analysis?.evaluations.some((evaluation) => evaluation.planId === plan.id && evaluation.observedThrough > plan.plan.asOf) &&
      session.analysis?.reflections.some((reflection) => reflection.planId === plan.id)));
    const uniquePortfolio = definition.id !== "ew-final-portfolio" || new Set(definition.cases?.map((item) => record.lessonSnapshots?.[item.id]?.id)).size >= 3;
    const complete = definition.kind === "theory" ? grade.passed : Boolean(allCasesPassed && uniquePortfolio && (!needsObservation || observedEveryCase));
    const updated: SessionView = { ...session, learning, complete };
    await writeSession({ ...record, view: updated, lessonProgress, lessonAttempts });
    return updated;
  });
}

export function selectLessonCase(id: string, caseIndex: number): Promise<SessionView> {
  return serializeMutation(async () => {
    const record = await readSession(id);
    if (!record) throw new SessionError(404, "NOT_FOUND", "Session not found.");
    const session = record.view;
    const definition = getLessonDefinition(session.unitId);
    const target = definition?.cases?.[caseIndex];
    if (!target || !session.learning || definition?.kind !== "practice") throw new SessionError(400, "VALIDATION_ERROR", "Unknown practice case.");
    if (session.unitId !== "ew-final-portfolio" && caseIndex > 0 && !definition.cases?.slice(0, caseIndex).every((item) => record.lessonProgress?.[item.id]?.grade.passed)) {
      throw new SessionError(409, "CONFLICT", "Complete earlier cases before opening this case.");
    }
    const existingSnapshot = record.lessonSnapshots?.[target.id];
    const { snapshot, initialCursor } = existingSnapshot ? { snapshot: existingSnapshot, initialCursor: record.lessonCursors?.[target.id] ?? Math.min(target.visibleCount, existingSnapshot.candles.length) - 1 } : await createLessonSnapshot(session.unitId, caseIndex, session.source);
    const progress = record.lessonProgress?.[target.id];
    const learning = lessonView(session.unitId, caseIndex, 0, snapshot, initialCursor, progress?.grade.feedback, progress?.grade.objectivePassed, Boolean(progress));
    learning.selfAssessment = progress?.grade.selfAssessmentPassed ?? false;
    const updated: SessionView = { ...session, source: snapshot.sourceConfig ?? session.source, cursor: initialCursor, visibleCandles: snapshot.candles.slice(0, initialCursor + 1), totalCandles: snapshot.candles.length,
      learning, instruction: { title: target.title, description: target.instruction, showFibonacci: false }, hint: null, exampleIndices: null,
      analysis: session.analysis ? { ...session.analysis, activePlanId: session.analysis.plans.findLast((item) => item.caseId === target.id)?.id ?? null, reflection: session.analysis.reflection?.caseId === target.id ? session.analysis.reflection : null } : null };
    const previousCaseId = caseIdForSession(session);
    await writeSession({ ...record, snapshot, view: updated, lessonSnapshots: { ...record.lessonSnapshots, [target.id]: snapshot },
      lessonCursors: { ...record.lessonCursors, ...(previousCaseId ? { [previousCaseId]: session.cursor } : {}), [target.id]: initialCursor } });
    return updated;
  });
}

function caseIdForSession(session: SessionView): string | undefined {
  return getLessonDefinition(session.unitId)?.cases?.[session.learning?.caseIndex ?? 0]?.id;
}

export function revealLessonHint(id: string, kind: "hint" | "example"): Promise<SessionView> {
  return serializeMutation(async () => {
    const record = await readSession(id);
    if (!record) throw new SessionError(404, "NOT_FOUND", "Session not found.");
    const session = record.view;
    const lessonCase = getLessonDefinition(session.unitId)?.cases?.[session.learning?.caseIndex ?? 0];
    if (!lessonCase) throw new SessionError(409, "CONFLICT", "Theory lessons have no practice hint.");
    if (kind === "example" && (!lessonCase.canReveal || !record.lessonProgress?.[lessonCase.id])) throw new SessionError(409, "CONFLICT", "Submit this case before revealing an example.");
    const updated: SessionView = { ...session, hint: kind === "hint" ? lessonCase.instruction : `예시 해석: ${JSON.stringify(lessonCase.expected)}. ${lessonCase.feedback}` };
    await writeSession({ ...record, view: updated });
    return updated;
  });
}
