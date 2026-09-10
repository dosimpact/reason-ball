"use client";

import { useChat } from "@ai-sdk/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { learningQueryKeys } from "@/shared/api/learning";
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  Clipboard,
  Copy,
  Lightbulb,
  Menu,
  Paperclip,
  Pencil,
  Plus,
  RotateCcw,
  Send,
  Settings2,
  Share2,
  Square,
  ThumbsDown,
  ThumbsUp,
  Trash2,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, type ClipboardEvent, type FormEvent } from "react";
import { DefaultChatTransport, lastAssistantMessageIsCompleteWithApprovalResponses, type FileUIPart } from "ai";
import {
  MessageContent,
  messageText,
  mockChatRepository,
  httpChatRepository,
  usesRemoteChatData,
  storedMessagesToChat,
  hasToolApprovalResponse,
  hasToolApprovalDecision,
  planToolApprovalRetry,
  createDraftStorage,
  withBrowserOutbox, prepareOutbox, reconcileOutbox, draftAfterTransmission, type ChatOutbox,
  type ChatArtifact,
  type ChatArtifactKind,
  type ChatConversation,
  type ChatMessage,
} from "@/entities/chat";
import { CharacterAvatar, useCharacterQuery, type Character } from "@/entities/character";
import { useLearningActivity, useTouchHistoryMutation } from "@/entities/learning-session";
import { useMissionQuery, type Mission } from "@/entities/mission";
import { useMissionRunQuery, useStartMissionRunMutation } from "@/entities/mission-run";
import { AudioPlaybackButton, invalidateAudioCache } from "@/features/audio-playback";
import { ArtifactWorkspace, RemoteArtifactWorkspace } from "@/features/chat-artifact";
import { MissionEvaluationPanel } from "@/features/mission-evaluation";
import { SaveNotebookButton } from "@/features/notebook-save/ui/save-notebook-button";
import { conversationUrl } from "../model/conversation-url";
import { ChatModelSelector } from './chat-model-selector';
import { attachmentSelectionError, chatFileDisplayUrl } from '@/entities/chat/model/attachment';
import { readAttachmentDataUrl } from '@/entities/chat/api/read-attachment';
import { unknownModelCapabilities, unsupportedChatInput } from '@/shared/api/ai/model-catalog';
import { buildChatRequest } from "../model/chat-request";
import { planChatRetry } from "../model/retry-plan";
import { captureEditCheckpoint, planEditedGeneration, prepareEditRequest, type EditCheckpoint, type EditRequest } from "../model/remote-edit";
import { ensureBrowserSession } from "@/shared/api/auth/browser-session";
import { loadSavedChatContext } from "../api/saved-context";
import { createLocalPreferences } from "@/entities/learner/api/preferences-repository";
import { appendGuidanceHint, buildMissionGuidance, selectGuidanceStep } from "../model/mission-guidance";
import { MissionGuidancePanel } from "./mission-guidance-panel";
import { MessageLearningHelp } from "@/features/learning-assistance/ui/message-learning-help";

type PendingAttachment = FileUIPart & { size: number };

function makeId(prefix: string) {
  return `${prefix}-${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`}`;
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function welcomeMessage(character: Character, mission?: Mission): ChatMessage {
  return {
    id: makeId("welcome"),
    role: "assistant",
    parts: [{
      type: "text",
      text: mission
        ? `Hi! I'm ${character.name}. Today we're practicing “${mission.title}.” Take your time—what would you like to say first?`
        : `Hi! I'm ${character.name}. We can practice English at your pace. How was your day?`,
    }],
  };
}

function conversationInput(character: Character, mission?: Mission) {
  const routeKey = `${character.id}:${mission?.id ?? "free"}`;
  return {
    characterId: character.id,
    characterName: character.name,
    learningContext: structuredClone({ character, mission }),
    messages: [welcomeMessage(character, mission)],
    missionId: mission?.id,
    missionTitle: mission?.title,
    routeKey,
    title: mission ? `${character.name}와 ${mission.title}` : `${character.name}와 자유 대화`,
  };
}

export function ChatWorkspace({ characterId }: { characterId: string }) {
  const searchParams = useSearchParams();
  const conversationId = searchParams.get("conversation");
  if (conversationId && searchParams.get("attempt") !== "new") {
    return <SavedChatWorkspace characterId={characterId} conversationId={conversationId} missionId={searchParams.get("mission") ?? undefined} scenario={searchParams.get("scenario") ?? undefined} />;
  }
  return <NewChatWorkspace characterId={characterId} />;
}

function SavedChatWorkspace({ characterId, conversationId, missionId, scenario }: { characterId: string; conversationId: string; missionId?: string; scenario?: string }) {
  const context = useQuery({
    queryKey: ["saved-chat-context", conversationId, characterId, missionId],
    queryFn: () => loadSavedChatContext({ conversationId, characterId, missionId }),
    retry: false,
  });
  if (context.isPending) return <div role="status" className="px-5 py-24 text-center">저장된 대화를 준비하고 있어요.</div>;
  if (context.isError) return <div role="alert" className="px-5 py-24 text-center"><p>{context.error.message}</p><button type="button" onClick={() => void context.refetch()} className="mt-4 underline">대화 설정 다시 불러오기</button><Link href="/history" className="ml-4 underline">대화 기록</Link></div>;
  const legacyMetadata = context.data.character.metadataSource === "current-resource" || context.data.mission?.metadataSource === "current-resource";
  return <>{legacyMetadata ? <p role="status" className="mx-auto max-w-5xl px-5 pt-4 text-sm text-amber-700">이전 버전의 일부 표시 정보가 저장되지 않아 이름·설명·난이도에는 현재 정보가 표시될 수 있어요. 학습 단계와 대화 기록은 유지됩니다.</p> : null}<ResolvedChatWorkspace character={context.data.character} mission={context.data.mission} requestedConversationId={conversationId} requestedNewAttempt={false} scenario={scenario} /></>;
}

function NewChatWorkspace({ characterId }: { characterId: string }) {
  const searchParams = useSearchParams();
  const missionId = searchParams.get("mission") ?? undefined;
  const requestedConversationId = searchParams.get("conversation") ?? undefined;
  const scenario = searchParams.get("scenario") ?? undefined;
  const requestedNewAttempt = searchParams.get("attempt") === "new";
  const { data: character, isPending: characterPending } = useCharacterQuery(characterId);
  const { data: mission, isPending: missionPending } = useMissionQuery(missionId);

  if (characterPending || (missionId && missionPending)) {
    return <div className="mx-auto max-w-xl px-5 py-24 text-center" role="status">대화를 준비하고 있어요.</div>;
  }
  if (!character) return <div className="mx-auto max-w-xl px-5 py-24 text-center"><h1 className="text-3xl font-black">대화할 캐릭터를 찾을 수 없어요.</h1><Link href="/characters" className="mt-6 inline-flex rounded-full bg-neutral-950 px-5 py-3 text-sm font-bold text-white">캐릭터 찾기</Link></div>;
  if (missionId && !mission) return <div role="alert" className="px-5 py-24 text-center">미션을 불러올 수 없어요. <Link href="/missions" className="underline">미션 목록으로 돌아가기</Link></div>;
  if (character.publishStatus === "archived" || mission?.publishStatus === "archived") return <div role="alert" className="px-5 py-24 text-center">보관된 콘텐츠로 새 대화를 시작할 수 없어요. <Link href="/history" className="underline">기존 대화 기록 열기</Link></div>;

  return <ResolvedChatWorkspace character={character} mission={mission ?? undefined} requestedConversationId={requestedConversationId} requestedNewAttempt={requestedNewAttempt} scenario={scenario} />;
}

function ResolvedChatWorkspace({ character, mission, requestedConversationId, requestedNewAttempt, scenario }: { character: Character; mission?: Mission; requestedConversationId?: string; requestedNewAttempt: boolean; scenario?: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [conversation, setConversation] = useState<ChatConversation>();
  const [draftSession, setDraftSession] = useState<{ ownerId: string; warning?: string }>();
  const [recoveryIssue, setRecoveryIssue] = useState<{ ownerId: string; conversationId: string; text: string }>();
  const [loadError, setLoadError] = useState<string>();
  const [loadAttempt, setLoadAttempt] = useState(0);
  const creation = useRef<{ routeKey: string; id: string } | undefined>(undefined);
  const creating = useRef(false);
  const forceCreate = useRef(false);
  const previousNewAttempt = useRef(false);
  const loadEpoch = useRef(0);

  const restoreDraft = useCallback(async (next: ChatConversation, ownerId: string, epoch: number) => {
    let entry: ChatOutbox | undefined;
    let confirmed = false;
    try {
      entry = await withBrowserOutbox(ownerId, next.id, (store) => store.read());
      if (epoch !== loadEpoch.current) return;
      if (entry) {
        const recovered = reconcileOutbox(next, entry);
        confirmed = recovered.stored;
        next = recovered.conversation;
      }
      if (epoch !== loadEpoch.current) return;
      setRecoveryIssue(undefined);
    } catch (cause) {
      if (epoch !== loadEpoch.current) return;
      setRecoveryIssue({ ownerId, conversationId: next.id, text: entry?.parts.map((part) => part.type === 'text' ? part.text : `[첨부: ${part.filename ?? part.mediaType}]`).join('\n') ?? '' });
      throw new Error(cause instanceof Error ? cause.message : '전송 기록을 확인하지 못했어요.');
    }
    try {
      const draft = createDraftStorage(window.localStorage).read(ownerId, next.id);
      // A crash can occur between writing the outbox and clearing the composer.
      const restoredDraft = entry ? draftAfterTransmission(draft, entry) : draft;
      if (restoredDraft !== draft) createDraftStorage(window.localStorage).write(ownerId, next.id, '');
      if (confirmed && entry) await withBrowserOutbox(ownerId, next.id, (store) => store.clear(entry!.userMessageId));
      if (epoch !== loadEpoch.current) return;
      setDraftSession({ ownerId });
      setConversation({ ...next, draft: restoredDraft });
    } catch {
      setDraftSession({ ownerId, warning: "초안을 복원하지 못했어요. 이 브라우저의 저장소 설정을 확인해 주세요." });
      setConversation(next);
    }
  }, []);

  useEffect(() => {
    let active = true;
    const epoch = ++loadEpoch.current;
    if (requestedNewAttempt && !previousNewAttempt.current) creation.current = undefined;
    previousNewAttempt.current = requestedNewAttempt;
    queueMicrotask(async () => {
      if (!active) return;
      setLoadError(undefined);
      setRecoveryIssue(undefined);
      if (usesRemoteChatData()) {
        setConversation(undefined);
        try {
          const user = await ensureBrowserSession();
          if (!active || epoch !== loadEpoch.current) return;
          const context = conversationInput(character, mission);
          if (creation.current?.routeKey !== context.routeKey) creation.current = { routeKey: context.routeKey, id: crypto.randomUUID() };
          const next = requestedConversationId && !requestedNewAttempt && !forceCreate.current
            ? await httpChatRepository.getConversation(requestedConversationId, context)
            : await httpChatRepository.createConversation(context, creation.current.id);
          if (!active || epoch !== loadEpoch.current) return;
          forceCreate.current = false;
          await restoreDraft(next, user.id, epoch);
          if (!active || epoch !== loadEpoch.current) return;
          if (requestedConversationId !== next.id || requestedNewAttempt) {
            router.replace(conversationUrl({ characterId: character.id, missionId: mission?.id, conversationId: next.id }));
          }
        } catch (cause) {
          if (active && epoch === loadEpoch.current) setLoadError(cause instanceof Error ? cause.message : "대화를 불러오지 못했어요.");
        }
        return;
      }
      const next = requestedNewAttempt
        ? mockChatRepository.createConversation(conversationInput(character, mission))
        : mockChatRepository.getOrCreateActiveConversation(conversationInput(character, mission), requestedConversationId);
      setConversation(next);
      if (requestedNewAttempt) router.replace(conversationUrl({ characterId: character.id, missionId: mission?.id, conversationId: next.id, scenario }));
    });
    return () => { active = false; loadEpoch.current += 1; creating.current = false; };
  }, [character, mission, requestedConversationId, requestedNewAttempt, router, scenario, loadAttempt, restoreDraft]);

  async function startNewConversation() {
    if (requestedConversationId) {
      const query = new URLSearchParams({ attempt: "new" });
      if (mission) query.set("mission", mission.id);
      if (scenario) query.set("scenario", scenario);
      router.push(`/chat/${encodeURIComponent(character.id)}?${query}`);
      return;
    }
    if (usesRemoteChatData()) {
      if (creating.current) return;
      creating.current = true;
      const epoch = ++loadEpoch.current;
      setLoadError(undefined);
      setRecoveryIssue(undefined);
      const context = conversationInput(character, mission);
      creation.current = { routeKey: context.routeKey, id: crypto.randomUUID() };
      forceCreate.current = true;
      try {
        const user = await ensureBrowserSession();
        if (epoch !== loadEpoch.current) return;
        const next = await httpChatRepository.createConversation(context, creation.current.id);
        if (epoch !== loadEpoch.current) return;
        forceCreate.current = false;
        await restoreDraft(next, user.id, epoch);
        if (epoch !== loadEpoch.current) return;
        void queryClient.invalidateQueries({ queryKey: learningQueryKeys.snapshot() });
        router.replace(conversationUrl({ characterId: character.id, missionId: mission?.id, conversationId: next.id }));
      } catch (cause) {
        if (epoch === loadEpoch.current) setLoadError(cause instanceof Error ? cause.message : "새 대화를 만들지 못했어요.");
      } finally {
        if (epoch === loadEpoch.current) creating.current = false;
      }
      return;
    }
    const next = mockChatRepository.createConversation(conversationInput(character, mission));
    setConversation(next);
    router.replace(conversationUrl({ characterId: character.id, missionId: mission?.id, conversationId: next.id, scenario }));
  }

  function replaceDeletedConversation() {
    startNewConversation();
  }

  async function discardLocalTransmission() {
    if (!recoveryIssue || !window.confirm('표시된 내용을 필요한 곳에 복사했나요? 이 대화의 로컬 전송 기록만 삭제합니다. 서버 메시지는 삭제하지 않습니다.')) return;
    try {
      await withBrowserOutbox(recoveryIssue.ownerId, recoveryIssue.conversationId, (store) => store.discard());
      setRecoveryIssue(undefined); setLoadAttempt((value) => value + 1);
    } catch { setLoadError('로컬 전송 기록을 지우지 못했어요. 브라우저 저장소를 확인해 주세요.'); }
  }

  if (loadError) return <div className="mx-auto max-w-xl px-5 py-24 text-center" role="alert"><h1 className="text-xl font-black">대화를 준비하지 못했어요.</h1><p className="mt-3 text-sm">{loadError}</p>{recoveryIssue ? <><pre className="mt-4 max-h-64 overflow-auto whitespace-pre-wrap rounded-xl bg-neutral-100 p-4 text-left text-sm">{recoveryIssue.text}</pre><button type="button" onClick={() => void discardLocalTransmission()} className="mt-4 rounded-xl border px-4 py-3 text-sm">로컬 전송 기록을 지우고 대화 열기</button></> : null}<button type="button" onClick={() => setLoadAttempt((value) => value + 1)} className="mt-5 rounded-full bg-neutral-950 px-5 py-3 text-sm font-bold text-white">대화 다시 불러오기</button></div>;
  // Canonical navigation switches NewChatWorkspace to SavedChatWorkspace. Do not
  // expose a temporary composer that can unmount during the user's first input.
  if (!conversation || requestedNewAttempt || (usesRemoteChatData() && requestedConversationId !== conversation.id)) return <div className="mx-auto max-w-xl px-5 py-24 text-center" role="status">대화를 준비하고 있어요.</div>;

  return <LoadedChatWorkspace key={`${draftSession?.ownerId ?? "mock"}:${conversation.id}`} draftSession={draftSession} character={character} conversation={conversation} mission={mission} onDelete={replaceDeletedConversation} onNew={startNewConversation} scenario={scenario} />;
}

function defaultArtifact(kind: ChatArtifactKind): ChatArtifact {
  const now = new Date().toISOString();
  const contents: Record<ChatArtifactKind, string> = {
    code: "function practice() {\n  return 'Keep speaking!';\n}",
    image: "A friendly language practice scene in a warm editorial illustration",
    sheet: "Expression,Meaning\nCould you help me?,도와주시겠어요?",
    text: "# Conversation notes\n\nA useful phrase from today’s practice.",
  };
  const titles: Record<ChatArtifactKind, string> = { code: "Practice code", image: "Scene prompt", sheet: "Expression sheet", text: "Conversation note" };
  return { createdAt: now, id: makeId("artifact"), kind, title: titles[kind], updatedAt: now, versions: [{ content: contents[kind], createdAt: now, id: makeId("version") }] };
}

function LoadedChatWorkspace({ character, conversation, mission, onDelete, onNew, scenario, draftSession }: { character: Character; conversation: ChatConversation; mission?: Mission; onDelete: () => void; onNew: () => void; scenario?: string; draftSession?: { ownerId: string; warning?: string } }) {
  const remote = usesRemoteChatData();
  const activity = useLearningActivity(conversation.id, remote);
  const queryClient = useQueryClient();
  const [actionError, setActionError] = useState<string>();
  const [draftWarning, setDraftWarning] = useState(draftSession?.warning);
  const { mutate: touchHistory } = useTouchHistoryMutation();
  const startMissionRun = useStartMissionRunMutation();
  const missionRunQuery = useMissionRunQuery(conversation.missionRunId ?? startMissionRun.data?.id);
  const missionRun = missionRunQuery.data ?? startMissionRun.data;
  const missionReady = !mission || Boolean(missionRun);
  const missionStartError = startMissionRun.error ?? missionRunQuery.error;
  const [input, setInputState] = useState(conversation.draft);
  const [model, setModelState] = useState(conversation.modelId);
  const modelCatalog = useQuery({ queryKey: ['chat-model-catalog'], queryFn: () => httpChatRepository.getModels(), staleTime: 0, retry: false });
  const modelEntries = modelCatalog.data ?? [];
  const availableModels = modelEntries.map(({ id }) => id);
  const selectedCapabilities = (!modelCatalog.isError && !modelCatalog.isPending ? modelEntries.find(({ id }) => id === model)?.capabilities : undefined) ?? unknownModelCapabilities;
  const [editingId, setEditingId] = useState<string>();
  const [attachment, setAttachment] = useState<PendingAttachment>();
  const [attachmentError, setAttachmentError] = useState<string>();
  const [readingAttachment, setReadingAttachment] = useState(false);
  const attachmentRead = useRef<{ version: number; controller?: AbortController }>({ version: 0 });
  useEffect(() => {
    const current = attachmentRead.current;
    return () => { current.version++; current.controller?.abort(); };
  }, []);
  const [copiedId, setCopiedId] = useState<string>();
  const [votes, setVotes] = useState(conversation.votes);
  const [savingVote, setSavingVote] = useState(false);
  const voteRequestInFlight = useRef(false);
  const [shareToken, setShareToken] = useState(conversation.shareToken);
  const [shareOpen, setShareOpen] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);
  const [destructiveAction, setDestructiveAction] = useState<"clear" | "delete" | "purge">();
  const [purgeConfirmation, setPurgeConfirmation] = useState("");
  const [deleting, setDeleting] = useState(false);
  const deletingRef = useRef(false);
  const purgeRequestRef = useRef<string | undefined>(undefined);
  const clearRequestRef = useRef<string | undefined>(undefined);
  const [notesOpen, setNotesOpen] = useState(false);
  const [guidanceOpen, setGuidanceOpen] = useState(false);
  const [artifactsOpen, setArtifactsOpen] = useState(false);
  const [artifacts, setArtifacts] = useState(conversation.artifacts);
  const [initialArtifactKind, setInitialArtifactKind] = useState<ChatArtifactKind>();
  const [title, setTitle] = useState(conversation.title);
  const [chatSource, setChatSource] = useState<"api">();
  const [theme, setTheme] = useState(conversation.theme);
  const [audioRevisions, setAudioRevisions] = useState<Record<string, number>>({});
  const [pendingRequest, setPendingRequest] = useState(conversation.pendingRequest);
  const [autoPlayMessageId, setAutoPlayMessageId] = useState<string>();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const missionRunRequested = useRef(false);
  const requestStartedThisMount = useRef(false);
  const requestFinishedThisMount = useRef(false);
  const resumeAssistantMessageId = useRef(conversation.pendingRequest?.assistantMessageId);
  const editingBranch = useRef<ChatMessage[] | undefined>(undefined);
  const remoteEdit = useRef<{ checkpoint: EditCheckpoint; request?: EditRequest } | undefined>(undefined);
  const regenerationRequests = useRef(new Map<string, string>());

  const saveMockConversation = useCallback((patch: Partial<Omit<ChatConversation, "id" | "createdAt">>) => {
    if (!remote) mockChatRepository.updateConversation(conversation.id, patch);
  }, [conversation.id, remote]);

  const transport = useMemo(() => new DefaultChatTransport<ChatMessage>({
    api: "/api/ai/chat",
    prepareSendMessagesRequest: ({ messages: requestMessages }) => ({
      body: buildChatRequest({
        messages: requestMessages,
        learnerPreferences: usesRemoteChatData() ? undefined : createLocalPreferences(window.localStorage).read().settings,
        conversationId: conversation.id,
        modelId: model,
        character,
        mission,
        scenario,
        mockRuntime: process.env.NEXT_PUBLIC_APP_RUNTIME_MODE === "mock",
      }),
    }),
  }), [character, conversation.id, mission, model, scenario]);

  const initialMessages = useMemo(() => {
    if (!conversation.pendingRequest) return conversation.messages;
    const pendingUserIndex = conversation.messages.findIndex((message) => message.id === conversation.pendingRequest?.userMessageId);
    return pendingUserIndex < 0 ? conversation.messages : conversation.messages.slice(0, pendingUserIndex);
  }, [conversation]);

  const { addToolApprovalResponse, clearError, error, messages, regenerate, sendMessage, setMessages, status, stop } = useChat<ChatMessage>({
    id: conversation.id,
    messages: initialMessages,
    transport,
    onError: (cause) => {
      if (remote && cause.message.includes("CHAT_RESPONSE_SAVED")) void restoreSavedMessages();
    },
    onFinish: ({ isError, isAbort, message }) => {
      if (!isError && !isAbort) setAutoPlayMessageId(message.id);
      requestFinishedThisMount.current = !isError;
      if (!isError) setChatSource("api");
      if (!isError && remote) void queryClient.invalidateQueries({ queryKey: learningQueryKeys.snapshot() });
      // A tool output may already be visible when Stop cancels its follow-up.
      // Restore the durable checkpoint/result so retry does not disappear.
      if (remote && isAbort && hasToolApprovalDecision(message)) void restoreSavedMessages();
    },
    sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithApprovalResponses,
  });

  const busy = status === "submitted" || status === "streaming";

  async function restoreSavedMessages() {
    try {
      const restored = storedMessagesToChat(await httpChatRepository.getMessages(conversation.id));
      setMessages(restored);
      setPendingRequest(undefined);
      clearError();
      setChatSource("api");
      setActionError(undefined);
    } catch {
      setActionError("저장된 답변을 복원하지 못했어요. 연결을 확인한 뒤 다시 시도해 주세요.");
    }
  }
  const guidance = mission ? buildMissionGuidance(mission, missionRun) : undefined;
  const completedRunSteps = missionRun?.steps.filter((step) => step.status === "completed").length ?? 0;
  const suggestions = mission?.keyPhrases.slice(0, 3) ?? [
    { english: "Could you say that again?", korean: "다시 말해 줄래요?" },
    { english: "Let me think for a second.", korean: "잠깐 생각해 볼게요." },
  ];

  useEffect(() => {
    if (!mission || conversation.missionRunId || missionRunRequested.current) return;
    missionRunRequested.current = true;
    startMissionRun.mutate({
      characterId: character.id,
      conversationId: conversation.id,
      missionId: mission.id,
      missionTitle: mission.title,
      modelId: model,
      steps: (mission.steps ?? mission.objectives).map((step) => ({ id: step.id, label: step.label, required: "required" in step && typeof step.required === "boolean" ? step.required : true })),
    }, {
      onSuccess: (run) => saveMockConversation({ missionRunId: run.id }),
    });
  }, [character.id, conversation.id, conversation.missionRunId, mission, model, startMissionRun, saveMockConversation]);

  useEffect(() => {
    if (remote) return;
    saveMockConversation({ messages });
    if (messages.length < 2) return;
    const last = messages.at(-1);
    if (!last) return;
    touchHistory({
      id: conversation.id,
      characterId: character.id,
      missionId: mission?.id,
      title,
      preview: messageText(last).slice(0, 100) || "첨부 파일이 있는 대화",
      turnCount: messages.length,
    });
  }, [character.id, conversation.id, messages, mission?.id, title, touchHistory, remote, saveMockConversation]);

  useEffect(() => {
    if (!pendingRequest || requestStartedThisMount.current) return;
    const userMessage = conversation.messages.find((message) => message.id === pendingRequest.userMessageId && message.role === "user");
    if (!userMessage) {
      saveMockConversation({ pendingRequest: undefined });
      queueMicrotask(() => setPendingRequest(undefined));
      return;
    }
    requestStartedThisMount.current = true;
    requestFinishedThisMount.current = false;
    void sendMessage({ id: userMessage.id, role: "user", parts: userMessage.parts }).catch(() => undefined);
  }, [conversation.id, conversation.messages, pendingRequest, sendMessage, saveMockConversation]);

  useEffect(() => {
    if (!pendingRequest) return;
    const userIndex = messages.findIndex((message) => message.id === pendingRequest.userMessageId);
    const assistantMessage = userIndex >= 0 ? messages.slice(userIndex + 1).find((message) => message.role === "assistant") : undefined;
    if (!assistantMessage) return;
    if (!pendingRequest.assistantMessageId && status !== "ready") {
      const nextPending = { ...pendingRequest, assistantMessageId: assistantMessage.id };
      resumeAssistantMessageId.current = assistantMessage.id;
      queueMicrotask(() => setPendingRequest(nextPending));
      saveMockConversation({ pendingRequest: nextPending });
      return;
    }
    if (status !== "ready" || !requestFinishedThisMount.current || !requestStartedThisMount.current) return;
    const assistantMessageId = resumeAssistantMessageId.current ?? pendingRequest.assistantMessageId ?? assistantMessage.id;
    const normalizedMessages = assistantMessage.id === assistantMessageId ? messages : messages.map((message) => message.id === assistantMessage.id ? { ...message, id: assistantMessageId } : message);
    if (normalizedMessages !== messages) setMessages(normalizedMessages);
    saveMockConversation({ messages: normalizedMessages, pendingRequest: undefined });
    setPendingRequest(undefined);
  }, [conversation.id, messages, pendingRequest, setMessages, status, saveMockConversation]);

  function setInput(value: string) {
    setInputState(value);
    if (remote && !editingId) persistDraft(value);
    saveMockConversation({ draft: value });
  }

  function persistDraft(value: string) {
    try {
      if (!draftSession?.ownerId) throw new Error("Missing draft owner");
      createDraftStorage(window.localStorage).write(draftSession.ownerId, conversation.id, value);
      setDraftWarning(undefined);
    } catch {
      setDraftWarning("초안을 보존하지 못했어요. 입력은 유지되지만 새로고침하면 사라질 수 있어요.");
    }
  }

  async function setModel(value: string) {
    if (busy || deletingRef.current) return false;
    if (modelCatalog.isPending || modelCatalog.isError) { setActionError('모델 목록을 먼저 불러와 주세요.'); return false; }
    if (!availableModels.includes(value)) { setActionError('선택 가능한 모델 ID를 입력해 주세요.'); return false; }
    const nextCapabilities = modelEntries.find(({ id }) => id === value)?.capabilities ?? unknownModelCapabilities;
    if (unsupportedChatInput(nextCapabilities, messages)) {
      setActionError('이 대화의 기존 첨부 또는 도구 기록을 지원하는 모델을 선택해 주세요.');
      return false;
    }
    cancelAttachmentRead();
    setActionError(undefined);
    if (remote) {
      deletingRef.current = true; setDeleting(true);
      try {
        setModelState(await httpChatRepository.setModel(conversation.id, value));
        setAttachmentError(undefined);
        return true;
      } catch (cause) {
        setActionError(cause instanceof Error ? cause.message : "모델을 저장하지 못했어요.");
        return false;
      } finally { deletingRef.current = false; setDeleting(false); }
    }
    setModelState(value);
    setAttachmentError(undefined);
    saveMockConversation({ modelId: value });
    return true;
  }

  function updateArtifacts(nextArtifacts: ChatArtifact[]) {
    if (remote) return;
    setArtifacts(nextArtifacts);
    saveMockConversation({ artifacts: nextArtifacts });
  }

  async function updateVote(messageId: string, value: "up" | "down", reason?: string) {
    if (remote) {
      if (voteRequestInFlight.current || deletingRef.current) return;
      voteRequestInFlight.current = true;
      setSavingVote(true);
      setActionError(undefined);
      try {
        const saved = await httpChatRepository.vote(messageId, value, reason);
        setVotes((current) => ({ ...current, [messageId]: saved }));
      } catch (cause) {
        setActionError(cause instanceof Error ? cause.message : "피드백을 저장하지 못했어요.");
      } finally {
        voteRequestInFlight.current = false;
        setSavingVote(false);
      }
      return;
    }
    const nextVotes = { ...votes, [messageId]: { value, ...(reason ? { reason } : {}) } };
    setVotes(nextVotes);
    saveMockConversation({ votes: nextVotes });
  }

  function updateWeather(messageId: string, partIndex: number, approved: boolean) {
    const nextMessages = messages.map((message) => {
      if (message.id !== messageId) return message;
      return {
        ...message,
        parts: message.parts.map((part, index) => index === partIndex && part.type === "data-weather" ? {
          ...part,
          data: approved
            ? { ...part.data, condition: "맑음", state: "result" as const, temperature: 23 }
            : { ...part.data, state: "denied" as const },
        } : part),
      };
    });
    setMessages(nextMessages);
    saveMockConversation({ messages: nextMessages });
  }

  function cancelAttachmentRead() {
    attachmentRead.current.version++;
    attachmentRead.current.controller?.abort();
    attachmentRead.current.controller = undefined;
    setReadingAttachment(false);
  }

  function clearAttachment() {
    cancelAttachmentRead();
    setAttachment(undefined);
    setAttachmentError(undefined);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function chooseAttachment(file?: File) {
    if (!file || busy || deletingRef.current) return;
    cancelAttachmentRead();
    const issue = attachmentSelectionError(file, selectedCapabilities);
    if (issue) { setAttachmentError(issue); return; }
    const version = attachmentRead.current.version;
    const controller = new AbortController();
    attachmentRead.current.controller = controller;
    setReadingAttachment(true);
    setAttachmentError(undefined);
    try {
      const url = await readAttachmentDataUrl(file, controller.signal);
      if (attachmentRead.current.version !== version) return;
      setAttachment({ filename: file.name, mediaType: file.type, size: file.size, type: 'file', url });
    } catch {
      if (attachmentRead.current.version === version) setAttachmentError('파일을 읽지 못했어요. 기존 입력과 첨부는 유지했으니 다시 선택해 주세요.');
    } finally {
      if (attachmentRead.current.version === version) {
        attachmentRead.current.controller = undefined;
        setReadingAttachment(false);
      }
    }
  }

  function pasteAttachment(event: ClipboardEvent<HTMLTextAreaElement>) {
    const files = Array.from(event.clipboardData.files);
    if (files.length === 0) return; // Preserve the browser's normal text paste.
    event.preventDefault();
    if (busy || deletingRef.current) return;
    if (files.length > 1) {
      cancelAttachmentRead();
      setAttachmentError('한 번에 파일 하나만 붙여넣어 주세요. 기존 첨부는 유지했어요.');
      return;
    }
    void chooseAttachment(files[0]);
  }

  function appendLocalMessages(nextMessages: ChatMessage[]) {
    setMessages((current) => [...current, ...nextMessages]);
  }

  function executeCommand(commandText: string) {
    const [rawCommand, ...args] = commandText.trim().split(/\s+/);
    const command = rawCommand.toLowerCase();
    const argument = args.join(" ").trim();
    if (command === "/hint") {
      if (mission) { setGuidanceOpen(true); setInput(""); }
      else setInput(suggestions[0]?.english ?? "Could you give me a hint?");
      return true;
    }
    if (command === "/translate") { setInput("Please help me say this naturally in English: "); return true; }
    if (command === "/goal") {
      if (guidance) {
        setGuidanceOpen(true);
        const current = selectGuidanceStep(guidance);
        setActionError(current ? undefined : "현재 실행 단계를 확인할 수 없어요. 단계별 힌트에서 복습할 단계를 선택할 수 있습니다.");
      } else appendLocalMessages([{ id: makeId("goal"), role: "assistant", parts: [{ type: "text", text: "Keep the conversation going with one clear sentence." }] }]);
      setInput(""); return true;
    }
    if (command === "/new") { onNew(); return true; }
    if (command === "/clear") {
      setActionError(undefined); setDestructiveAction("clear"); setInput(""); return true;
    }
    if (command === "/rename") {
      const nextTitle = argument || `${character.name} practice`;
      if (remote) {
        void httpChatRepository.renameConversation(conversation.id, nextTitle)
          .then(() => { setTitle(nextTitle); setInput(""); })
          .catch((cause) => setActionError(cause instanceof Error ? cause.message : "제목을 저장하지 못했어요."));
        return true;
      }
      setTitle(nextTitle); saveMockConversation({ title: nextTitle }); setInput(""); return true;
    }
    if (command === "/model") {
      if (!availableModels.includes(argument)) {
        setActionError("선택 가능한 모델 ID를 입력해 주세요."); return true;
      }
      void setModel(argument).then((saved) => { if (saved) setInput(""); });
      return true;
    }
    if (command === "/theme") {
      const nextTheme = theme === "light" ? "focus" : "light";
      setTheme(nextTheme); saveMockConversation({ theme: nextTheme }); setInput(""); return true;
    }
    if (command === "/delete") { setDestructiveAction("delete"); setInput(""); return true; }
    if (command === "/purge") { setDestructiveAction("purge"); setPurgeConfirmation(""); setInput(""); return true; }
    if (command === "/weather") {
      if (remote) return false;
      const location = argument || "Seoul";
      appendLocalMessages([
        { id: makeId("user"), role: "user", parts: [{ type: "text", text: `/weather ${location}` }] },
        { id: makeId("weather"), role: "assistant", parts: [{ type: "data-weather", data: { location, state: "approval-requested" } }] },
      ]);
      setInput(""); return true;
    }
    if (command === "/artifact") {
      const kind = (["text", "code", "image", "sheet"].includes(argument) ? argument : "text") as ChatArtifactKind;
      if (!remote) updateArtifacts([...artifacts, defaultArtifact(kind)]);
      setInitialArtifactKind(kind);
      setArtifactsOpen(true);
      setInput(""); return true;
    }
    return false;
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = input.trim();
    if (!missionReady || busy || deletingRef.current || attachmentRead.current.controller) return;
    if (!editingId && text.startsWith("/") && executeCommand(text)) return;
    if ((!text && !attachment) || busy || deletingRef.current) return;
    const editedMessageId = editingId;
    const userMessageId = editingId ?? makeId("user");
    let parts: ChatMessage["parts"] = [
      ...(attachment ? [attachment] : []),
      ...(text ? [{ type: "text" as const, text }] : []),
    ];
    if (unsupportedChatInput(selectedCapabilities, [{ parts }])) {
      setAttachmentError('이 모델의 첨부 지원이 확인되지 않았어요. 지원 모델을 선택하거나 첨부를 제거해 주세요.');
      return;
    }
    if (remote) {
      deletingRef.current = true; setDeleting(true); setAttachmentError(undefined);
      try { parts = await httpChatRepository.persistAttachments(conversation.id, parts); }
      catch (cause) {
        setAttachmentError(cause instanceof Error ? cause.message : '첨부 저장에 실패했어요. 입력을 유지했으니 다시 시도해 주세요.');
        return;
      } finally { deletingRef.current = false; setDeleting(false); }
    }
    if (remote && editingId) { await submitRemoteEdit(parts); return; }
    if (remote) {
      deletingRef.current = true; setDeleting(true); setActionError(undefined);
      try {
        if (!draftSession?.ownerId) throw new Error('전송 기록의 사용자를 확인하지 못했어요.');
        const current = await httpChatRepository.getConversation(conversation.id, conversationInput(character, mission));
        const entry = prepareOutbox(current, { id: userMessageId, role: 'user', parts }, model, new Date().toISOString());
        await withBrowserOutbox(draftSession.ownerId, conversation.id, (store) => {
          const previous = store.read();
          if (previous && reconcileOutbox(current, previous).stored) store.clear(previous.userMessageId);
          store.write(entry);
        });
      } catch (cause) {
        setActionError(cause instanceof Error ? cause.message : '전송 기록을 보존하지 못했어요. 입력은 지우지 않았습니다.');
        return;
      } finally { deletingRef.current = false; setDeleting(false); }
    }
    setInput("");
    clearError();
    const nextPending = { startedAt: new Date().toISOString(), userMessageId };
    requestStartedThisMount.current = true;
    requestFinishedThisMount.current = false;
    resumeAssistantMessageId.current = undefined;
    setPendingRequest(nextPending);
    saveMockConversation({ pendingRequest: nextPending });
    try {
      await sendMessage({ id: userMessageId, role: "user", parts });
      if (editedMessageId && isUuid(editedMessageId)) {
        await invalidateAudioCache(editedMessageId).catch(() => undefined);
      }
    } catch {
      // useChat exposes a retryable error state below the message list.
    } finally {
      setEditingId(undefined);
      editingBranch.current = undefined;
      clearAttachment();
      if (remote) void acknowledgeTransmission();
    }
  }

  async function acknowledgeTransmission() {
    if (!draftSession?.ownerId) return;
    try {
      const ownerId = draftSession.ownerId;
      const entry = await withBrowserOutbox(ownerId, conversation.id, (store) => store.read());
      if (!entry) return;
      const current = await httpChatRepository.getConversation(conversation.id, conversationInput(character, mission));
      if (reconcileOutbox(current, entry).stored) await withBrowserOutbox(ownerId, conversation.id, (store) => {
        const drafts = createDraftStorage(window.localStorage);
        const draft = drafts.read(ownerId, conversation.id);
        if (draftAfterTransmission(draft, entry) !== draft) drafts.write(ownerId, conversation.id, '');
        store.clear(entry.userMessageId);
      });
    } catch {
      setDraftWarning('전송 확인 기록을 유지하고 있어요. 새로고침하면 서버와 대조해 복구합니다.');
    }
  }

  async function submitRemoteEdit(parts: ChatMessage["parts"]) {
    const edit = remoteEdit.current;
    if (!edit || deletingRef.current || busy) return;
    deletingRef.current = true; setDeleting(true); setActionError(undefined);
    try {
      edit.request = prepareEditRequest(edit.request, parts, crypto.randomUUID());
      const { requestId, parts: savedParts } = edit.request;
      const { sourceId, expectedTailId } = edit.checkpoint;
      const saved = await httpChatRepository.replaceMessageBranch(conversation.id, sourceId, expectedTailId, requestId, savedParts);
      if (saved.id !== requestId || saved.clientMessageId !== requestId) throw new Error("편집 저장 결과를 확인하지 못했어요. 같은 내용으로 다시 시도해 주세요.");
      const plan = planEditedGeneration(await httpChatRepository.getMessages(conversation.id), requestId);
      setEditingId(undefined); editingBranch.current = undefined; remoteEdit.current = undefined;
      setInput(""); clearAttachment(); clearError();
      const retainedIds = new Set((plan.kind === "restore" ? plan.messages : plan.history).map((message) => message.id));
      setVotes((current) => Object.fromEntries(Object.entries(current).filter(([id]) => retainedIds.has(id))));
      void queryClient.invalidateQueries({ queryKey: learningQueryKeys.snapshot() });
      if (plan.kind === "restore") {
        setMessages(plan.messages); setPendingRequest(undefined); setChatSource("api");
        return;
      }
      setMessages(plan.history);
      requestStartedThisMount.current = true; requestFinishedThisMount.current = false;
      resumeAssistantMessageId.current = undefined;
      setPendingRequest({ startedAt: new Date().toISOString(), userMessageId: requestId });
      const generation = sendMessage({ id: requestId, role: "user", parts: plan.userMessage.parts });
      deletingRef.current = false; setDeleting(false);
      await generation;
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : "편집 저장 또는 답변 생성에 실패했어요. 내용을 보존했습니다.");
    } finally {
      deletingRef.current = false; setDeleting(false);
    }
  }

  async function retryLastMessage() {
    if (!missionReady) return;
    if (busy || deletingRef.current || editingId) return;
    if (remote) {
      try {
        const restored = storedMessagesToChat(await httpChatRepository.getMessages(conversation.id));
        const approvalHistory = planToolApprovalRetry(restored, messages);
        if (approvalHistory) {
          clearError();
          setMessages(approvalHistory);
          setPendingRequest(undefined);
          await sendMessage();
          return;
        }
        const plan = planChatRetry(restored, messages, pendingRequest?.userMessageId);
        if (plan.kind === "restore") {
          clearError();
          setMessages(plan.messages);
          setPendingRequest(undefined);
          setChatSource("api");
          return;
        }
        clearError();
        setMessages(plan.history);
        requestStartedThisMount.current = true;
        requestFinishedThisMount.current = false;
        await sendMessage({ id: plan.userMessage.id, role: "user", parts: plan.userMessage.parts });
      } catch (cause) {
        setActionError(cause instanceof Error ? cause.message : "대화 복원 또는 재전송에 실패했어요. 메시지는 지우지 않았습니다.");
      }
      return;
    }
    clearError();
    requestStartedThisMount.current = true;
    requestFinishedThisMount.current = false;
    try { await sendMessage(); } catch { /* keep the explicit error panel visible */ }
  }

  async function beginEdit(message: ChatMessage) {
    if (busy || deletingRef.current || editingId) return;
    if (remote) {
      deletingRef.current = true; setDeleting(true); setActionError(undefined);
      try {
        const rows = await httpChatRepository.getMessages(conversation.id);
        remoteEdit.current = { checkpoint: captureEditCheckpoint(rows, messages, message.id) };
      } catch (cause) {
        setActionError(cause instanceof Error ? cause.message : "편집 기준을 불러오지 못했어요.");
        return;
      } finally { deletingRef.current = false; setDeleting(false); }
    }
    const messageIndex = messages.findIndex((item) => item.id === message.id);
    const invalidations = remote ? [] : messages.slice(messageIndex).filter((item) => isUuid(item.id)).map((item) => invalidateAudioCache(item.id).catch(() => undefined));
    await Promise.all(invalidations);
    const filePart = message.parts.find((part): part is Extract<(typeof message.parts)[number], { type: "file" }> => part.type === "file");
    if (remote) {
      persistDraft("");
      setInputState(messageText(message));
    } else setInput(messageText(message));
    cancelAttachmentRead();
    setAttachment(filePart ? { ...filePart, size: "size" in filePart && typeof filePart.size === "number" ? filePart.size : 0 } : undefined);
    editingBranch.current = messages;
    setEditingId(message.id);
    setMessages(messages.slice(0, messageIndex));
  }

  async function cancelEdit() {
    if (deletingRef.current) return;
    if (remote && remoteEdit.current?.request) {
      deletingRef.current = true; setDeleting(true);
      try {
        // The PATCH may have committed even when its response was lost.
        editingBranch.current = storedMessagesToChat(await httpChatRepository.getMessages(conversation.id));
        const latest = editingBranch.current.at(-1);
        requestStartedThisMount.current = true;
        setPendingRequest(latest?.role === "user" ? { userMessageId: latest.id, startedAt: new Date().toISOString() } : undefined);
        clearError(); setActionError(undefined);
      } catch (cause) {
        setActionError(cause instanceof Error ? cause.message : "현재 대화를 복원하지 못했어요. 다시 시도해 주세요.");
        return;
      } finally { deletingRef.current = false; setDeleting(false); }
    }
    if (editingBranch.current) setMessages(editingBranch.current);
    editingBranch.current = undefined;
    remoteEdit.current = undefined;
    setEditingId(undefined);
    setInput("");
    clearAttachment();
  }

  async function regenerateMessage(message: ChatMessage) {
    if (!missionReady) return;
    if (busy || deletingRef.current || editingId) return;
    if (remote) {
      deletingRef.current = true; setDeleting(true); setActionError(undefined);
      try {
        const requestId = regenerationRequests.current.get(message.id) ?? crypto.randomUUID();
        regenerationRequests.current.set(message.id, requestId);
        const user = await httpChatRepository.prepareRegeneration(conversation.id, message.id, requestId);
        const restored = storedMessagesToChat(await httpChatRepository.getMessages(conversation.id));
        const userKey = user.clientMessageId ?? user.id;
        if (!restored.some((item) => item.id === userKey && item.role === "user")) throw new Error("재생성할 사용자 메시지가 변경됐어요. 대화를 새로 불러와 주세요.");
        const plan = planChatRetry(restored, restored, userKey);
        regenerationRequests.current.delete(message.id);
        clearError();
        setVotes((current) => Object.fromEntries(Object.entries(current).filter(([id]) => id !== message.id)));
        void queryClient.invalidateQueries({ queryKey: learningQueryKeys.snapshot() });
        if (plan.kind === "restore") { setMessages(plan.messages); setPendingRequest(undefined); return; }
        setMessages(plan.history);
        requestStartedThisMount.current = true; requestFinishedThisMount.current = false;
        resumeAssistantMessageId.current = undefined;
        setPendingRequest({ userMessageId: userKey, startedAt: new Date().toISOString() });
        const generation = sendMessage({ id: userKey, role: "user", parts: plan.userMessage.parts });
        deletingRef.current = false; setDeleting(false);
        await generation;
      } catch (cause) {
        setActionError(cause instanceof Error ? cause.message : "답변을 다시 생성하지 못했어요. 같은 요청으로 다시 시도해 주세요.");
      } finally { deletingRef.current = false; setDeleting(false); }
      return;
    }
    const revision = audioRevisions[message.id] ?? 1;
    if (isUuid(message.id)) await invalidateAudioCache(message.id, revision).catch(() => undefined);
    setAudioRevisions((current) => ({ ...current, [message.id]: revision + 1 }));
    await regenerate({ messageId: message.id });
  }

  async function copyMessage(message: ChatMessage) {
    await navigator.clipboard?.writeText(messageText(message));
    setCopiedId(message.id);
  }

  async function openShare() {
    try {
      const token = remote ? await httpChatRepository.shareConversation(conversation.id) : mockChatRepository.shareConversation(conversation.id);
      setShareToken(token);
      setShareOpen(true);
      setActionError(undefined);
    } catch (cause) { setActionError(cause instanceof Error ? cause.message : "공유 링크를 만들지 못했어요."); }
  }

  async function saveTitle() {
    const nextTitle = title.trim() || conversation.title;
    if (remote) {
      try { await httpChatRepository.renameConversation(conversation.id, nextTitle); }
      catch (cause) { setActionError(cause instanceof Error ? cause.message : "제목을 저장하지 못했어요."); return; }
    }
    setTitle(nextTitle);
    saveMockConversation({ title: nextTitle });
    setManageOpen(false);
    if (remote) void queryClient.invalidateQueries({ queryKey: learningQueryKeys.snapshot() });
  }

  async function confirmDestructiveAction() {
    if (!destructiveAction || deletingRef.current || busy) return;
    if (destructiveAction === "purge" && purgeConfirmation !== "DELETE ALL") return;
    deletingRef.current = true;
    setDeleting(true);
    setActionError(undefined);
    try {
      if (destructiveAction === "clear") {
        let restored: ChatMessage[];
        if (remote) {
          clearRequestRef.current ??= crypto.randomUUID();
          restored = storedMessagesToChat(await httpChatRepository.clearMessages(conversation.id, clearRequestRef.current));
          clearRequestRef.current = undefined;
          try {
            if (draftSession?.ownerId) await withBrowserOutbox(draftSession.ownerId, conversation.id, (store) => store.discard());
          } catch { window.alert('메시지는 초기화했지만 로컬 전송 기록을 지우지 못했어요. 브라우저 사이트 데이터를 확인해 주세요.'); }
          void queryClient.invalidateQueries({ queryKey: learningQueryKeys.snapshot() });
        } else {
          restored = [welcomeMessage(character, mission)];
          saveMockConversation({ messages: restored, votes: {}, pendingRequest: undefined, draft: "" });
        }
        setMessages(restored);
        setVotes({}); setPendingRequest(undefined); setEditingId(undefined);
        clearAttachment(); setInput(""); clearError();
        setDestructiveAction(undefined);
        return;
      }
      if (remote) {
        if (destructiveAction === "purge") {
          purgeRequestRef.current ??= crypto.randomUUID();
          await httpChatRepository.purgeConversations(purgeRequestRef.current, purgeConfirmation);
          purgeRequestRef.current = undefined;
        } else await httpChatRepository.deleteConversation(conversation.id);
        try {
          if (!draftSession?.ownerId) throw new Error("Missing draft owner");
          const drafts = createDraftStorage(window.localStorage);
          if (destructiveAction === "purge") drafts.clearOwner(draftSession.ownerId);
          else {
            drafts.write(draftSession.ownerId, conversation.id, "");
            await withBrowserOutbox(draftSession.ownerId, conversation.id, (store) => store.discard());
          }
        } catch {
          window.alert("대화는 삭제했지만 로컬 초안을 지우지 못했어요. 브라우저 사이트 데이터를 확인해 주세요.");
        }
        void queryClient.invalidateQueries({ queryKey: learningQueryKeys.snapshot() });
      } else if (destructiveAction === "purge") {
        mockChatRepository.purgeConversations();
      } else {
        mockChatRepository.deleteConversation(conversation.id);
      }
      setDestructiveAction(undefined);
      setPurgeConfirmation("");
      setManageOpen(false);
      onDelete();
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : "대화를 삭제하지 못했어요.");
    } finally {
      deletingRef.current = false;
      setDeleting(false);
    }
  }

  const missionPanel = mission && missionRun ? <div className="mt-6"><MissionEvaluationPanel
    runId={missionRun.id}
    onRetake={onNew}
    messages={messages
      .filter((message): message is ChatMessage & { role: "user" | "assistant" } => message.role === "user" || message.role === "assistant")
      .map((message) => ({ id: message.id, role: message.role, text: messageText(message) }))
      .filter((message) => message.text)}
  /></div> : null;

  const slashCommands = [
    ["/hint", "다음 문장 힌트"], ["/translate", "자연스러운 번역"], ["/goal", "미션 목표 확인"],
    ["/weather Seoul", "날씨 도구 승인"], ["/artifact text", "Artifact 만들기"], ["/rename", "대화 제목 변경"],
    ["/model gpt-5-mini", "모델 변경"], ["/theme", "집중 테마 전환"], ["/clear", "메시지 지우기"], ["/new", "새 대화"], ["/delete", "현재 대화 삭제"], ["/purge", "모든 대화 삭제"],
  ];

  return <div className={`h-[calc(100svh-4rem-1px)] overflow-hidden pb-20 lg:pb-0 ${theme === "focus" ? "bg-indigo-100" : "bg-[#f7f4ef]"}`} data-testid="chat-workspace" data-conversation-id={conversation.id}>
    {actionError ? <div role="alert" className="fixed inset-x-4 bottom-24 z-[80] mx-auto max-w-lg rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-900 shadow-lg"><p>{actionError}</p><button type="button" onClick={() => setActionError(undefined)} className="mt-2 font-bold">안내 닫기</button></div> : null}
    {draftWarning ? <p role="alert" className="fixed inset-x-4 bottom-12 z-[80] mx-auto max-w-lg rounded-xl bg-amber-100 p-3 text-xs text-amber-950">{draftWarning}</p> : null}
    <div className="mx-auto grid h-full min-h-0 max-w-[1600px] grid-rows-[minmax(0,1fr)] lg:grid-cols-[300px_minmax(0,1fr)_330px]">
      <aside className="hidden border-r border-black/6 bg-white/55 p-5 lg:flex lg:flex-col">
        <Link href={mission ? `/missions/${mission.id}` : `/characters/${character.id}`} className="inline-flex items-center gap-2 text-xs font-bold text-neutral-500"><ArrowLeft className="size-4" /> 대화 나가기</Link>
        <div className="mt-7 overflow-hidden rounded-[1.5rem] bg-white shadow-sm"><CharacterAvatar character={character} size="hero" className="h-52" /><div className="p-4"><p className="text-lg font-black">{character.name}</p><p className="text-xs text-[#e16748]">{character.role}</p><p className="mt-3 text-xs leading-5 text-neutral-500">{character.speakingStyle}</p></div></div>
        {mission ? <div className="mt-5 flex-1 overflow-y-auto"><p className="text-[10px] font-black uppercase tracking-[.18em] text-neutral-400">Mission run progress</p><h2 className="mt-2 font-black">{mission.title}</h2><ol className="mt-4 space-y-3">{mission.objectives.map((objective, index) => { const done = index < completedRunSteps; return <li key={objective.id} className={`flex gap-3 text-xs leading-5 ${done ? "text-emerald-700" : "text-neutral-500"}`}><span className={`mt-0.5 grid size-5 shrink-0 place-items-center rounded-full ${done ? "bg-emerald-100" : "border border-black/10"}`}>{done ? <Check className="size-3" /> : index + 1}</span><span>{objective.label}</span></li>; })}</ol></div> : null}
      </aside>

      <section className="flex min-h-0 min-w-0 flex-col bg-white" aria-label={`${character.name}와 대화`}>
        {activity.warning ? <div role="status" className="shrink-0 bg-amber-50 px-4 py-2 text-xs text-amber-900" data-testid="learning-activity-warning"><p>{activity.warning}</p><button type="button" onClick={activity.retry} className="mt-1 underline">학습 시간 기록 다시 시도</button></div> : null}
        <header className="flex h-16 shrink-0 items-center gap-3 border-b border-black/6 px-4 sm:px-6">
          <Link href={mission ? `/missions/${mission.id}` : `/characters/${character.id}`} className="grid size-9 place-items-center rounded-xl hover:bg-neutral-100 lg:hidden" aria-label="대화 나가기"><ArrowLeft className="size-4" /></Link>
          <CharacterAvatar character={character} size="sm" className="rounded-full lg:hidden" />
          <div className="min-w-0"><p className="truncate text-sm font-black">{title}</p><p className="truncate text-[10px] text-neutral-400" data-testid="conversation-id">{conversation.id}</p><p className="text-[11px] text-emerald-600">● {busy ? "답변을 생각하는 중" : "대화 가능"}{chatSource ? " · AI Route" : ""}</p></div>
          <div className="ml-auto flex items-center gap-1.5">
            <button type="button" onClick={onNew} className="grid size-9 place-items-center rounded-xl hover:bg-neutral-100" aria-label="새 대화 시작"><Plus className="size-4" /></button>
            <button type="button" onClick={() => { setInitialArtifactKind(undefined); setArtifactsOpen(true); }} className="grid size-9 place-items-center rounded-xl hover:bg-neutral-100" aria-label="Artifact 열기"><Clipboard className="size-4" /></button>
            <button type="button" onClick={openShare} className="grid size-9 place-items-center rounded-xl hover:bg-neutral-100" aria-label="대화 공유"><Share2 className="size-4" /></button>
            <button type="button" onClick={() => setManageOpen(true)} className="grid size-9 place-items-center rounded-xl hover:bg-neutral-100" aria-label="대화 관리"><Settings2 className="size-4" /></button>
            <button type="button" onClick={() => setNotesOpen(true)} className="grid size-9 place-items-center rounded-xl hover:bg-neutral-100 lg:hidden" aria-label="학습 노트 열기"><Menu className="size-4" /></button>
          </div>
        </header>
        <ChatModelSelector entries={modelEntries} model={model} disabled={busy || deleting} loading={modelCatalog.isPending} failed={modelCatalog.isError} onChange={(id) => void setModel(id)} onRetry={() => void modelCatalog.refetch()} />

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-6 sm:px-7" aria-live="polite">
          <div className="mx-auto max-w-3xl space-y-6">
            <div className="text-center"><span className="rounded-full bg-[#f7f4ef] px-3 py-1.5 text-[10px] font-bold text-neutral-400">오늘 · 안전한 AI 학습 대화</span></div>
            {messages.map((message, messageIndex) => {
              const assistant = message.role === "assistant";
              return <article key={message.id} className={`group flex gap-3 ${assistant ? "items-start" : "justify-end"}`} data-testid={`message-${message.role}`} data-message-id={message.id}>
                {assistant ? <CharacterAvatar character={character} size="sm" className="mt-1 rounded-full" /> : null}
                <div className={`max-w-[86%] sm:max-w-[75%] ${assistant ? "" : "flex flex-col items-end"}`}>
                  <div className={`rounded-[1.3rem] px-4 py-3 text-left text-sm leading-6 ${assistant ? "rounded-tl-sm bg-[#f1eee8] text-neutral-800" : "rounded-tr-sm bg-[#5763d7] text-white"}`}><MessageContent message={message} onToolApproval={(approvalId, approved) => void addToolApprovalResponse({ id: approvalId, approved })} onWeatherDecision={(approved, partIndex) => updateWeather(message.id, partIndex, approved)} /></div>
                  <div className={`mt-1 flex min-h-7 items-center gap-0.5 opacity-0 transition group-hover:opacity-100 focus-within:opacity-100 ${assistant ? "" : "flex-row-reverse"}`}>
                    {messageText(message) ? <SaveNotebookButton text={messageText(message)} conversationId={conversation.id} messageId={message.id} disabled={busy || deleting || (remote && message.id.startsWith("welcome-"))} /> : null}
                    {assistant ? <>{messageText(message) ? <AudioPlaybackButton playbackId={message.id} autoPlayOnMount={autoPlayMessageId === message.id} text={messageText(message)} messageId={isUuid(message.id) ? message.id : undefined} messageRevision={audioRevisions[message.id] ?? 1} compact /> : null}<button type="button" onClick={() => copyMessage(message)} className="message-action" aria-label="메시지 복사">{copiedId === message.id ? <Check /> : <Copy />}</button><button type="button" disabled={remote && (savingVote || busy || deleting)} onClick={() => updateVote(message.id, "up")} aria-pressed={votes[message.id]?.value === "up"} className="message-action" aria-label="좋아요"><ThumbsUp className={votes[message.id]?.value === "up" ? "fill-current" : ""} /></button><button type="button" disabled={remote && (savingVote || busy || deleting)} onClick={() => updateVote(message.id, "down", votes[message.id]?.reason ?? "도움이 되지 않음")} aria-pressed={votes[message.id]?.value === "down"} className="message-action" aria-label="싫어요"><ThumbsDown className={votes[message.id]?.value === "down" ? "fill-current" : ""} /></button><button type="button" disabled={remote && (busy || deleting || messages.at(-1)?.id !== message.id)} onClick={() => void regenerateMessage(message)} className="message-action" aria-label="답변 다시 생성"><RotateCcw /></button></> : <><button type="button" onClick={() => void beginEdit(message)} className="message-action" aria-label="메시지 편집"><Pencil /></button><button type="button" onClick={() => copyMessage(message)} className="message-action" aria-label="메시지 복사"><Copy /></button></>}
                  </div>
                  {assistant && votes[message.id]?.value === "down" ? <label className="mt-1 block text-[10px] font-bold text-neutral-500">피드백 이유<select disabled={remote && (savingVote || busy || deleting)} value={votes[message.id]?.reason ?? "도움이 되지 않음"} onChange={(event) => updateVote(message.id, "down", event.target.value)} className="ml-2 rounded-lg border border-black/10 bg-white px-2 py-1 text-[10px]" aria-label="싫어요 이유"><option>도움이 되지 않음</option><option>정확하지 않음</option><option>말투가 어색함</option></select></label> : null}
                  {messageText(message).trim() && messageText(message).length <= 4000 && (!remote || isUuid(message.id)) ? <MessageLearningHelp key={messageText(message)} text={messageText(message)} role={assistant ? "assistant" : "user"} disabled={busy || deleting} onUse={(suggestion) => setInput(appendGuidanceHint(input, suggestion))} makeRequest={(mode) => ({
                    conversationId: conversation.id, messageId: message.id, mode,
                    ...(remote ? {} : { demo: { level: createLocalPreferences(window.localStorage).read().settings.learnerLevel, messages: messages.slice(0, messageIndex + 1).map((item) => ({ id: item.id, role: item.role === "user" ? "user" as const : "assistant" as const, text: messageText(item).trim().slice(0, 4000) })).filter((item) => item.text).slice(-8) } }),
                  })} /> : null}
                </div>
              </article>;
            })}
            {status === "submitted" ? <div className="flex items-center gap-3 text-xs text-neutral-400"><CharacterAvatar character={character} size="sm" className="rounded-full" /><span className="flex gap-1"><i className="size-1.5 animate-bounce rounded-full bg-neutral-400" /><i className="size-1.5 animate-bounce rounded-full bg-neutral-400 [animation-delay:120ms]" /><i className="size-1.5 animate-bounce rounded-full bg-neutral-400 [animation-delay:240ms]" /></span>{character.name}가 생각하고 있어요</div> : null}
            {remote && (pendingRequest || hasToolApprovalResponse(messages.at(-1))) && !busy && !error && !editingId ? <button type="button" disabled={deleting} onClick={retryLastMessage} className="rounded-xl bg-indigo-700 px-4 py-3 text-sm font-bold text-white">저장된 메시지 답변 이어받기</button> : null}
            {error ? <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-red-900" role="alert" data-testid="chat-error"><div className="flex items-start gap-3"><AlertTriangle className="mt-0.5 size-4 shrink-0" /><div><p className="text-sm font-black">답변을 가져오지 못했어요.</p><p className="mt-1 text-xs text-red-700">연결을 확인한 뒤 같은 메시지를 다시 시도할 수 있어요.</p><button type="button" onClick={retryLastMessage} className="mt-3 rounded-lg bg-red-700 px-3 py-2 text-xs font-bold text-white">다시 시도</button></div></div></div> : null}
          </div>
        </div>

        <div className="shrink-0 border-t border-black/6 bg-white px-3 py-3 sm:px-6"><div className="mx-auto max-w-3xl">
          {guidance ? <MissionGuidancePanel guidance={guidance} open={guidanceOpen} onOpenChange={setGuidanceOpen} disabled={busy || deleting || !missionReady || missionRunQuery.isFetching} onRetry={() => void missionRunQuery.refetch()} onInsert={(hint) => setInput(appendGuidanceHint(input, hint))} /> : null}
          <div className="mb-2 flex gap-2 overflow-x-auto pb-1" aria-label="추천 문장">{suggestions.map((suggestion) => <button key={suggestion.english} type="button" disabled={deleting} onClick={() => setInput(suggestion.english)} className="shrink-0 rounded-full bg-[#f1f2ff] px-3 py-2 text-[11px] font-bold text-[#444a9d] hover:bg-[#e7e8ff]">{suggestion.english}</button>)}</div>
          {attachment ? <div className="mb-2 flex max-w-sm items-center gap-3 overflow-hidden rounded-xl bg-neutral-100 p-2 text-xs" data-testid="attachment-preview">{attachment.mediaType.startsWith("image/") ? <img src={chatFileDisplayUrl(attachment.url)} alt="첨부 미리보기" className="size-12 rounded-lg object-cover" /> : <div className="grid size-12 place-items-center rounded-lg bg-white"><Clipboard className="size-5" /></div>}<span className="min-w-0 flex-1 truncate">{attachment.filename}<small className="block text-neutral-400">{Math.ceil(attachment.size / 1024)} KB</small></span><button type="button" disabled={deleting} onClick={clearAttachment} aria-label="첨부 제거"><X className="size-3.5" /></button></div> : null}
          {readingAttachment ? <div className="mb-2 flex items-center justify-between text-xs" role="status"><span>첨부파일을 읽고 있어요…</span><button type="button" onClick={cancelAttachmentRead}>파일 읽기 취소</button></div> : null}
          {attachmentError ? <p className="mb-2 rounded-xl bg-red-50 px-3 py-2 text-xs font-semibold text-red-700" role="alert">{attachmentError}</p> : null}
          {editingId ? <div className="mb-2 flex items-center justify-between rounded-xl bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800"><span>메시지를 수정하면 이후 답변이 새 분기로 생성돼요.</span><button type="button" disabled={deleting} onClick={cancelEdit}>취소</button></div> : null}
          {input.startsWith("/") ? <div className="mb-2 grid max-h-56 gap-1 overflow-y-auto rounded-2xl border border-black/8 bg-white p-2 shadow-lg" role="listbox" aria-label="채팅 명령어" data-testid="slash-command-menu">{slashCommands.filter(([command]) => command.startsWith(input.trim()) || input.trim() === "/").map(([command, label]) => <button key={command} type="button" disabled={deleting} onClick={() => setInput(command)} className="flex items-center justify-between rounded-xl px-3 py-2 text-left text-xs hover:bg-[#f1f2ff]" role="option" aria-selected="false"><span><strong className="text-[#5763d7]">{command}</strong><span className="ml-2 text-neutral-500">{label}</span></span><span className="text-neutral-300">↵</span></button>)}</div> : null}
          {!missionReady ? <div role={missionStartError ? "alert" : "status"} data-testid="mission-start-status" className="mb-2 rounded-xl bg-amber-50 p-3 text-xs text-amber-950">
            <p>{missionStartError ? `미션 실행을 시작하지 못했어요. ${missionStartError.message}` : "미션 실행을 준비하고 있어요. 입력한 문장은 유지됩니다."}</p>
            {missionStartError ? <button type="button" disabled={startMissionRun.isPending || missionRunQuery.isFetching} onClick={() => {
              if (conversation.missionRunId) { void missionRunQuery.refetch(); return; }
              if (startMissionRun.variables) startMissionRun.mutate(startMissionRun.variables, { onSuccess: (run) => saveMockConversation({ missionRunId: run.id }) });
            }} className="mt-2 rounded-lg border px-3 py-2 font-bold">미션 시작 다시 시도</button> : null}
          </div> : null}
          <form onSubmit={submit} className="flex items-end gap-2 rounded-[1.4rem] border border-black/10 bg-[#faf8f4] p-2 ring-[#5763d7]/20 focus-within:ring-3">
            <input ref={fileInputRef} disabled={deleting || busy} type="file" accept="image/png,image/jpeg,application/pdf" className="sr-only" aria-label="파일 첨부" onChange={(event) => { const file = event.currentTarget.files?.[0]; event.currentTarget.value = ""; void chooseAttachment(file); }} />
            <button type="button" disabled={deleting || busy} onClick={() => fileInputRef.current?.click()} className="grid size-10 shrink-0 place-items-center rounded-xl text-neutral-500 hover:bg-white" aria-label="이미지 또는 문서 첨부"><Paperclip className="size-4" /></button>
            <label className="flex-1"><span className="sr-only">영어 메시지</span><textarea onPaste={pasteAttachment} disabled={deleting} value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); event.currentTarget.form?.requestSubmit(); } }} rows={1} placeholder="영어로 말해 보세요..." className="max-h-28 min-h-10 w-full resize-none bg-transparent px-2 py-2.5 text-sm outline-none" data-testid="chat-input" /></label>
            {busy ? <button type="button" onClick={stop} className="grid size-10 shrink-0 place-items-center rounded-xl bg-neutral-950 text-white" aria-label="답변 생성 중지"><Square className="size-3 fill-current" /></button> : <button type="submit" disabled={!missionReady || deleting || readingAttachment || (!input.trim() && !attachment)} className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#5763d7] text-white disabled:opacity-35" aria-label={editingId ? "수정한 메시지 보내기" : "메시지 보내기"}><Send className="size-4" /></button>}
          </form><p className="mt-1.5 text-center text-[9px] text-neutral-400">AI는 실수할 수 있어요. 학습에 중요한 표현은 다시 확인하세요.</p>
        </div></div>
      </section>

      <aside className="hidden overflow-y-auto border-l border-black/6 bg-[#f7f4ef] p-5 lg:block"><div className="flex items-center justify-between"><div><p className="text-[10px] font-black uppercase tracking-[.18em] text-[#5763d7]">Learning artifact</p><h2 className="mt-1 font-black">오늘의 표현 노트</h2></div><Clipboard className="size-4 text-neutral-400" /></div><div className="mt-5 space-y-3">{suggestions.map((phrase) => <article key={phrase.english} className="rounded-2xl bg-white p-4 shadow-sm"><p className="text-sm font-bold leading-5">{phrase.english}</p><p className="mt-1 text-xs text-neutral-500">{phrase.korean}</p><button type="button" disabled={deleting} onClick={() => setInput(phrase.english)} className="mt-3 text-[10px] font-bold text-[#5763d7]">이 문장 사용하기</button></article>)}</div><div className="mt-6 rounded-2xl bg-[#fff1ec] p-4"><div className="flex items-center gap-2 text-xs font-black text-[#d85c40]"><Lightbulb className="size-4" /> 학습 팁</div><p className="mt-2 text-xs leading-5 text-neutral-600">긴 문장보다 한 번에 한 가지 의도를 말해 보세요. 캐릭터가 자연스러운 후속 질문을 이어 줍니다.</p></div>{missionPanel}</aside>
    </div>

    {notesOpen ? <div className="fixed inset-0 z-50 flex items-end bg-black/35 p-3 lg:hidden" role="dialog" aria-modal="true" aria-labelledby="mobile-notes-title" data-testid="mobile-learning-notes"><div className="max-h-[82svh] w-full overflow-y-auto rounded-[1.7rem] bg-[#f7f4ef] p-5 shadow-2xl"><div className="flex items-start justify-between"><div><p className="text-[10px] font-black uppercase tracking-[.18em] text-[#5763d7]">Learning artifact</p><h2 id="mobile-notes-title" className="mt-1 text-xl font-black">오늘의 표현 노트</h2></div><button type="button" onClick={() => setNotesOpen(false)} className="grid size-9 place-items-center rounded-xl bg-white" aria-label="학습 노트 닫기"><X className="size-4" /></button></div><div className="mt-5 space-y-2">{suggestions.map((phrase) => <button key={phrase.english} type="button" onClick={() => { setInput(phrase.english); setNotesOpen(false); }} className="block w-full rounded-2xl bg-white p-4 text-left"><span className="block text-sm font-bold">{phrase.english}</span><span className="mt-1 block text-xs text-neutral-500">{phrase.korean}</span></button>)}</div>{missionPanel}</div></div> : null}

    {shareOpen && shareToken ? <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-5" role="dialog" aria-modal="true" aria-labelledby="share-title"><div className="w-full max-w-md rounded-[1.5rem] bg-white p-6 shadow-2xl"><div className="flex items-start justify-between"><div><h2 id="share-title" className="text-xl font-black">대화 공유</h2><p className="mt-1 text-sm text-neutral-500">학습 대화를 읽기 전용 링크로 공유해요.</p></div><button type="button" onClick={() => setShareOpen(false)} className="grid size-9 place-items-center rounded-xl hover:bg-neutral-100" aria-label="공유 창 닫기"><X className="size-4" /></button></div><div className="mt-5 flex items-center gap-2 rounded-xl bg-neutral-100 p-2"><code className="min-w-0 flex-1 truncate px-2 text-xs" data-testid="share-link">lingua.local/shared/{shareToken}</code><button type="button" onClick={() => navigator.clipboard?.writeText(`${window.location.origin}/shared/${shareToken}`)} className="inline-flex items-center gap-1 rounded-lg bg-neutral-950 px-3 py-2 text-xs font-bold text-white"><Copy className="size-3" /> 복사</button></div><Link href={`/shared/${shareToken}`} className="mt-3 inline-flex text-xs font-bold text-[#5763d7]">읽기 전용 화면 열기</Link></div></div> : null}

    {manageOpen ? <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-5" role="dialog" aria-modal="true" aria-labelledby="manage-title"><div className="w-full max-w-md rounded-[1.5rem] bg-white p-6 shadow-2xl"><div className="flex items-start justify-between"><div><h2 id="manage-title" className="text-xl font-black">대화 관리</h2><p className="mt-1 text-xs text-neutral-500">ID: {conversation.id}</p></div><button type="button" onClick={() => setManageOpen(false)} aria-label="대화 관리 닫기"><X className="size-4" /></button></div><label className="mt-5 block text-xs font-bold">대화 제목<input value={title} onChange={(event) => setTitle(event.target.value)} className="mt-2 h-11 w-full rounded-xl border border-black/10 px-3 text-sm" aria-label="대화 제목" /></label><button type="button" onClick={saveTitle} className="mt-3 w-full rounded-xl bg-neutral-950 px-4 py-3 text-xs font-bold text-white">제목 저장</button><button type="button" onClick={() => { setManageOpen(false); setDestructiveAction("delete"); }} className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-red-50 px-4 py-3 text-xs font-bold text-red-700"><Trash2 className="size-3.5" /> 대화 삭제</button></div></div> : null}

    {destructiveAction ? <div className="fixed inset-0 z-[60] grid place-items-center bg-black/55 p-5" role="dialog" aria-modal="true" aria-labelledby="destructive-title"><div className="w-full max-w-md rounded-[1.5rem] bg-white p-6 shadow-2xl"><h2 id="destructive-title" className="text-xl font-black">{destructiveAction === "purge" ? "모든 대화를 삭제할까요?" : destructiveAction === "clear" ? "메시지를 초기화할까요?" : "이 대화를 삭제할까요?"}</h2><p className="mt-2 text-sm leading-6 text-neutral-500">{destructiveAction === "purge" ? "저장된 대화와 Artifact가 모두 사라집니다. 계속하려면 DELETE ALL을 입력하세요." : destructiveAction === "clear" ? "현재 대화의 메시지와 메시지 평가를 지웁니다. 대화 제목, Artifact, 미션 진행과 기존 결과는 유지됩니다. 삭제한 메시지는 복구할 수 없어요." : "삭제한 대화는 기록에서도 사라지며 복구할 수 없어요."}</p>{destructiveAction === "purge" ? <label className="mt-4 block text-xs font-bold">확인 문구<input value={purgeConfirmation} onChange={(event) => setPurgeConfirmation(event.target.value)} className="mt-2 h-11 w-full rounded-xl border border-black/10 px-3" aria-label="모든 대화 삭제 확인 문구" placeholder="DELETE ALL" /></label> : null}{actionError ? <p role="alert" className="mt-3 text-sm text-red-700">{actionError}</p> : null}<div className="mt-5 grid grid-cols-2 gap-2"><button type="button" disabled={deleting} onClick={() => { setDestructiveAction(undefined); setPurgeConfirmation(""); }} className="rounded-xl border border-black/10 px-4 py-3 text-xs font-bold">취소</button><button type="button" onClick={confirmDestructiveAction} disabled={deleting || busy || (destructiveAction === "purge" && purgeConfirmation !== "DELETE ALL")} className="rounded-xl bg-red-700 px-4 py-3 text-xs font-bold text-white disabled:opacity-35">{destructiveAction === "purge" ? "모든 대화 삭제 확인" : destructiveAction === "clear" ? "메시지 초기화 확인" : "대화 삭제 확인"}</button></div></div></div> : null}

    {artifactsOpen ? remote ? <RemoteArtifactWorkspace key={conversation.id} conversationId={conversation.id} initialKind={initialArtifactKind} onClose={() => setArtifactsOpen(false)} /> : <ArtifactWorkspace artifacts={artifacts} initialKind={initialArtifactKind} onChange={updateArtifacts} onClose={() => setArtifactsOpen(false)} /> : null}

  </div>;
}
