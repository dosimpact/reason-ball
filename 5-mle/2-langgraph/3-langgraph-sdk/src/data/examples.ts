export type ExampleMeta = {
  id: number;
  title: string;
  slug: string;
  group: "MVP" | "Core" | "Generative UI" | "Artifact" | "CopilotKit";
  implemented: boolean;
  planPath: string;
};

const rows: Array<Omit<ExampleMeta, "planPath">> = [
  { id: 1, title: "SDK Connection", slug: "01-sdk-connection", group: "MVP", implemented: true },
  { id: 1.2, title: "SDK Connection React Hook", slug: "01-2-sdk-connection-react-hook", group: "MVP", implemented: true },
  { id: 2, title: "Basic Chat UI", slug: "02-basic-chat-ui", group: "MVP", implemented: true },
  { id: 2.2, title: "Basic Chat React Hook", slug: "02-2-basic-chat-react-hook", group: "MVP", implemented: true },
  { id: 3, title: "Graph Execution Timeline", slug: "03-graph-execution-timeline", group: "MVP", implemented: true },
  { id: 4, title: "Streaming UI", slug: "04-streaming-ui", group: "MVP", implemented: true },
  { id: 4.2, title: "Streaming React Hook", slug: "04-2-streaming-react-hook", group: "MVP", implemented: true },
  { id: 5, title: "Tool Calling / ReAct UI", slug: "05-tool-calling-react-ui", group: "MVP", implemented: true },
  { id: 5.2, title: "Tool Calling React Hook", slug: "05-2-tool-calling-react-hook", group: "MVP", implemented: true },
  { id: 6, title: "Human-in-the-loop / Interrupt UI", slug: "06-human-in-the-loop-interrupt-ui", group: "MVP", implemented: true },
  { id: 6.2, title: "Human-in-the-loop React Hook", slug: "06-2-human-in-the-loop-react-hook", group: "MVP", implemented: true },
  { id: 7, title: "Checkpoint / State History UI", slug: "07-checkpoint-state-history-ui", group: "MVP", implemented: true },
  { id: 8, title: "Time Travel / Replay UI", slug: "08-time-travel-replay-ui", group: "Core", implemented: true },
  { id: 9, title: "Conditional Routing UI", slug: "09-conditional-routing-ui", group: "Core", implemented: true },
  { id: 10, title: "Subgraph / Nested Execution UI", slug: "10-subgraph-nested-execution-ui", group: "Core", implemented: true },
  { id: 11, title: "Parallel / Map-Reduce UI", slug: "11-parallel-map-reduce-ui", group: "Core", implemented: true },
  { id: 12, title: "Structured Output UI", slug: "12-structured-output-ui", group: "Core", implemented: true },
  { id: 13, title: "RAG / QA UI", slug: "13-rag-qa-ui", group: "Core", implemented: true },
  { id: 14, title: "Plan-and-Execute UI", slug: "14-plan-and-execute-ui", group: "Core", implemented: true },
  { id: 15, title: "Reflection / Evaluator Loop UI", slug: "15-reflection-evaluator-loop-ui", group: "Core", implemented: true },
  { id: 16, title: "Long-term Memory UI", slug: "16-long-term-memory-ui", group: "Core", implemented: true },
  { id: 17, title: "Configurable Assistant UI", slug: "17-configurable-assistant-ui", group: "Core", implemented: true },
  { id: 18, title: "Retry / Error / Degradation UI", slug: "18-retry-error-degradation-ui", group: "Core", implemented: true },
  { id: 19, title: "Long Context UI", slug: "19-long-context-ui", group: "Core", implemented: true },
  { id: 20, title: "Observability UI", slug: "20-observability-ui", group: "Core", implemented: true },
  { id: 21, title: "Intent Feedback with Generative UI", slug: "21-intent-feedback-generative-ui", group: "Generative UI", implemented: true },
  { id: 22, title: "Custom Event Renderer", slug: "22-custom-event-renderer", group: "Generative UI", implemented: true },
  { id: 23, title: "Thinking Renderer", slug: "23-thinking-renderer", group: "Generative UI", implemented: true },
  { id: 24, title: "Chat Citation Renderer", slug: "24-chat-citation-renderer", group: "Generative UI", implemented: true },
  { id: 25, title: "push_ui_message Example", slug: "25-push-ui-message", group: "Generative UI", implemented: true },
  { id: 26, title: "Multimodal Input: Image", slug: "26-multimodal-image-input", group: "Generative UI", implemented: true },
  { id: 27, title: "Multimodal Input: Voice", slug: "27-multimodal-voice-input", group: "Generative UI", implemented: true },
  { id: 28, title: "Multimodal Output: Voice", slug: "28-multimodal-voice-output", group: "Generative UI", implemented: true },
  { id: 29, title: "Chat + Code Editor", slug: "29-chat-code-editor", group: "Artifact", implemented: true },
  { id: 30, title: "Chat + Document Artifact", slug: "30-chat-document-artifact", group: "Artifact", implemented: true },
  { id: 31, title: "Chat + Plan Board", slug: "31-chat-plan-board", group: "Artifact", implemented: true },
  { id: 32, title: "Chat + Graph Execution Canvas", slug: "32-chat-graph-execution-canvas", group: "Artifact", implemented: true },
  { id: 33, title: "Chat + UI Preview", slug: "33-chat-ui-preview", group: "Artifact", implemented: true },
  { id: 34, title: "Chat + Data Analysis Canvas", slug: "34-chat-data-analysis-canvas", group: "Artifact", implemented: true },
  { id: 35, title: "Agentic Chat AG-UI", slug: "35-agentic-chat-ag-ui", group: "CopilotKit", implemented: true },
  { id: 36, title: "Backend Tool Rendering AG-UI", slug: "36-backend-tool-rendering-ag-ui", group: "CopilotKit", implemented: true },
  { id: 37, title: "Human in the Loop AG-UI", slug: "37-human-in-the-loop-ag-ui", group: "CopilotKit", implemented: true },
  { id: 38, title: "Agentic Generative UI AG-UI", slug: "38-agentic-generative-ui-ag-ui", group: "CopilotKit", implemented: true },
  { id: 39, title: "Tool Based Generative UI AG-UI", slug: "39-tool-based-generative-ui-ag-ui", group: "CopilotKit", implemented: true },
  { id: 40, title: "Shared State Between Agent and UI AG-UI", slug: "40-shared-state-agent-ui-ag-ui", group: "CopilotKit", implemented: true },
  { id: 41, title: "Predictive State Updates AG-UI", slug: "41-predictive-state-updates-ag-ui", group: "CopilotKit", implemented: true },
  { id: 42, title: "Agentic Chat Reasoning AG-UI", slug: "42-agentic-chat-reasoning-ag-ui", group: "CopilotKit", implemented: true },
  { id: 43, title: "Agentic Chat Multimodal AG-UI", slug: "43-agentic-chat-multimodal-ag-ui", group: "CopilotKit", implemented: true },
  { id: 44, title: "Subgraphs AG-UI", slug: "44-subgraphs-ag-ui", group: "CopilotKit", implemented: true },
  { id: 45, title: "A2UI Fixed Schema AG-UI", slug: "45-a2ui-fixed-schema-ag-ui", group: "CopilotKit", implemented: true },
  { id: 46, title: "A2UI Dynamic Schema AG-UI", slug: "46-a2ui-dynamic-schema-ag-ui", group: "CopilotKit", implemented: true },
  { id: 47, title: "A2UI Advanced AG-UI", slug: "47-a2ui-advanced-ag-ui", group: "CopilotKit", implemented: true },
  { id: 48, title: "Todo List Middleware", slug: "48-todo-list-middleware", group: "Core", implemented: true },
  { id: 49, title: "Loop Engineering Harness", slug: "49-loop-engineering-harness-ui", group: "Core", implemented: true },
];

export const examples: ExampleMeta[] = rows.map((example) => ({
  ...example,
  planPath: `plan/${example.slug}.md`,
}));
