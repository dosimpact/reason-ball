import type { ConversationStarterGroup } from "@/shared/ui/agent-conversation";

export const generalStarterGroups: ConversationStarterGroup[] = [
  {
    title: "대화 시작",
    description: "질문과 설명을 편하게 요청하세요.",
    starters: [
      { displayText: "할 수 있는 일", prompt: "안녕하세요. 어떤 질문에 답할 수 있는지 간단히 소개해 줘." },
      { displayText: "어려운 개념 쉽게", prompt: "복리의 개념을 중학생도 이해할 수 있게 예시로 설명해 줘." },
      { displayText: "장단점 정리", prompt: "원격 근무의 장점과 단점을 각각 세 가지씩 정리해 줘." },
      { displayText: "단계별 설명", prompt: "새로운 프로그래밍 언어를 공부할 때 첫 일주일 계획을 단계별로 알려줘." },
    ],
  },
  {
    title: "글쓰기 · 정리",
    description: "초안과 구조를 함께 다듬습니다.",
    starters: [
      { displayText: "이메일 초안", prompt: "회의 일정 변경을 정중하게 알리는 이메일 초안을 작성해 줘." },
      { displayText: "요약 방법", prompt: "긴 글을 핵심 주장과 근거로 나눠 요약하는 방법을 예시와 함께 알려줘." },
      { displayText: "발표 개요", prompt: "5분 발표를 준비할 때 도입·본론·마무리 개요를 만들어 줘. 주제는 생산성 향상이야." },
      { displayText: "질문 다듬기", prompt: "AI에게 더 정확한 답을 얻을 수 있도록 질문을 구체화하는 방법을 알려줘." },
    ],
  },
  {
    title: "생각 · 학습",
    description: "아이디어와 학습 과정을 돕습니다.",
    starters: [
      { displayText: "아이디어 브레인스토밍", prompt: "작은 독서 모임의 참여도를 높일 수 있는 아이디어 다섯 가지를 제안해 줘." },
      { displayText: "비교해서 배우기", prompt: "REST와 GraphQL의 차이를 구체적인 API 요청 예시로 설명해 줘." },
      { displayText: "퀴즈 만들기", prompt: "기초 통계의 평균·중앙값·최빈값을 복습할 수 있는 퀴즈 세 개를 만들어 줘." },
      { displayText: "반론 찾기", prompt: "팀의 모든 회의를 비동기로 바꾸자는 주장에 대해 예상되는 반론을 정리해 줘." },
    ],
  },
  {
    title: "날씨 도구 · 일상",
    description: "현재 날씨 질문은 연결된 도구로 확인합니다.",
    starters: [
      { displayText: "서울 현재 날씨", prompt: "서울의 현재 날씨를 도구로 확인해 알려줘." },
      { displayText: "부산 현재 날씨", prompt: "부산의 현재 날씨를 도구로 확인하고 옷차림을 간단히 제안해 줘." },
      { displayText: "도쿄 현재 날씨", prompt: "도쿄의 현재 날씨를 도구로 확인해 줘." },
      { displayText: "날씨 도구 설명", prompt: "현재 날씨를 물으면 어떤 방식으로 확인하는지 설명해 줘. 지금은 조회하지 마." },
    ],
  },
];

export const secResearchStarterGroups: ConversationStarterGroup[] = [
  {
    title: "기업 · 공시 찾기",
    description: "저장된 SEC 기업과 공시부터 확인합니다.",
    starters: [
      { displayText: "AAPL 기업 찾기", prompt: "저장된 SEC 기업에서 AAPL을 찾아 CIK와 회사명을 확인해 줘." },
      { displayText: "AAPL 10-K 목록", prompt: "AAPL의 저장된 최근 10-K 공시 목록을 제출일과 accession number와 함께 보여줘." },
      { displayText: "MSFT 10-Q 목록", prompt: "MSFT의 저장된 최근 10-Q 공시를 찾아 보고 기간과 제출일을 구분해 줘." },
      { displayText: "수정 공시 확인", prompt: "AAPL의 저장된 최근 10-K와 10-K/A를 찾아 원본과 수정 공시를 구분해 줘." },
    ],
  },
  {
    title: "사업 · 위험 요인",
    description: "원문 항목을 확인하고 근거를 연결합니다.",
    starters: [
      { displayText: "사업 개요", prompt: "AAPL의 저장된 최근 10-K에서 사업 개요를 찾아 공시의 해당 부분과 함께 요약해 줘." },
      { displayText: "수익 구조", prompt: "MSFT의 저장된 최근 10-K에서 주요 사업과 수익 구조를 찾아 원문 근거를 붙여 설명해 줘." },
      { displayText: "위험 요인", prompt: "NVDA의 저장된 최근 10-K에서 핵심 위험 요인을 찾아 공시 근거와 함께 정리해 줘." },
      { displayText: "경영진 논의", prompt: "AMZN의 저장된 최근 10-K에서 MD&A의 주요 논점을 찾아 기간과 근거를 명시해 줘." },
    ],
  },
  {
    title: "재무 공시 읽기",
    description: "보고 기간과 단위를 확인하며 비교합니다.",
    starters: [
      { displayText: "매출 근거 확인", prompt: "AAPL의 저장된 최근 10-K에서 매출 관련 수치를 찾아 기간·단위·원문 근거를 함께 보여줘." },
      { displayText: "현금 흐름", prompt: "MSFT의 저장된 최근 10-K에서 영업현금흐름 설명과 수치를 찾아 보고 기간과 원문을 연결해 줘." },
      { displayText: "부문별 성과", prompt: "AMZN의 저장된 최근 10-K에서 사업 부문별 성과를 찾아 공시에서 확인되는 범위만 요약해 줘." },
      { displayText: "전년 비교", prompt: "AAPL의 저장된 최근 10-K에서 명시된 전년 대비 실적 변화를 찾아 동일 단위와 기간으로 비교해 줘." },
    ],
  },
  {
    title: "모델링 근거 탐색",
    description: "게시된 검색 결과와 원문 증거를 구분합니다.",
    starters: [
      { displayText: "사업 근거 검색", prompt: "AAPL의 저장된 최근 10-K를 확인한 뒤 게시된 모델링 근거에서 사업 설명을 검색하고 원문 증거를 보여줘. 결과가 없으면 모델링 상태와 구분해 설명해 줘." },
      { displayText: "위험 근거 검색", prompt: "NVDA의 저장된 최근 10-K에서 게시된 위험 요인 관련 근거를 검색하고 원문과 연결해 줘." },
      { displayText: "XBRL 사실 조회", prompt: "MSFT의 저장된 최근 10-K에서 게시된 XBRL 사실을 조회해 기간·단위·출처를 함께 설명해 줘. 선택된 사실의 범위를 밝혀줘." },
      { displayText: "검색 결과 한계", prompt: "AAPL 최근 10-K의 게시된 모델링 근거를 검색하고, 검색 결과가 비어 있으면 그 의미와 추가로 확인해야 할 사항을 설명해 줘." },
    ],
  },
  {
    title: "기업 · 기간 비교",
    description: "각 공시의 범위를 맞춰 조사합니다.",
    starters: [
      { displayText: "두 기업 사업 비교", prompt: "AAPL과 MSFT의 저장된 최근 10-K에서 사업 개요를 각각 확인하고 근거를 분리해 비교해 줘." },
      { displayText: "두 기업 위험 비교", prompt: "NVDA와 AMD의 저장된 최근 10-K에서 공통점과 차이점이 드러나는 위험 요인을 근거와 함께 비교해 줘." },
      { displayText: "연도별 변화", prompt: "AAPL의 저장된 최근 두 건의 10-K에서 사업 설명의 주요 변화를 확인하고 각 연도 원문 근거를 연결해 줘." },
      { displayText: "10-K·10-Q 구분", prompt: "MSFT의 저장된 최근 10-K와 10-Q에서 보고 범위와 기간의 차이를 확인하고 비교할 때 주의할 점을 설명해 줘." },
    ],
  },
  {
    title: "조사 범위 · 갱신",
    description: "자료 범위와 수집 여부를 명확히 합니다.",
    starters: [
      { displayText: "저장 자료 범위", prompt: "AAPL에 대해 현재 저장된 SEC 기업·공시 자료의 범위를 조회하고 아직 확인되지 않은 자료를 구분해 줘." },
      { displayText: "근거 있는 보고서", prompt: "AAPL의 저장된 최근 10-K를 근거로 사업·위험·재무를 간단한 리서치 보고서로 작성하고 제출일과 출처를 명시해 줘." },
      { displayText: "조사 절차 설명", prompt: "SEC 공시 리서치에서 사용할 수 있는 조회·원문·게시된 모델링 근거 도구와 조사 절차를 설명해 줘. 지금은 수집하거나 분석을 실행하지 마." },
      { displayText: "최신 공시 확인", prompt: "AAPL의 최신 10-K가 저장되어 있는지 확인해 줘. 저장 자료가 부족하면 AAPL의 필요한 범위만 새로 확인하고 결과를 알려줘." },
    ],
  },
];

export const secModelingStarterGroups: ConversationStarterGroup[] = [
  {
    title: "공시 · 모델 상태",
    description: "식별자와 게시 상태를 먼저 확인합니다.",
    starters: [
      { displayText: "AAPL 모델 상태", prompt: "AAPL의 저장된 최근 10-K와 모델링 1·2·3단계 게시 상태를 확인해 줘." },
      { displayText: "MSFT 모델 상태", prompt: "MSFT의 저장된 최근 10-K에서 모델 1·2·3의 게시 상태와 세대 정보를 확인해 줘." },
      { displayText: "10-Q 모델 상태", prompt: "AAPL의 저장된 최근 10-Q를 찾고 모델 3 게시 상태를 확인해 줘." },
      { displayText: "모델링 도구 안내", prompt: "SEC 모델링의 조회·검색·실행 도구와 필요한 CIK, accession number를 설명해 줘. 지금 작업을 실행하지 마." },
    ],
  },
  {
    title: "모델 1 · 문서 구조",
    description: "추출된 Item과 원문 근거를 살펴봅니다.",
    starters: [
      { displayText: "Item 목록", prompt: "AAPL의 저장된 최근 10-K에서 게시된 모델 1 Item 목록과 원문 연결 상태를 보여줘." },
      { displayText: "사업 Item", prompt: "MSFT의 저장된 최근 10-K에서 모델 1이 추출한 Business Item을 확인하고 원문 증거를 보여줘." },
      { displayText: "위험 Item", prompt: "NVDA의 저장된 최근 10-K에서 모델 1 Risk Factors Item의 결과와 원문 근거를 확인해 줘." },
      { displayText: "추출 누락 점검", prompt: "AAPL의 저장된 최근 10-K에서 모델 1 게시 결과와 실제 공시 원문을 비교해 확인 가능한 Item 범위와 한계를 설명해 줘." },
    ],
  },
  {
    title: "모델 2 · 사업 지식",
    description: "게시된 사업 지식을 근거로 읽습니다.",
    starters: [
      { displayText: "사업 지식 검색", prompt: "AAPL의 저장된 최근 10-K에서 게시된 모델 2 사업 지식을 검색하고 원문 근거를 보여줘." },
      { displayText: "수익 구조 검색", prompt: "MSFT의 저장된 최근 10-K에서 모델 2의 수익 구조 관련 결과를 검색하고 공시 원문과 연결해 줘." },
      { displayText: "모델 2 최신성", prompt: "AAPL의 저장된 최근 10-K에서 모델 1과 모델 2의 게시 세대를 비교하고 모델 2 결과가 현재인지 확인해 줘." },
      { displayText: "검색 결과 한계", prompt: "NVDA의 저장된 최근 10-K에서 모델 2 근거를 검색하고, 결과가 비어 있으면 게시 상태와 검색 범위의 한계를 설명해 줘." },
    ],
  },
  {
    title: "모델 3 · XBRL",
    description: "선택된 사실의 단위와 출처를 확인합니다.",
    starters: [
      { displayText: "선택된 XBRL 사실", prompt: "AAPL의 저장된 최근 10-K에서 게시된 모델 3의 선택된 XBRL 사실을 조회하고 기간·단위·출처를 보여줘." },
      { displayText: "카테고리별 사실", prompt: "MSFT의 저장된 최근 10-K에서 모델 3의 분석 카테고리별 선택 사실과 분류 근거를 확인해 줘." },
      { displayText: "차원과 단위", prompt: "NVDA의 저장된 최근 10-K에서 모델 3의 선택 사실 몇 건을 조회해 차원·기간·단위가 비교 가능한지 설명해 줘." },
      { displayText: "선정 범위 설명", prompt: "모델 3이 게시한 비 us-gaap 선택 사실의 범위와, 전체 XBRL 사실 목록과 다른 점을 설명해 줘. 실행은 하지 마." },
    ],
  },
  {
    title: "실행 기록 · 결과",
    description: "실행 성공과 게시 결과를 따로 확인합니다.",
    starters: [
      { displayText: "최근 실행 기록", prompt: "AAPL의 저장된 최근 10-K에 대한 모델링 실행 기록을 조회하고 각 단계의 상태를 요약해 줘." },
      { displayText: "실패 원인 확인", prompt: "MSFT의 저장된 최근 10-K에 실패한 모델링 실행이 있는지 확인하고 기록된 오류와 후속 확인 사항을 설명해 줘. 재시도는 하지 마." },
      { displayText: "실행·게시 비교", prompt: "AAPL의 저장된 최근 10-K에서 가장 최근 모델링 실행 기록과 현재 게시 세대를 비교해 줘." },
      { displayText: "결과 페이지 확인", prompt: "NVDA의 저장된 최근 10-K에서 모델 1 게시 결과의 첫 페이지를 확인하고 전체 건수와 현재 조회 범위를 구분해 줘." },
    ],
  },
  {
    title: "검증 · 비교",
    description: "원문과 모델 결과의 일치 여부를 살핍니다.",
    starters: [
      { displayText: "Item 원문 검증", prompt: "AAPL의 저장된 최근 10-K에서 모델 1 Item 한 건을 골라 연결된 원문과 일치하는지 확인해 줘." },
      { displayText: "사업 지식 검증", prompt: "MSFT의 저장된 최근 10-K에서 모델 2 사업 지식 한 건의 근거 원문을 열어 주장과 일치하는지 확인해 줘." },
      { displayText: "XBRL 사실 검증", prompt: "NVDA의 저장된 최근 10-K에서 모델 3 선택 사실 한 건의 원문 증거와 기간·단위를 대조해 줘." },
      { displayText: "단계별 결과 비교", prompt: "AAPL의 저장된 최근 10-K에서 모델 1·2·3의 게시 결과와 각 단계가 다루는 범위를 비교해 줘. 새 실행은 하지 마." },
    ],
  },
];
