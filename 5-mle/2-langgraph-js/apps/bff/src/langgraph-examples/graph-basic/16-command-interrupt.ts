import { Annotation, Command, END, interrupt, type BaseCheckpointSaver, START, StateGraph } from "@langchain/langgraph";

export type ReviewDecision =
  | "approve"
  | "reject"
  | {
      action: "approve" | "reject" | "edit";
      text?: string;
    };

export interface ReviewInterruptPayload {
  question: string;
  draft: string;
  options: ["approve", "reject", "edit"];
}

const CommandInterruptState = Annotation.Root({
  topic: Annotation<string>(),
  draft: Annotation<string>(),
  approved: Annotation<boolean>(),
  final: Annotation<string>()
});

type CommandInterruptStateValue = typeof CommandInterruptState.State;
type CommandInterruptUpdate = typeof CommandInterruptState.Update;
type CommandInterruptNode = typeof START | "generate" | "human_review" | "publish";

export interface CommandInterruptGraphOptions {
  checkpointer?: BaseCheckpointSaver | boolean;
}

export function generate(state: CommandInterruptStateValue) {
  const topic = state.topic || "untitled";
  return {
    draft: `[Draft] An article about ${topic}.`
  };
}

export function humanReview(state: CommandInterruptStateValue) {
  const userDecision = interrupt<ReviewInterruptPayload, ReviewDecision>({
    question: "Approve this draft?",
    draft: state.draft,
    options: ["approve", "reject", "edit"]
  });

  if (typeof userDecision === "object" && userDecision !== null) {
    if (userDecision.action === "edit") {
      return {
        draft: userDecision.text ?? state.draft,
        approved: true
      };
    }

    return {
      approved: userDecision.action === "approve"
    };
  }

  return {
    approved: userDecision === "approve"
  };
}

export function publish(state: CommandInterruptStateValue) {
  if (!state.approved) {
    return {
      final: "(rejected)"
    };
  }

  return {
    final: `PUBLISHED: ${state.draft}`
  };
}

export function createReviewCommand(decision: ReviewDecision) {
  return new Command<ReviewDecision, CommandInterruptUpdate, CommandInterruptNode>({ resume: decision });
}

export function buildGraph(options: CommandInterruptGraphOptions = {}) {
  return new StateGraph(CommandInterruptState)
    .addNode("generate", generate)
    .addNode("human_review", humanReview)
    .addNode("publish", publish)
    .addEdge(START, "generate")
    .addEdge("generate", "human_review")
    .addEdge("human_review", "publish")
    .addEdge("publish", END)
    .compile({
      checkpointer: options.checkpointer
    });
}

export const graph = buildGraph();
export const commandInterruptGraph = graph;
