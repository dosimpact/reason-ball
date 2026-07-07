export { graph as b01Simple, simpleGraph } from "./graph-basic/01-simple-graph.js";
export { graph as b02Llm, llmGraph } from "./graph-basic/02-llm-graph.js";
export { graph as b03ToolNode, toolNodeGraph } from "./graph-basic/03-tool-node.js";
export { graph as b04Subgraph, subgraphGraph } from "./graph-basic/04-subgraph.js";
export { graph as b05Interrupt, interruptGraph } from "./graph-basic/05-interrupt.js";
export { graph as b06Checkpointer, checkpointerGraph } from "./graph-basic/06-checkpointer.js";
export { graph as b07Streaming, streamingGraph } from "./graph-basic/07-streaming.js";
export { graph as b08MapReduce, mapReduceGraph } from "./graph-basic/08-map-reduce.js";
export { graph as b09StructuredOutput } from "./graph-basic/09-structured-output.js";
export { graph as b10Rag } from "./graph-basic/10-rag.js";
export { graph as b111Supervisor, supervisorGraph } from "./graph-basic/11-1-supervisor.js";
export { graph as b112Supervisor, hierarchicalSupervisorGraph } from "./graph-basic/11-2-supervisor.js";
export { graph as b113SupervisorDiffState, diffStateSupervisorGraph } from "./graph-basic/11-3-supervisor-diff-state.js";
export { graph as b114SupervisorChatSubgraph } from "./graph-basic/11-4-supervisor-chat-subgraph.js";
export { graph as b121Reflection, reflectionGraph } from "./graph-basic/12-1-reflection.js";
export { graph as b122Reflection, reflectionStreamingGraph } from "./graph-basic/12-2-reflection.js";
export { graph as b13PlanAndExecute, planAndExecuteGraph } from "./graph-basic/13-plan-and-execute.js";
export { graph as b14ParallelBranches, parallelBranchesGraph } from "./graph-basic/14-parallel-branches.js";
export { graph as b15LongTermMemory, longTermMemoryGraph } from "./graph-basic/15-long-term-memory.js";
export { graph as b16CommandInterrupt, commandInterruptGraph } from "./graph-basic/16-command-interrupt.js";
export { graph as b17Configurable } from "./graph-basic/17-configurable.js";
export { graph as b18CustomStreaming, customStreamingGraph } from "./graph-basic/18-custom-streaming.js";
export { graph as b19RetryPolicy, retryPolicyGraph } from "./graph-basic/19-retry-policy.js";
export { graph as b20HistoryReducer } from "./graph-basic/20-history-reducer.js";
export { graph as b21LongContext } from "./graph-basic/21-long-context.js";
export { graph as b22EvaluatorLoop, evaluatorLoopGraph } from "./graph-basic/22-evaluator-loop.js";
export { graph as b23VerificationFlow, verificationFlowGraph } from "./graph-basic/23-verification-flow.js";
export { graph as b24QaPipeline, qaPipelineGraph } from "./graph-basic/24-qa-pipeline.js";
export { graph as b25ApprovalSystem, approvalSystemGraph } from "./graph-basic/25-approval-system.js";

export const graphRegistry = {
  b_01_simple: () => import("./graph-basic/01-simple-graph.js").then((module) => module.graph),
  b_02_llm: () => import("./graph-basic/02-llm-graph.js").then((module) => module.graph),
  b_03_tool_node: () => import("./graph-basic/03-tool-node.js").then((module) => module.graph),
  b_04_subgraph: () => import("./graph-basic/04-subgraph.js").then((module) => module.graph),
  b_05_interrupt: () => import("./graph-basic/05-interrupt.js").then((module) => module.graph),
  b_06_checkpointer: () => import("./graph-basic/06-checkpointer.js").then((module) => module.graph),
  b_07_streaming: () => import("./graph-basic/07-streaming.js").then((module) => module.graph),
  b_08_map_reduce: () => import("./graph-basic/08-map-reduce.js").then((module) => module.graph),
  b_09_structured_output: () => import("./graph-basic/09-structured-output.js").then((module) => module.graph),
  b_10_rag: () => import("./graph-basic/10-rag.js").then((module) => module.graph),
  b_11_1_supervisor: () => import("./graph-basic/11-1-supervisor.js").then((module) => module.graph),
  b_11_2_supervisor: () => import("./graph-basic/11-2-supervisor.js").then((module) => module.graph),
  b_11_3_supervisor_diff_state: () =>
    import("./graph-basic/11-3-supervisor-diff-state.js").then((module) => module.graph),
  b_11_4_supervisor_chat_subgraph: () =>
    import("./graph-basic/11-4-supervisor-chat-subgraph.js").then((module) => module.graph),
  b_12_1_reflection: () => import("./graph-basic/12-1-reflection.js").then((module) => module.graph),
  b_12_2_reflection: () => import("./graph-basic/12-2-reflection.js").then((module) => module.graph),
  b_13_plan_and_execute: () => import("./graph-basic/13-plan-and-execute.js").then((module) => module.graph),
  b_14_parallel_branches: () => import("./graph-basic/14-parallel-branches.js").then((module) => module.graph),
  b_15_long_term_memory: () => import("./graph-basic/15-long-term-memory.js").then((module) => module.graph),
  b_16_command_interrupt: () => import("./graph-basic/16-command-interrupt.js").then((module) => module.graph),
  b_17_configurable: () => import("./graph-basic/17-configurable.js").then((module) => module.graph),
  b_18_custom_streaming: () => import("./graph-basic/18-custom-streaming.js").then((module) => module.graph),
  b_19_retry_policy: () => import("./graph-basic/19-retry-policy.js").then((module) => module.graph),
  b_20_history_reducer: () => import("./graph-basic/20-history-reducer.js").then((module) => module.graph),
  b_21_long_context: () => import("./graph-basic/21-long-context.js").then((module) => module.graph),
  b_22_evaluator_loop: () => import("./graph-basic/22-evaluator-loop.js").then((module) => module.graph),
  b_23_verification_flow: () => import("./graph-basic/23-verification-flow.js").then((module) => module.graph),
  b_24_qa_pipeline: () => import("./graph-basic/24-qa-pipeline.js").then((module) => module.graph),
  b_25_approval_system: () => import("./graph-basic/25-approval-system.js").then((module) => module.graph)
} as const;

export type GraphId = keyof typeof graphRegistry;

export function listGraphIds(): GraphId[] {
  return Object.keys(graphRegistry) as GraphId[];
}

export async function getGraphById(graphId: string) {
  if (!(graphId in graphRegistry)) {
    throw new Error(`Unknown graph id: ${graphId}`);
  }
  return graphRegistry[graphId as GraphId]();
}
