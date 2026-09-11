export class TurnEvaluationContextChanged extends Error {
  constructor() {
    super("The selected turn evaluation context changed during generation.");
    this.name = "TurnEvaluationContextChanged";
  }
}

/** Revalidate the same authoritative, normalized context after generation finishes. */
export async function generateStableTurnEvaluation<Context, Result>(
  initialContext: Context,
  generate: () => Promise<Result>,
  reloadContext: () => Promise<Context>,
): Promise<Result> {
  const generated = await generate();
  let current: Context;
  try { current = await reloadContext(); }
  catch { throw new TurnEvaluationContextChanged(); }
  if (JSON.stringify(current) !== JSON.stringify(initialContext)) throw new TurnEvaluationContextChanged();
  return generated;
}
