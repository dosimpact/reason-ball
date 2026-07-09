import { AIMessage } from "@langchain/core/messages";
import type { BaseMessage } from "@langchain/core/messages";
import { Annotation, END, START, StateGraph, messagesStateReducer } from "@langchain/langgraph";
import { appendStep } from "./shared.js";

const MAX_TOP_ITERS = 6;
const MAX_TEAM_ITERS = 4;

function replace<T>(_current: T, value: T): T {
  return value;
}

const HierarchicalState = Annotation.Root({
  messages: Annotation<BaseMessage[]>({
    reducer: messagesStateReducer,
    default: () => []
  }),
  nextTeam: Annotation<string>({
    reducer: replace,
    default: () => ""
  }),
  nextWorker: Annotation<string>({
    reducer: replace,
    default: () => ""
  }),
  topIters: Annotation<number>({
    reducer: replace,
    default: () => 0
  }),
  teamIters: Annotation<number>({
    reducer: replace,
    default: () => 0
  }),
  completedTeams: Annotation<string[]>({
    reducer: replace,
    default: () => []
  }),
  completedWorkers: Annotation<string[]>({
    reducer: replace,
    default: () => []
  }),
  steps: Annotation<string[]>({
    reducer: replace,
    default: () => []
  })
});

type HierarchicalStateValue = typeof HierarchicalState.State;

function textOf(message: BaseMessage | undefined): string {
  return message?.text || String(message?.content ?? "");
}

function latestUserText(state: HierarchicalStateValue): string {
  return textOf([...state.messages].reverse().find((message) => message.type === "human"));
}

function hasMessageFrom(state: HierarchicalStateValue, name: string): boolean {
  return state.messages.some((message) => message.name === name);
}

function needsData(input: string): boolean {
  return /\b(data|sql|pandas|chart|revenue|sales|quarter|analysis)\b/i.test(input);
}

function needsSearch(input: string): boolean {
  return /\b(search|lookup|what|explain|define|langgraph|bedrock|fastapi)\b/i.test(input);
}

function needsWriting(input: string): boolean {
  return /\b(write|draft|edit|summarize|summary|report|memo|paragraph|executive)\b/i.test(input);
}

function topSupervisor(state: HierarchicalStateValue) {
  const topIters = state.topIters + 1;
  const input = latestUserText(state);
  let nextTeam = "FINISH";

  if (topIters > MAX_TOP_ITERS || hasMessageFrom(state, "summarizer")) {
    nextTeam = "FINISH";
  } else if (needsData(input) && !state.completedTeams.includes("data")) {
    nextTeam = "data";
  } else if (needsSearch(input) && !state.completedTeams.includes("search")) {
    nextTeam = "search";
  } else if ((needsWriting(input) || state.completedTeams.length > 0) && !state.completedTeams.includes("writing")) {
    nextTeam = "writing";
  }

  return {
    nextTeam,
    nextWorker: "",
    topIters,
    teamIters: 0,
    completedWorkers: [],
    messages: [
      new AIMessage({
        content: `[top_supervisor -> ${nextTeam}] deterministic team route`,
        name: "top_supervisor"
      })
    ],
    steps: appendStep(state, `top:${nextTeam}`)
  };
}

function makeTeamSupervisor(teamName: string, workers: string[]) {
  return (state: HierarchicalStateValue) => {
    const teamIters = state.teamIters + 1;
    const nextWorker =
      teamIters > MAX_TEAM_ITERS ? "DONE" : workers.find((worker) => !state.completedWorkers.includes(worker)) ?? "DONE";

    return {
      nextWorker,
      teamIters,
      messages: [
        new AIMessage({
          content: `[${teamName}_supervisor -> ${nextWorker}] deterministic worker route`,
          name: `${teamName}_supervisor`
        })
      ],
      steps: appendStep(state, `${teamName}:${nextWorker}`)
    };
  };
}

function makeStubWorker(name: string, output: string) {
  return (state: HierarchicalStateValue) => ({
    completedWorkers: [...state.completedWorkers, name],
    messages: [
      new AIMessage({
        content: `[${name}] ${output}`,
        name
      })
    ],
    steps: appendStep(state, name)
  });
}

const DATA_WORKERS = ["sql_runner", "pandas_runner", "chart_maker"];
const SEARCH_WORKERS = ["web_search", "kb_search", "vector_search"];
const WRITING_WORKERS = ["drafter", "editor", "summarizer"];

const dataWorkers = {
  sql_runner: makeStubWorker("sql_runner", "Mock SQL result: Q4 sales 12.4M, Q3 sales 10.1M, quarter over quarter growth 22.7%."),
  pandas_runner: makeStubWorker("pandas_runner", "Mock dataframe transform: region totals show metro 7.2M and south 3.1M."),
  chart_maker: makeStubWorker("chart_maker", "Mock chart spec: bar chart by quarter with growth annotation.")
};

const searchWorkers = {
  web_search: makeStubWorker("web_search", "Mock web result: public sources describe LangGraph as a stateful workflow graph library."),
  kb_search: makeStubWorker("kb_search", "Mock KB result: internal notes recommend checkpoints for resumable agent runs."),
  vector_search: makeStubWorker("vector_search", "Mock vector result: similar documents discuss cycles, routing, and tool execution.")
};

const writingWorkers = {
  drafter: makeStubWorker("drafter", "Draft: sales grew strongly and the workflow findings are ready for review."),
  editor: makeStubWorker("editor", "Edited: the summary is concise, ordered, and suitable for stakeholders."),
  summarizer: makeStubWorker("summarizer", "Final summary: Q4 sales rose 22.7%, led by metro growth, with supporting workflow context.")
};

function finishTeam(teamName: string) {
  return (state: HierarchicalStateValue) => ({
    completedTeams: [...state.completedTeams, teamName],
    completedWorkers: [],
    messages: [
      new AIMessage({
        content: `[${teamName}_team] DONE`,
        name: `${teamName}_team`
      })
    ],
    steps: appendStep(state, `${teamName}:done`)
  });
}

function teamRoute(state: HierarchicalStateValue): string {
  return state.nextWorker === "DONE" ? "team_done" : state.nextWorker;
}

function buildTeamSubgraph(teamName: string, workerNames: string[], workers: Record<string, (state: HierarchicalStateValue) => object>) {
  const builder = new StateGraph(HierarchicalState)
    .addNode(`${teamName}_supervisor`, makeTeamSupervisor(teamName, workerNames))
    .addNode("team_done", finishTeam(teamName))
    .addEdge(START, `${teamName}_supervisor`)
    .addConditionalEdges(`${teamName}_supervisor`, teamRoute, {
      ...Object.fromEntries(workerNames.map((worker) => [worker, worker])),
      team_done: "team_done"
    })
    .addEdge("team_done", END);

  for (const [name, worker] of Object.entries(workers)) {
    builder.addNode(name, worker).addEdge(name, `${teamName}_supervisor`);
  }

  return builder.compile();
}

const dataTeam = buildTeamSubgraph("data", DATA_WORKERS, dataWorkers);
const searchTeam = buildTeamSubgraph("search", SEARCH_WORKERS, searchWorkers);
const writingTeam = buildTeamSubgraph("writing", WRITING_WORKERS, writingWorkers);

function topRoute(state: HierarchicalStateValue): string {
  return state.nextTeam === "FINISH" ? "__end__" : `${state.nextTeam}_team`;
}

export function buildGraph() {
  return new StateGraph(HierarchicalState)
    .addNode("top_supervisor", topSupervisor)
    .addNode("data_team", dataTeam)
    .addNode("search_team", searchTeam)
    .addNode("writing_team", writingTeam)
    .addEdge(START, "top_supervisor")
    .addConditionalEdges("top_supervisor", topRoute, {
      data_team: "data_team",
      search_team: "search_team",
      writing_team: "writing_team",
      __end__: END
    })
    .addEdge("data_team", "top_supervisor")
    .addEdge("search_team", "top_supervisor")
    .addEdge("writing_team", "top_supervisor")
    .compile();
}

export const graph = buildGraph();
export const hierarchicalSupervisorGraph = graph;
