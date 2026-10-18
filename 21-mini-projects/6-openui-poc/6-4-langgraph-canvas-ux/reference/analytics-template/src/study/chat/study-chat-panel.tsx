"use client";

import { applyCanvasPatch, buildCanvasSnapshot } from "@/study/bridge/canvas-bridge";
import { generateId, useStudyCanvasStore } from "@/study/canvas/canvas-storage";
import {
  getStudyComponentLabel,
  renderStudyComponent,
  type StudyComponentArtifact,
} from "@/study/renderers/component-registry";
import {
  streamLangGraphChat,
  type ChatHistoryMessage,
  type ToolCallEvent,
} from "@/study/chat/langgraph-client";
import { cn } from "@/study/utils";
import { BotIcon, PlusIcon, SendIcon, WrenchIcon } from "lucide-react";
import * as React from "react";

type StudyChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  artifacts: StudyComponentArtifact[];
  toolCalls: ToolCallEvent[];
  patchStatus?: "applied" | "rejected";
  error?: string;
};

function cloneArtifactProps<T>(props: T): T {
  return structuredClone(props);
}

function getArtifactTitle(artifact: StudyComponentArtifact) {
  return "title" in artifact.props && typeof artifact.props.title === "string"
    ? artifact.props.title
    : getStudyComponentLabel(artifact.component);
}

function updateMessage(
  messages: StudyChatMessage[],
  id: string,
  updater: (message: StudyChatMessage) => StudyChatMessage,
) {
  return messages.map((message) => (message.id === id ? updater(message) : message));
}

function ChatArtifactPreview({ artifact }: { artifact: StudyComponentArtifact }) {
  const { activeCanvasId, addComponent, createCanvas } = useStudyCanvasStore();
  const componentLabel = getStudyComponentLabel(artifact.component);

  const addToDashboard = React.useCallback(() => {
    let targetCanvasId = activeCanvasId;
    if (!targetCanvasId) {
      const newCanvas = createCanvas();
      targetCanvasId = newCanvas.id;
    }

    addComponent(targetCanvasId, {
      ...cloneArtifactProps(artifact.props),
      componentId: generateId(),
      _inCanvas: true,
      _componentType: artifact.component,
    });
  }, [activeCanvasId, addComponent, artifact, createCanvas]);

  const handleDragStart = React.useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      const dragData = {
        component: artifact.component,
        props: {
          ...cloneArtifactProps(artifact.props),
          componentId: generateId(),
          _inCanvas: false,
          _componentType: artifact.component,
        },
      };
      e.dataTransfer.setData("application/json", JSON.stringify(dragData));
      e.dataTransfer.effectAllowed = "copy";
    },
    [artifact],
  );

  return (
    <div
      className="overflow-hidden rounded-md border border-border bg-background"
      data-testid="artifact-preview"
      data-component-type={artifact.component}
      data-artifact-title={getArtifactTitle(artifact)}
    >
      <div
        draggable
        onDragStart={handleDragStart}
        className="cursor-grab active:cursor-grabbing"
        data-testid={`artifact-preview-drag-${artifact.component.toLowerCase()}`}
      >
        {renderStudyComponent(artifact.component, artifact.props)}
      </div>
      <div className="flex justify-end border-t border-border p-2">
        <button
          onClick={addToDashboard}
          className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted"
          title={`Add ${componentLabel} to dashboard`}
          data-testid={`artifact-preview-add-${artifact.component.toLowerCase()}`}
        >
          <PlusIcon className="h-4 w-4" />
          <span>Add</span>
        </button>
      </div>
    </div>
  );
}

function StudyChatMessageView({ message }: { message: StudyChatMessage }) {
  const isUser = message.role === "user";

  return (
    <article
      className={cn("flex", isUser ? "justify-end" : "justify-start")}
      data-testid="study-chat-message"
      data-role={message.role}
    >
      <div
        className={cn(
          "max-w-[92%] space-y-3 rounded-md border px-3 py-2 text-sm",
          isUser
            ? "border-primary/30 bg-primary/10"
            : "border-border bg-background",
        )}
      >
        {!isUser && (
          <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
            <BotIcon className="h-3.5 w-3.5" />
            <span>LangGraph</span>
          </div>
        )}

        {message.content && (
          <p className="whitespace-pre-wrap leading-6">{message.content}</p>
        )}

        {message.toolCalls.length > 0 && (
          <div className="space-y-1 rounded-md bg-muted/40 p-2 text-xs text-muted-foreground">
            {message.toolCalls.map((toolCall, index) => (
              <div
                key={`${toolCall.name}-${index}`}
                className="flex items-center gap-1.5"
                data-testid="study-chat-tool-call"
              >
                <WrenchIcon className="h-3.5 w-3.5" />
                <span>{toolCall.name}</span>
              </div>
            ))}
          </div>
        )}

        {message.artifacts.length > 0 && (
          <div className="grid gap-3" data-testid="study-chat-artifacts">
            {message.artifacts.map((artifact, index) => (
              <ChatArtifactPreview
                key={`${message.id}-${artifact.component}-${index}`}
                artifact={artifact}
              />
            ))}
          </div>
        )}

        {message.patchStatus && (
          <p
            className={cn(
              "rounded-md px-2 py-1 text-xs",
              message.patchStatus === "applied"
                ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                : "bg-destructive/10 text-destructive",
            )}
            data-testid="study-chat-patch-status"
          >
            Canvas patch {message.patchStatus}
          </p>
        )}

        {message.error && (
          <p
            className="rounded-md bg-destructive/10 px-2 py-1 text-xs text-destructive"
            data-testid="study-chat-error"
          >
            {message.error}
          </p>
        )}
      </div>
    </article>
  );
}

export function StudyChatPanel() {
  const [messages, setMessages] = React.useState<StudyChatMessage[]>([]);
  const [input, setInput] = React.useState("");
  const [isStreaming, setIsStreaming] = React.useState(false);
  const abortControllerRef = React.useRef<AbortController | null>(null);
  const scrollRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, isStreaming]);

  const submitMessage = React.useCallback(async () => {
    const trimmedInput = input.trim();
    if (!trimmedInput || isStreaming) return;

    const userMessage: StudyChatMessage = {
      id: generateId(),
      role: "user",
      content: trimmedInput,
      artifacts: [],
      toolCalls: [],
    };
    const assistantId = generateId();
    const assistantMessage: StudyChatMessage = {
      id: assistantId,
      role: "assistant",
      content: "",
      artifacts: [],
      toolCalls: [],
    };
    const history: ChatHistoryMessage[] = messages
      .filter((message) => message.content.trim())
      .map((message) => ({
        role: message.role,
        content: message.content,
      }));

    setMessages((current) => [...current, userMessage, assistantMessage]);
    setInput("");
    setIsStreaming(true);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    await streamLangGraphChat(
      {
        threadId: "study-thread",
        message: trimmedInput,
        history,
        canvas: buildCanvasSnapshot(),
      },
      {
        onMessageDelta: (delta) => {
          setMessages((current) =>
            updateMessage(current, assistantId, (message) => ({
              ...message,
              content: `${message.content}${delta}`,
            })),
          );
        },
        onToolCall: (toolCall) => {
          setMessages((current) =>
            updateMessage(current, assistantId, (message) => ({
              ...message,
              toolCalls: [...message.toolCalls, toolCall],
            })),
          );
        },
        onArtifact: (artifact) => {
          setMessages((current) =>
            updateMessage(current, assistantId, (message) => ({
              ...message,
              artifacts: [...message.artifacts, artifact],
            })),
          );
        },
        onCanvasPatch: (patch) => {
          const applied = applyCanvasPatch(patch);
          setMessages((current) =>
            updateMessage(current, assistantId, (message) => ({
              ...message,
              patchStatus: applied ? "applied" : "rejected",
            })),
          );
        },
        onDone: () => {
          setIsStreaming(false);
        },
        onError: (message) => {
          setMessages((current) =>
            updateMessage(current, assistantId, (chatMessage) => ({
              ...chatMessage,
              error: message,
            })),
          );
          setIsStreaming(false);
        },
      },
      controller.signal,
    ).catch((error: unknown) => {
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }

      setMessages((current) =>
        updateMessage(current, assistantId, (message) => ({
          ...message,
          error: "The LangGraph backend is not available.",
        })),
      );
    });

    setIsStreaming(false);
    abortControllerRef.current = null;
  }, [input, isStreaming, messages]);

  const cancelStreaming = React.useCallback(() => {
    abortControllerRef.current?.abort();
    setIsStreaming(false);
  }, []);

  return (
    <section
      className="flex min-h-[70dvh] flex-col border-b border-border bg-background lg:h-full lg:min-h-0 lg:border-b-0 lg:border-r"
      data-testid="study-chat-panel"
    >
      <div className="border-b border-border p-4">
        <h1 className="text-xl font-semibold">Chat</h1>
        <p className="mt-1 text-sm text-muted-foreground">LangGraph UI generation</p>
      </div>

      <div
        ref={scrollRef}
        className="min-h-0 flex-1 space-y-4 overflow-auto p-4"
        data-testid="study-chat-thread"
      >
        {messages.map((message) => (
          <StudyChatMessageView key={message.id} message={message} />
        ))}
        {isStreaming && (
          <div className="text-xs text-muted-foreground" data-testid="study-chat-streaming">
            Streaming...
          </div>
        )}
      </div>

      <div className="border-t border-border p-4">
        <form
          className="space-y-2"
          onSubmit={(event) => {
            event.preventDefault();
            void submitMessage();
          }}
        >
          <textarea
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                void submitMessage();
              }
            }}
            className="h-24 w-full resize-none rounded-md border border-border bg-background p-3 text-sm outline-none focus:border-primary"
            placeholder="Create a revenue chart"
            data-testid="study-chat-input"
          />
          <div className="flex justify-end">
            {isStreaming ? (
              <button
                type="button"
                onClick={cancelStreaming}
                className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted"
                data-testid="study-chat-cancel"
              >
                Stop
              </button>
            ) : (
              <button
                type="submit"
                disabled={!input.trim()}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm",
                  input.trim()
                    ? "hover:bg-muted"
                    : "cursor-not-allowed opacity-50",
                )}
                data-testid="study-chat-submit"
              >
                <SendIcon className="h-4 w-4" />
                <span>Send</span>
              </button>
            )}
          </div>
        </form>
      </div>
    </section>
  );
}
