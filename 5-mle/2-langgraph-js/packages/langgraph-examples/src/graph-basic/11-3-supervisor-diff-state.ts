import { AIMessage } from "@langchain/core/messages";
import type { BaseMessage } from "@langchain/core/messages";
import { Annotation, END, START, StateGraph, messagesStateReducer } from "@langchain/langgraph";

const MAX_TOP_ITERS = 6;
const MAX_TEAM_ITERS = 4;

function replace<T>(_current: T, value: T): T {
  return value;
}

const ParentState = Annotation.Root({
  messages: Annotation<BaseMessage[]>({
    reducer: messagesStateReducer,
    default: () => []
  }),
  nextTeam: Annotation<string>({
    reducer: replace,
    default: () => ""
  }),
  topIters: Annotation<number>({
    reducer: replace,
    default: () => 0
  }),
  completedTeams: Annotation<string[]>({
    reducer: replace,
    default: () => []
  })
});

const DataTeamState = Annotation.Root({
  messages: Annotation<BaseMessage[]>({
    reducer: messagesStateReducer,
    default: () => []
  }),
  nextWorker: Annotation<string>({
    reducer: replace,
    default: () => ""
  }),
  teamIters: Annotation<number>({
    reducer: replace,
    default: () => 0
  }),
  completedWorkers: Annotation<string[]>({
    reducer: replace,
    default: () => []
  }),
  sqlResult: Annotation<string>({
    reducer: replace,
    default: () => ""
  }),
  pandasResult: Annotation<string>({
    reducer: replace,
    default: () => ""
  }),
  chartSpec: Annotation<string>({
    reducer: replace,
    default: () => ""
  })
});

const WritingTeamState = Annotation.Root({
  messages: Annotation<BaseMessage[]>({
    reducer: messagesStateReducer,
    default: () => []
  }),
  nextWorker: Annotation<string>({
    reducer: replace,
    default: () => ""
  }),
  teamIters: Annotation<number>({
    reducer: replace,
    default: () => 0
  }),
  completedWorkers: Annotation<string[]>({
    reducer: replace,
    default: () => []
  }),
  draft: Annotation<string>({
    reducer: replace,
    default: () => ""
  }),
  revisionCount: Annotation<number>({
    reducer: replace,
    default: () => 0
  })
});

type ParentStateValue = typeof ParentState.State;
type DataTeamStateValue = typeof DataTeamState.State;
type WritingTeamStateValue = typeof WritingTeamState.State;

function textOf(message: BaseMessage | undefined): string {
  return message?.text || String(message?.content ?? "");
}

function latestUserText(state: ParentStateValue): string {
  return textOf([...state.messages].reverse().find((message) => message.type === "human"));
}

function needsData(input: string): boolean {
  return /\b(data|sql|pandas|chart|revenue|sales|quarter|analysis)\b/i.test(input);
}

function topSupervisor(state: ParentStateValue) {
  const topIters = state.topIters + 1;
  const input = latestUserText(state);
  let nextTeam = "FINISH";

  if (topIters > MAX_TOP_ITERS || state.completedTeams.includes("writing")) {
    nextTeam = "FINISH";
  } else if (needsData(input) && !state.completedTeams.includes("data")) {
    nextTeam = "data";
  } else if (!state.completedTeams.includes("writing")) {
    nextTeam = "writing";
  }

  return {
    nextTeam,
    topIters,
    messages: [
      new AIMessage({
        content: `[top_supervisor -> ${nextTeam}] parent-only route`,
        name: "top_supervisor"
      })
    ]
  };
}

function topRoute(state: ParentStateValue): "data_team" | "writing_team" | "__end__" {
  if (state.nextTeam === "data") {
    return "data_team";
  }
  if (state.nextTeam === "writing") {
    return "writing_team";
  }
  return "__end__";
}

function dataSupervisor(state: DataTeamStateValue) {
  const teamIters = state.teamIters + 1;
  const order = ["sql_runner", "pandas_runner", "chart_maker"];
  const nextWorker =
    teamIters > MAX_TEAM_ITERS ? "DONE" : order.find((worker) => !state.completedWorkers.includes(worker)) ?? "DONE";
  return {
    nextWorker,
    teamIters,
    messages: [
      new AIMessage({
        content: `[data_supervisor -> ${nextWorker}] isolated data state`,
        name: "data_supervisor"
      })
    ]
  };
}

function sqlRunner(state: DataTeamStateValue) {
  const sqlResult = "Q4 sales 12.4M, Q3 sales 10.1M, growth 22.7%.";
  return {
    sqlResult,
    completedWorkers: [...state.completedWorkers, "sql_runner"],
    messages: [new AIMessage({ content: `[sql_runner] ${sqlResult}`, name: "sql_runner" })]
  };
}

function pandasRunner(state: DataTeamStateValue) {
  const pandasResult = `region groupby on ${state.sqlResult || "missing SQL"} -> metro 7.2M, south 3.1M.`;
  return {
    pandasResult,
    completedWorkers: [...state.completedWorkers, "pandas_runner"],
    messages: [new AIMessage({ content: `[pandas_runner] ${pandasResult}`, name: "pandas_runner" })]
  };
}

function chartMaker(state: DataTeamStateValue) {
  const chartSpec = `bar chart by quarter using ${state.pandasResult || "transformed revenue"}`;
  return {
    chartSpec,
    completedWorkers: [...state.completedWorkers, "chart_maker"],
    messages: [new AIMessage({ content: `[chart_maker] ${chartSpec}`, name: "chart_maker" })]
  };
}

function dataDone() {
  return {
    messages: [new AIMessage({ content: "[data_team] DONE", name: "data_team" })]
  };
}

function writingSupervisor(state: WritingTeamStateValue) {
  const teamIters = state.teamIters + 1;
  const order = ["drafter", "editor"];
  const nextWorker =
    teamIters > MAX_TEAM_ITERS ? "DONE" : order.find((worker) => !state.completedWorkers.includes(worker)) ?? "DONE";
  return {
    nextWorker,
    teamIters,
    messages: [
      new AIMessage({
        content: `[writing_supervisor -> ${nextWorker}] isolated writing state`,
        name: "writing_supervisor"
      })
    ]
  };
}

function drafter(state: WritingTeamStateValue) {
  const evidence = state.messages
    .filter((message) => message.type === "ai" && message.name?.includes("runner"))
    .map((message) => textOf(message))
    .join(" ");
  const draft = `Executive draft: ${evidence || "analysis complete"} The result is ready for review.`;
  return {
    draft,
    revisionCount: 0,
    completedWorkers: [...state.completedWorkers, "drafter"],
    messages: [new AIMessage({ content: `[drafter] ${draft}`, name: "drafter" })]
  };
}

function editor(state: WritingTeamStateValue) {
  const revisionCount = state.revisionCount + 1;
  const draft = `${state.draft || "Executive summary"} Polished revision ${revisionCount}: concise and stakeholder ready.`;
  return {
    draft,
    revisionCount,
    completedWorkers: [...state.completedWorkers, "editor"],
    messages: [new AIMessage({ content: `[editor rev=${revisionCount}] ${draft}`, name: "editor" })]
  };
}

function writingDone() {
  return {
    messages: [new AIMessage({ content: "[writing_team] DONE", name: "writing_team" })]
  };
}

function teamRoute(state: DataTeamStateValue | WritingTeamStateValue): string {
  return state.nextWorker === "DONE" ? "team_done" : state.nextWorker;
}

function buildDataTeamSubgraph() {
  return new StateGraph(DataTeamState)
    .addNode("data_supervisor", dataSupervisor)
    .addNode("sql_runner", sqlRunner)
    .addNode("pandas_runner", pandasRunner)
    .addNode("chart_maker", chartMaker)
    .addNode("team_done", dataDone)
    .addEdge(START, "data_supervisor")
    .addConditionalEdges("data_supervisor", teamRoute, {
      sql_runner: "sql_runner",
      pandas_runner: "pandas_runner",
      chart_maker: "chart_maker",
      team_done: "team_done"
    })
    .addEdge("sql_runner", "data_supervisor")
    .addEdge("pandas_runner", "data_supervisor")
    .addEdge("chart_maker", "data_supervisor")
    .addEdge("team_done", END)
    .compile();
}

function buildWritingTeamSubgraph() {
  return new StateGraph(WritingTeamState)
    .addNode("writing_supervisor", writingSupervisor)
    .addNode("drafter", drafter)
    .addNode("editor", editor)
    .addNode("team_done", writingDone)
    .addEdge(START, "writing_supervisor")
    .addConditionalEdges("writing_supervisor", teamRoute, {
      drafter: "drafter",
      editor: "editor",
      team_done: "team_done"
    })
    .addEdge("drafter", "writing_supervisor")
    .addEdge("editor", "writing_supervisor")
    .addEdge("team_done", END)
    .compile();
}

function markDataDone(state: ParentStateValue) {
  return { completedTeams: [...state.completedTeams, "data"] };
}

function markWritingDone(state: ParentStateValue) {
  return { completedTeams: [...state.completedTeams, "writing"] };
}

export function buildGraph() {
  return new StateGraph(ParentState)
    .addNode("top_supervisor", topSupervisor)
    .addNode("data_team", buildDataTeamSubgraph())
    .addNode("mark_data_done", markDataDone)
    .addNode("writing_team", buildWritingTeamSubgraph())
    .addNode("mark_writing_done", markWritingDone)
    .addEdge(START, "top_supervisor")
    .addConditionalEdges("top_supervisor", topRoute, {
      data_team: "data_team",
      writing_team: "writing_team",
      __end__: END
    })
    .addEdge("data_team", "mark_data_done")
    .addEdge("mark_data_done", "top_supervisor")
    .addEdge("writing_team", "mark_writing_done")
    .addEdge("mark_writing_done", "top_supervisor")
    .compile();
}

export const graph = buildGraph();
export const diffStateSupervisorGraph = graph;
