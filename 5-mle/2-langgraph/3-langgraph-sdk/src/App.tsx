import { BookOpen, CheckCircle2, FlaskConical, ListTree } from "lucide-react";
import { useMemo, useState } from "react";
import { SdkConnectionExample } from "./examples/01-sdk-connection/SdkConnectionExample";
import { BasicChatExample } from "./examples/02-basic-chat-ui/BasicChatExample";
import { GraphExecutionTimelineExample } from "./examples/03-graph-execution-timeline/GraphExecutionTimelineExample";
import { StreamingUiExample } from "./examples/04-streaming-ui/StreamingUiExample";
import { ToolCallingReactExample } from "./examples/05-tool-calling-react-ui/ToolCallingReactExample";
import { HumanInTheLoopInterruptExample } from "./examples/06-human-in-the-loop-interrupt-ui/HumanInTheLoopInterruptExample";
import { CheckpointStateHistoryExample } from "./examples/07-checkpoint-state-history-ui/CheckpointStateHistoryExample";
import { TimeTravelReplayExample } from "./examples/08-time-travel-replay-ui/TimeTravelReplayExample";
import { ConditionalRoutingExample } from "./examples/09-conditional-routing-ui/ConditionalRoutingExample";
import { SubgraphNestedExecutionExample } from "./examples/10-subgraph-nested-execution-ui/SubgraphNestedExecutionExample";
import { ParallelMapReduceExample } from "./examples/11-parallel-map-reduce-ui/ParallelMapReduceExample";
import { StructuredOutputExample } from "./examples/12-structured-output-ui/StructuredOutputExample";
import { RagQaExample } from "./examples/13-rag-qa-ui/RagQaExample";
import { PlanAndExecuteExample } from "./examples/14-plan-and-execute-ui/PlanAndExecuteExample";
import { ReflectionEvaluatorLoopExample } from "./examples/15-reflection-evaluator-loop-ui/ReflectionEvaluatorLoopExample";
import { LongTermMemoryExample } from "./examples/16-long-term-memory-ui/LongTermMemoryExample";
import { ConfigurableAssistantExample } from "./examples/17-configurable-assistant-ui/ConfigurableAssistantExample";
import { RetryErrorDegradationExample } from "./examples/18-retry-error-degradation-ui/RetryErrorDegradationExample";
import { LongContextExample } from "./examples/19-long-context-ui/LongContextExample";
import { ObservabilityExample } from "./examples/20-observability-ui/ObservabilityExample";
import { IntentFeedbackGenerativeExample } from "./examples/21-intent-feedback-generative-ui/IntentFeedbackGenerativeExample";
import { CustomEventRendererExample } from "./examples/22-custom-event-renderer/CustomEventRendererExample";
import { ThinkingRendererExample } from "./examples/23-thinking-renderer/ThinkingRendererExample";
import { ChatCitationRendererExample } from "./examples/24-chat-citation-renderer/ChatCitationRendererExample";
import { PushUiMessageExample } from "./examples/25-push-ui-message/PushUiMessageExample";
import { MultimodalImageInputExample } from "./examples/26-multimodal-image-input/MultimodalImageInputExample";
import { MultimodalVoiceInputExample } from "./examples/27-multimodal-voice-input/MultimodalVoiceInputExample";
import { MultimodalVoiceOutputExample } from "./examples/28-multimodal-voice-output/MultimodalVoiceOutputExample";
import { ChatCodeEditorExample } from "./examples/29-chat-code-editor/ChatCodeEditorExample";
import { ChatDocumentArtifactExample } from "./examples/30-chat-document-artifact/ChatDocumentArtifactExample";
import { ChatPlanBoardExample } from "./examples/31-chat-plan-board/ChatPlanBoardExample";
import { ChatGraphExecutionCanvasExample } from "./examples/32-chat-graph-execution-canvas/ChatGraphExecutionCanvasExample";
import { ChatUiPreviewExample } from "./examples/33-chat-ui-preview/ChatUiPreviewExample";
import { ChatDataAnalysisCanvasExample } from "./examples/34-chat-data-analysis-canvas/ChatDataAnalysisCanvasExample";
import { examples } from "./data/examples";

export default function App() {
  const [activeSlug, setActiveSlug] = useState("01-sdk-connection");
  const activeExample = useMemo(
    () => examples.find((example) => example.slug === activeSlug) ?? examples[0],
    [activeSlug],
  );

  return (
    <div className="app-shell">
      <aside className="sidebar" aria-label="Example navigation">
        <div className="brand">
          <FlaskConical aria-hidden="true" size={22} />
          <div>
            <h1>LangGraph SDK</h1>
            <p>Graph + React examples</p>
          </div>
        </div>

        <nav className="example-nav">
          {examples.map((example) => (
            <button
              key={example.slug}
              type="button"
              className={example.slug === activeSlug ? "nav-item active" : "nav-item"}
              onClick={() => setActiveSlug(example.slug)}
            >
              <span className="nav-index">{String(example.id).padStart(2, "0")}</span>
              <span className="nav-label">{example.title}</span>
              {example.implemented ? (
                <CheckCircle2 aria-label="implemented" size={16} />
              ) : (
                <BookOpen aria-label="planned" size={16} />
              )}
            </button>
          ))}
        </nav>
      </aside>

      <main className="workspace">
        <header className="workspace-header">
          <div>
            <p className="eyebrow">{activeExample.group}</p>
            <h2>{activeExample.title}</h2>
          </div>
          <div className="plan-pill">
            <ListTree aria-hidden="true" size={16} />
            {activeExample.planPath}
          </div>
        </header>

        {activeExample.slug === "01-sdk-connection" ? <SdkConnectionExample /> : null}
        {activeExample.slug === "02-basic-chat-ui" ? <BasicChatExample /> : null}
        {activeExample.slug === "03-graph-execution-timeline" ? (
          <GraphExecutionTimelineExample />
        ) : null}
        {activeExample.slug === "04-streaming-ui" ? <StreamingUiExample /> : null}
        {activeExample.slug === "05-tool-calling-react-ui" ? <ToolCallingReactExample /> : null}
        {activeExample.slug === "06-human-in-the-loop-interrupt-ui" ? (
          <HumanInTheLoopInterruptExample />
        ) : null}
        {activeExample.slug === "07-checkpoint-state-history-ui" ? (
          <CheckpointStateHistoryExample />
        ) : null}
        {activeExample.slug === "08-time-travel-replay-ui" ? <TimeTravelReplayExample /> : null}
        {activeExample.slug === "09-conditional-routing-ui" ? (
          <ConditionalRoutingExample />
        ) : null}
        {activeExample.slug === "10-subgraph-nested-execution-ui" ? (
          <SubgraphNestedExecutionExample />
        ) : null}
        {activeExample.slug === "11-parallel-map-reduce-ui" ? (
          <ParallelMapReduceExample />
        ) : null}
        {activeExample.slug === "12-structured-output-ui" ? <StructuredOutputExample /> : null}
        {activeExample.slug === "13-rag-qa-ui" ? <RagQaExample /> : null}
        {activeExample.slug === "14-plan-and-execute-ui" ? <PlanAndExecuteExample /> : null}
        {activeExample.slug === "15-reflection-evaluator-loop-ui" ? (
          <ReflectionEvaluatorLoopExample />
        ) : null}
        {activeExample.slug === "16-long-term-memory-ui" ? <LongTermMemoryExample /> : null}
        {activeExample.slug === "17-configurable-assistant-ui" ? (
          <ConfigurableAssistantExample />
        ) : null}
        {activeExample.slug === "18-retry-error-degradation-ui" ? (
          <RetryErrorDegradationExample />
        ) : null}
        {activeExample.slug === "19-long-context-ui" ? <LongContextExample /> : null}
        {activeExample.slug === "20-observability-ui" ? <ObservabilityExample /> : null}
        {activeExample.slug === "21-intent-feedback-generative-ui" ? (
          <IntentFeedbackGenerativeExample />
        ) : null}
        {activeExample.slug === "22-custom-event-renderer" ? <CustomEventRendererExample /> : null}
        {activeExample.slug === "23-thinking-renderer" ? <ThinkingRendererExample /> : null}
        {activeExample.slug === "24-chat-citation-renderer" ? <ChatCitationRendererExample /> : null}
        {activeExample.slug === "25-push-ui-message" ? <PushUiMessageExample /> : null}
        {activeExample.slug === "26-multimodal-image-input" ? <MultimodalImageInputExample /> : null}
        {activeExample.slug === "27-multimodal-voice-input" ? <MultimodalVoiceInputExample /> : null}
        {activeExample.slug === "28-multimodal-voice-output" ? <MultimodalVoiceOutputExample /> : null}
        {activeExample.slug === "29-chat-code-editor" ? <ChatCodeEditorExample /> : null}
        {activeExample.slug === "30-chat-document-artifact" ? <ChatDocumentArtifactExample /> : null}
        {activeExample.slug === "31-chat-plan-board" ? <ChatPlanBoardExample /> : null}
        {activeExample.slug === "32-chat-graph-execution-canvas" ? (
          <ChatGraphExecutionCanvasExample />
        ) : null}
        {activeExample.slug === "33-chat-ui-preview" ? <ChatUiPreviewExample /> : null}
        {activeExample.slug === "34-chat-data-analysis-canvas" ? (
          <ChatDataAnalysisCanvasExample />
        ) : null}
        {!activeExample.implemented ? (
          <section className="empty-state">
            <h3>Planned Example</h3>
            <p>
              The design document exists at <code>{activeExample.planPath}</code>. Implementation
              will proceed in priority order after the MVP base shell is verified.
            </p>
          </section>
        ) : null}
      </main>
    </div>
  );
}
