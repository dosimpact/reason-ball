import type { ConversationStarterGroup } from "@/shared/ui/agent-conversation";

export const secChatStarterGroups: ConversationStarterGroup[] = [
  {
    title: "처음 시작 · 10-K 읽기",
    description: "기업 공시와 대화 방식부터 익힙니다.",
    starters: [
      { displayText: "10-K 읽는 순서", prompt: "10-K를 처음 읽을 때 Item 1, 1A, 7, 8을 어떤 순서로 보면 좋을까?" },
      { displayText: "애플 사업 한눈에", prompt: "애플의 최신 저장된 10-K 원문을 근거로 어떤 사업을 하는지 요약해 줘." },
      { displayText: "공시 출처 확인", prompt: "애플에 대해 분석할 수 있는 저장된 10-K의 제출일, 접수번호와 SEC 최신성 확인 여부를 알려줘." },
      { displayText: "질문 방법 알아보기", prompt: "이 채팅에서 10-K 원문과 게시된 모델링 근거로 어떤 질문을 할 수 있는지 예를 들어줘." },
    ],
  },
  {
    title: "사업 · 경쟁력",
    description: "Item 1의 사업 내용과 보고서 범위를 살펴봅니다.",
    starters: [
      { displayText: "애플 매출원", prompt: "애플 최신 저장 10-K의 Item 1을 읽고 주요 제품과 서비스, 돈을 버는 방식을 원문 근거와 함께 설명해 줘." },
      { displayText: "엔비디아 사업", prompt: "엔비디아 최신 저장 10-K의 Item 1에서 주요 사업과 고객을 원문 근거와 함께 요약해 줘." },
      { displayText: "사업 부문 찾기", prompt: "마이크로소프트 최신 저장 10-K의 Item 1에서 사업 부문을 찾아 각각 무엇을 하는지 요약해 줘." },
      { displayText: "Item 1 소제목", prompt: "아마존 최신 저장 10-K의 Item 1 소제목을 뽑고 각 소제목이 다루는 내용을 짧게 소개해 줘." },
    ],
  },
  {
    title: "위험 · 법적 쟁점",
    description: "위험요인과 소송 공시를 원문에서 확인합니다.",
    starters: [
      { displayText: "엔비디아 주요 위험", prompt: "엔비디아 최신 저장 10-K의 Item 1A에서 주요 위험을 원문 근거와 함께 설명해 줘." },
      { displayText: "애플 공급망 위험", prompt: "애플 최신 저장 10-K의 Item 1A에서 공급망 관련 위험을 찾아 출처와 함께 요약해 줘." },
      { displayText: "소송 공시 확인", prompt: "메타 최신 저장 10-K의 Item 3에서 중요한 법적 절차를 찾아 원문 근거와 함께 설명해 줘." },
      { displayText: "위험과 실제 사건 구분", prompt: "테슬라 최신 저장 10-K의 Item 1A에서 공시한 위험을 설명하되, 위험 가능성과 이미 발생한 사건을 구분해 줘." },
    ],
  },
  {
    title: "실적 · 재무",
    description: "Item 7과 8의 기간·단위·근거를 확인합니다.",
    starters: [
      { displayText: "애플 실적 요약", prompt: "애플 최신 저장 10-K의 Item 7에서 경영진이 설명한 실적 변화를 기준기간과 함께 요약해 줘." },
      { displayText: "마이크로소프트 현금흐름", prompt: "마이크로소프트 최신 저장 10-K의 Item 8에서 현금흐름을 찾아 기간과 단위를 명시하고 설명해 줘." },
      { displayText: "아마존 영업이익", prompt: "아마존 최신 저장 10-K의 Item 7과 8에서 영업이익 관련 수치를 찾아 기간·단위·원문 근거를 표시해 줘." },
      { displayText: "재무제표와 해설 연결", prompt: "애플 최신 저장 10-K에서 Item 7의 실적 설명과 Item 8의 재무제표를 연결해 읽을 때 확인할 항목을 알려줘." },
    ],
  },
  {
    title: "게시 모델링 근거",
    description: "같은 공시의 공개된 검색·XBRL 근거를 함께 봅니다.",
    starters: [
      { displayText: "애플 게시 근거 찾기", prompt: "애플 최신 저장 10-K의 매출 관련 게시 모델링 근거를 검색하고, 실제 조회된 근거만 원문 인용과 구분해 보여줘." },
      { displayText: "XBRL 매출 수치", prompt: "마이크로소프트 최신 저장 10-K의 매출 XBRL fact를 조회하고 값·기간·단위와 원문 Item 근거를 구분해 설명해 줘." },
      { displayText: "XBRL 순이익 수치", prompt: "엔비디아 최신 저장 10-K의 순이익 XBRL fact를 조회해 값·기간·단위와 조회 한계를 알려줘." },
      { displayText: "근거 부재 설명", prompt: "아마존 최신 저장 10-K의 영업현금흐름에 관한 게시 모델링 근거를 찾아줘. 없거나 조회할 수 없으면 원문 근거와 그 한계를 구분해 줘." },
    ],
  },
  {
    title: "공시 수집 · 최신성",
    description: "선택 기업의 공시를 명시적으로 갱신합니다.",
    starters: [
      { displayText: "애플 최근 1년 수집", prompt: "애플의 최근 1년 10-K·10-Q·8-K 공시와 정정 공시, 원문을 수집해 줘. 완료 및 실패 결과를 알려줘." },
      { displayText: "엔비디아 최근 2년 수집", prompt: "엔비디아의 최근 2년 공시 메타데이터와 원문을 수집하고 완료 및 실패 결과를 알려줘." },
      { displayText: "날짜부터 수집", prompt: "마이크로소프트의 2025-01-01 이후 공시와 원문을 수집하고 결과를 알려줘." },
      { displayText: "수집 범위 먼저 설명", prompt: "이 채팅에서 선택 기업 공시 수집 시 어떤 유형과 정정 공시가 포함되는지 설명해 줘. 지금은 실행하지 마." },
    ],
  },
];
