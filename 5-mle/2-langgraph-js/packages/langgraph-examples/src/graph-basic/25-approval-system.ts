import { Annotation, Command, END, interrupt, type BaseCheckpointSaver, START, StateGraph } from "@langchain/langgraph";

export type ApprovalDecision =
  | "approve"
  | "reject"
  | {
      action: "approve" | "reject" | "edit";
      action_text?: string;
    };

export interface ApprovalInterruptPayload {
  kind: "approval_request";
  action: string;
  risk: string;
  options: ["approve", "reject", "edit"];
}

const ApprovalState = Annotation.Root({
  action: Annotation<string>(),
  risk: Annotation<string>(),
  approved: Annotation<boolean>(),
  decision_reason: Annotation<string>(),
  execution_result: Annotation<string>()
});

type ApprovalStateValue = typeof ApprovalState.State;
type ApprovalUpdate = typeof ApprovalState.Update;
type ApprovalNode = typeof START | "classify_risk" | "request_approval" | "execute";

export interface ApprovalGraphOptions {
  checkpointer?: BaseCheckpointSaver | boolean;
}

export const HIGH_RISK_TERMS = ["delete", "drop", "production", "payment", "email all", "refund"] as const;

export function classifyRisk(state: ApprovalStateValue) {
  const action = state.action.toLowerCase();
  const risk = HIGH_RISK_TERMS.some((term) => action.includes(term)) ? "high" : "low";

  return {
    risk,
    approved: risk === "low",
    decision_reason: risk === "low" ? "auto-approved low-risk action" : "human approval required"
  };
}

export function routeAfterRisk(state: ApprovalStateValue): "execute" | "request_approval" {
  return state.approved ? "execute" : "request_approval";
}

export function requestApproval(state: ApprovalStateValue) {
  const decision = interrupt<ApprovalInterruptPayload, ApprovalDecision>({
    kind: "approval_request",
    action: state.action,
    risk: state.risk || "unknown",
    options: ["approve", "reject", "edit"]
  });

  if (typeof decision === "object" && decision !== null) {
    if (decision.action === "edit") {
      return {
        action: decision.action_text ?? state.action,
        approved: true,
        decision_reason: "human edited and approved action"
      };
    }

    return {
      approved: decision.action === "approve",
      decision_reason: decision.action === "approve" ? "human approved action" : "human rejected action"
    };
  }

  if (decision === "approve") {
    return {
      approved: true,
      decision_reason: "human approved action"
    };
  }

  return {
    approved: false,
    decision_reason: "human rejected action"
  };
}

export function execute(state: ApprovalStateValue) {
  if (!state.approved) {
    return {
      execution_result: `BLOCKED: ${state.action}`
    };
  }

  return {
    execution_result: `EXECUTED: ${state.action}`
  };
}

export function createApprovalCommand(decision: ApprovalDecision) {
  return new Command<ApprovalDecision, ApprovalUpdate, ApprovalNode>({ resume: decision });
}

export function buildGraph(options: ApprovalGraphOptions = {}) {
  return new StateGraph(ApprovalState)
    .addNode("classify_risk", classifyRisk)
    .addNode("request_approval", requestApproval)
    .addNode("execute", execute)
    .addEdge(START, "classify_risk")
    .addConditionalEdges("classify_risk", routeAfterRisk, {
      request_approval: "request_approval",
      execute: "execute"
    })
    .addEdge("request_approval", "execute")
    .addEdge("execute", END)
    .compile({
      checkpointer: options.checkpointer
    });
}

export const graph = buildGraph();
export const approvalSystemGraph = graph;
