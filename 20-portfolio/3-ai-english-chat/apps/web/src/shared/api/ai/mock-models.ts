import "server-only";

import {
  MockImageModelV4,
  MockLanguageModelV4,
  MockSpeechModelV4,
  simulateReadableStream,
} from "ai/test";

import type {
  ChatScenario,
  ImageKind,
  MissionDraft,
  MissionDraftScenario,
} from "./contracts";

type LanguageStreamResult = Awaited<
  ReturnType<MockLanguageModelV4["doStream"]>
>;
type LanguageStreamPart =
  LanguageStreamResult["stream"] extends ReadableStream<infer Part>
    ? Part
    : never;

const emptyUsage = {
  inputTokens: {
    total: 12,
    noCache: 12,
    cacheRead: 0,
    cacheWrite: 0,
  },
  outputTokens: {
    total: 18,
    text: 18,
    reasoning: 0,
  },
};

const stopReason = {
  unified: "stop" as const,
  raw: "stop",
};

function chatFixture(scenario?: ChatScenario) {
  switch (scenario) {
    case "chat-hotel-success":
      return [
        "Welcome to the Aurora Hotel! ",
        "May I see your passport, please? ",
        "You can say, ‘I have a reservation under my name.’",
      ];
    case "chat-correction":
      return [
        "Nice try! A more natural sentence is: ",
        "‘I have a reservation under Kim.’ ",
        "Please say it once more.",
      ];
    case "chat-slow":
      return [
        "Let’s practice slowly. ",
        "First, greet the hotel clerk. ",
        "Then, say that you have a reservation.",
      ];
    case "chat-tool-approval":
      return [
        "I need your approval before using an external tool. ",
        "We can continue the English practice without it.",
      ];
    default:
      return [
        "Hello! I’m your English conversation partner. ",
        "What real-life situation would you like to practice today?",
      ];
  }
}

export function createMockMissionDraft(): MissionDraft {
  return {
    title: "Check In at a Hotel",
    place: "Hotel front desk",
    situation:
      "You have arrived at a hotel and need to confirm your reservation, show identification, and ask about breakfast.",
    learnerRole: "Hotel guest",
    characterRole: "Friendly front-desk clerk",
    level: "A1",
    durationMinutes: 10,
    objectives: [
      {
        id: "confirm-reservation",
        label: "Confirm the reservation using your name",
        successEvidence: ["Says they have a reservation", "Provides a name"],
        required: true,
      },
      {
        id: "ask-breakfast",
        label: "Ask when or where breakfast is served",
        successEvidence: ["Uses a clear question about breakfast"],
        required: true,
      },
    ],
    phrases: [
      {
        english: "I have a reservation under Kim.",
        korean: "Kim이라는 이름으로 예약했습니다.",
      },
      {
        english: "May I check in, please?",
        korean: "체크인할 수 있을까요?",
      },
      {
        english: "What time is breakfast?",
        korean: "아침 식사는 몇 시인가요?",
      },
    ],
    hints: [
      {
        intent: "Confirm a booking",
        expression: "I have a reservation under ...",
        example: "I have a reservation under Minji Park.",
      },
      {
        intent: "Ask about breakfast",
        expression: "What time is breakfast?",
        example: "Excuse me, what time is breakfast?",
      },
    ],
    rubric: {
      taskCompletion: 40,
      appropriateness: 25,
      grammar: 20,
      vocabulary: 15,
      passScore: 70,
    },
    minTurns: 4,
    maxTurns: 12,
    rewardImagePrompt:
      "A warm illustrated keepsake of a cheerful traveler receiving a golden hotel key, family-friendly character art",
  };
}

export function createMockLanguageModel(options: {
  modelId: string;
  operation: "chat" | "mission-draft" | "learning-assistance" | "image" | "speech";
  scenario?: ChatScenario | MissionDraftScenario;
}) {
  const generatedText =
    options.operation === "mission-draft"
      ? JSON.stringify(createMockMissionDraft())
      : chatFixture(options.scenario as ChatScenario | undefined).join("");

  const doGenerate: MockLanguageModelV4["doGenerate"] = async (callOptions) => {
    let text = generatedText;
    if (options.operation === "learning-assistance") {
      const user = callOptions.prompt.findLast((message) => message.role === "user");
      const part = user && Array.isArray(user.content) ? user.content.find((item) => item.type === "text") : undefined;
      const input = JSON.parse(part?.type === "text" ? part.text : "{}");
      text = JSON.stringify({ suggestion: input.mode === "reply" ? "Could you help me, please?" : String(input.target?.text ?? "Hello.").replace(/\bI wants\b/gi, "I want"), brief: "데모 학습 도움말입니다.", explanation: "실제 AI의 언어 판단이 아닌 테스트용 예시입니다. 문장을 상황에 맞게 확인하고 고쳐 사용해 주세요." });
    }
    return {
    content: [{ type: "text", text }],
    finishReason: stopReason,
    usage: emptyUsage,
    warnings: [],
    };
  };

  const doStream: MockLanguageModelV4["doStream"] = async (callOptions) => {
    const textId = "mock-text-1";
    const serializedPrompt = JSON.stringify(callOptions.prompt);
    const isApprovalFollowUp =
      options.scenario === "chat-tool-approval" &&
      serializedPrompt.includes('"type":"tool-result"');
    const approvalWasDenied = serializedPrompt.includes('"type":"execution-denied"');

    if (options.scenario === "chat-tool-approval" && !isApprovalFollowUp && callOptions.tools?.some((entry) => entry.name === 'weather')) {
      const toolCallId = "mock-weather-call-1";
      const toolInput = JSON.stringify({ location: "Seoul" });
      const chunks: LanguageStreamPart[] = [
        { type: "stream-start", warnings: [] },
        { type: "tool-input-start", id: toolCallId, toolName: "weather" },
        { type: "tool-input-delta", id: toolCallId, delta: toolInput },
        { type: "tool-input-end", id: toolCallId },
        {
          type: "tool-call",
          toolCallId,
          toolName: "weather",
          input: toolInput,
        },
        {
          type: "finish",
          finishReason: { unified: "tool-calls", raw: "tool-calls" },
          usage: emptyUsage,
        },
      ];

      return {
        stream: simulateReadableStream({
          chunks,
          initialDelayInMs: null,
          chunkDelayInMs: null,
        }),
      };
    }

    const fixtureParts = chatFixture(
      options.scenario as ChatScenario | undefined,
    );
    if (isApprovalFollowUp) {
      fixtureParts.splice(
        0,
        fixtureParts.length,
        approvalWasDenied
          ? "No problem—I will continue without checking the weather."
          : "The weather tool finished, so we can use that context in our English practice.",
      );
    }
    const chunks: LanguageStreamPart[] = [
      { type: "stream-start", warnings: [] },
      { type: "text-start", id: textId },
      { type: "text-delta", id: textId, delta: fixtureParts[0] },
    ];

    if (options.scenario === "chat-error") {
      chunks.push({
        type: "error",
        error: new Error("Intentional mock provider failure"),
      });
    } else {
      chunks.push(
        ...fixtureParts.slice(1).map(
          (delta): LanguageStreamPart => ({
            type: "text-delta",
            id: textId,
            delta,
          }),
        ),
        { type: "text-end", id: textId },
        {
          type: "finish",
          finishReason: stopReason,
          usage: emptyUsage,
        },
      );
    }

    return {
      stream: simulateReadableStream({
        chunks,
        initialDelayInMs: null,
        chunkDelayInMs: options.scenario === "chat-slow" ? 250 : null,
      }),
    };
  };

  return new MockLanguageModelV4({
    provider: "mock",
    modelId: options.modelId,
    doGenerate,
    doStream,
  });
}

function avatarSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024"><defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#312e81"/><stop offset="1" stop-color="#7c3aed"/></linearGradient></defs><rect width="1024" height="1024" rx="96" fill="url(#bg)"/><circle cx="512" cy="420" r="220" fill="#fde68a"/><circle cx="430" cy="390" r="24" fill="#1f2937"/><circle cx="594" cy="390" r="24" fill="#1f2937"/><path d="M420 500 Q512 570 604 500" fill="none" stroke="#1f2937" stroke-width="24" stroke-linecap="round"/><path d="M270 340 Q512 80 754 340" fill="#312e81"/><text x="512" y="830" text-anchor="middle" font-family="sans-serif" font-size="72" font-weight="700" fill="white">ENGLISH GUIDE</text></svg>`;
}

function rewardSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024"><defs><radialGradient id="bg"><stop stop-color="#fef3c7"/><stop offset="1" stop-color="#f59e0b"/></radialGradient></defs><rect width="1024" height="1024" rx="96" fill="url(#bg)"/><path d="M512 150 L595 365 L826 378 L646 524 L704 750 L512 622 L320 750 L378 524 L198 378 L429 365 Z" fill="#fff7ed" stroke="#b45309" stroke-width="28"/><text x="512" y="900" text-anchor="middle" font-family="sans-serif" font-size="68" font-weight="700" fill="#78350f">MISSION COMPLETE</text></svg>`;
}

function artifactSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024"><rect width="1024" height="1024" rx="96" fill="#ecfeff"/><rect x="190" y="150" width="644" height="724" rx="48" fill="white" stroke="#0891b2" stroke-width="22"/><path d="M300 330 H724 M300 470 H724 M300 610 H620" stroke="#155e75" stroke-width="30" stroke-linecap="round"/><circle cx="730" cy="725" r="105" fill="#06b6d4"/><path d="M685 725 L720 760 L782 690" fill="none" stroke="white" stroke-width="26" stroke-linecap="round" stroke-linejoin="round"/><text x="512" y="965" text-anchor="middle" font-family="sans-serif" font-size="52" font-weight="700" fill="#164e63">LEARNING ARTIFACT</text></svg>`;
}

export function createMockImageModel(modelId: string, kind: ImageKind) {
  const svg =
    kind === "avatar"
      ? avatarSvg()
      : kind === "reward"
        ? rewardSvg()
        : artifactSvg();

  const doGenerate: MockImageModelV4["doGenerate"] = async () => ({
    images: [new TextEncoder().encode(svg)],
    warnings: [],
    response: {
      timestamp: new Date("2026-01-01T00:00:00.000Z"),
      modelId,
      headers: undefined,
    },
    usage: {
      inputTokens: 1,
      outputTokens: 1,
      totalTokens: 2,
    },
  });

  return new MockImageModelV4({
    provider: "mock",
    modelId,
    maxImagesPerCall: 1,
    doGenerate,
  });
}

function createPlayableWav() {
  const sampleRate = 16_000;
  const durationSeconds = 0.4;
  const sampleCount = Math.floor(sampleRate * durationSeconds);
  const bytesPerSample = 2;
  const dataSize = sampleCount * bytesPerSample;
  const wav = new Uint8Array(44 + dataSize);
  const view = new DataView(wav.buffer);

  const writeAscii = (offset: number, value: string) => {
    for (let index = 0; index < value.length; index += 1) {
      view.setUint8(offset + index, value.charCodeAt(index));
    }
  };

  writeAscii(0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeAscii(8, "WAVE");
  writeAscii(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * bytesPerSample, true);
  view.setUint16(32, bytesPerSample, true);
  view.setUint16(34, 16, true);
  writeAscii(36, "data");
  view.setUint32(40, dataSize, true);

  for (let index = 0; index < sampleCount; index += 1) {
    const fade = Math.sin((Math.PI * index) / sampleCount);
    const sample = Math.sin((2 * Math.PI * 440 * index) / sampleRate);
    view.setInt16(44 + index * 2, Math.round(sample * fade * 3_000), true);
  }

  return wav;
}

export function createMockSpeechModel(modelId: string) {
  const doGenerate: MockSpeechModelV4["doGenerate"] = async () => ({
    audio: createPlayableWav(),
    warnings: [],
    response: {
      timestamp: new Date("2026-01-01T00:00:00.000Z"),
      modelId,
    },
  });

  return new MockSpeechModelV4({
    provider: "mock",
    modelId,
    doGenerate,
  });
}
