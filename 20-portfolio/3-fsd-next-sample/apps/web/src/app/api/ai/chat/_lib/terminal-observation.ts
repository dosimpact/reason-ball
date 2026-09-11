export type TerminalOutcome = "success" | "error" | "aborted";

// Provider finish is not request success: persistence must finish first.
export function createTerminalObservation(emit: (outcome: TerminalOutcome) => void) {
  let recorded = false;
  function record(outcome: TerminalOutcome) {
    if (recorded) return;
    recorded = true;
    emit(outcome);
  }
  return {
    record,
    async persist(outcome: TerminalOutcome, save: () => Promise<void>) {
      try {
        await save();
      } catch (error) {
        record("error");
        throw error;
      }
      record(outcome);
    },
  };
}
