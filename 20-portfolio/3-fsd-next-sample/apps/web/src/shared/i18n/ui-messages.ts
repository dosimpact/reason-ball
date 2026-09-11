// Interface copy only. Stored lessons, learner text and AI explanations are domain data.
export type UiMessages = {
  languageTag: string;
  missionResult: {
    passedEyebrow: string; practiceEyebrow: string; passedTitle: string; practiceTitle: string;
    characterReaction: string; characterReactionLabel: (name: string) => string;
    scorePurpose: string; totalScore: string; stars: (count: number) => string; rewardUnlocked: string;
    strengths: string; improvements: string; corrections: string; reviewNote: string;
    goals: string; goalCompleted: string; goalRemaining: string; newExpressions: string; noSavedExpressions: string;
    nextMission: string; recommendationLoading: string; recommendationFailed: string; reloadRecommendation: string; recommendationReason: string; noRecommendation: string;
    reviewNoteHelp: string; reviewNotePlaceholder: string; noteSaved: string; saving: string; saveNote: string;
  };
  audio: {
    labels: Record<"idle" | "loading" | "playing" | "paused" | "error", string>;
    announcements: Record<"idle" | "loading" | "playing" | "paused" | "error", string>;
    voice: string; rate: string; disclosure: string; reloadPreferences: string;
  };
  learningHelp: {
    title: string; rephrase: string; correction: string; reply: string; loading: string;
    changedMessage: string; failed: string; invalidInput: string; preserved: string; retry: string;
    explanation: string; append: string; demo: string; generated: string; persistenceNotice: string;
  };
};

export const koreanUiMessages: UiMessages = {
  languageTag: "ko",
  missionResult: {
    characterReaction: "해냈어요! 함께 연습한 시간이 멋진 장면이 됐네요. 다음 대화도 기대할게요.",
    characterReactionLabel: name => `${name}의 축하 인사`,
    passedEyebrow: "Mission passed", practiceEyebrow: "Keep practicing",
    passedTitle: "미션을 해결했어요!", practiceTitle: "거의 다 왔어요", totalScore: "Total score",
    scorePurpose: "학습을 돕기 위한 평가이며 공인 시험 점수가 아니에요.",
    stars: count => `${count}점 별점`, rewardUnlocked: "보상 해금",
    strengths: "잘한 점", improvements: "다음 연습", corrections: "더 자연스러운 표현",
    goals: "목표별 결과", goalCompleted: "달성", goalRemaining: "다음에 연습할 목표", newExpressions: "새로 익힐 표현", noSavedExpressions: "이 평가에는 저장된 새 표현이 없어요.",
    nextMission: "다음 추천 미션", recommendationLoading: "다음 미션을 확인하고 있어요.", recommendationFailed: "다음 미션을 불러오지 못했어요.", reloadRecommendation: "추천 다시 불러오기", recommendationReason: "현재 수준과 완료한 선수 미션을 기준으로 추천해요.", noRecommendation: "현재 조건에 맞는 새로운 미션이 없어요.",
    reviewNote: "나만의 복습 메모", reviewNoteHelp: "다음 시도에서 기억하고 싶은 표현이나 목표를 적어 두세요.",
    reviewNotePlaceholder: "예: Could I check in?을 먼저 말해 보기", noteSaved: "복습 메모를 저장했어요.",
    saving: "저장 중…", saveNote: "메모 저장",
  },
  audio: {
    labels: { idle: "AI 음성 듣기", loading: "음성 불러오는 중", playing: "음성 일시정지", paused: "음성 이어 듣기", error: "음성 다시 시도" },
    announcements: { idle: "", loading: "음성을 불러오는 중입니다.", playing: "음성을 재생하고 있습니다.", paused: "음성이 일시정지되었습니다.", error: "음성을 재생하지 못했어요. 다시 시도할 수 있습니다." },
    voice: "AI 음성", rate: "재생 속도", disclosure: "AI로 생성된 음성입니다.", reloadPreferences: "음성 설정 다시 불러오기",
  },
  learningHelp: {
    title: "학습 도움", rephrase: "쉽게 바꾸기", correction: "문장 교정", reply: "답변 추천", loading: "학습 도움말을 만들고 있어요…",
    changedMessage: "메시지가 변경됐어요. 대화를 다시 불러온 후 요청해 주세요.", failed: "학습 도움말을 가져오지 못했어요.",
    invalidInput: "학습 설정이나 메시지를 읽지 못했어요. 기존 데이터를 초기화하지 않았습니다. 확인 후 다시 요청해 주세요.",
    preserved: "원래 메시지와 입력창은 유지됩니다.", retry: "학습 도움 다시 시도", explanation: "자세한 설명",
    append: "도움 문장을 입력창에 덧붙이기", demo: "데모 예시", generated: "AI 생성 도움말",
    persistenceNotice: "원문을 바꾸지 않으며 대화 기록에는 저장되지 않습니다. 새로고침 후 다시 요청할 수 있어요.",
  },
};
