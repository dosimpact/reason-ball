import type { ConversationStarterGroup } from "@/shared/ui/agent-conversation";

export const secApiAgentStarterGroups: ConversationStarterGroup[] = [
  {
    title: "기업 찾기 · 목록 확인",
    description: "저장된 SEC 기업과 공시를 먼저 확인합니다.",
    starters: [
      { displayText: "AAPL 기업 검색", prompt: "저장된 SEC 기업에서 AAPL을 찾아 회사명과 CIK를 알려줘. 동기화는 하지 마." },
      { displayText: "이름으로 기업 찾기", prompt: "저장된 SEC 기업에서 Microsoft를 이름으로 검색하고 티커와 CIK를 알려줘. 동기화는 하지 마." },
      { displayText: "최근 10-K 목록", prompt: "AAPL의 저장된 최근 10-K 공시 목록을 제출일과 접수번호로 보여줘. SEC 최신성은 새로 확인하지 마." },
      { displayText: "10-Q·8-K 목록", prompt: "MSFT의 저장된 최근 10-Q와 8-K 공시를 유형별로 보여줘. 제출일과 접수번호를 포함해 줘." },
    ],
  },
  {
    title: "공시 상태 · 기간",
    description: "저장된 문서의 범위와 다운로드 상태를 살펴봅니다.",
    starters: [
      { displayText: "올해 제출 공시", prompt: "AAPL의 올해 저장된 공시를 유형별로 조회하고 제출일을 보여줘. 저장 범위만 설명해 줘." },
      { displayText: "다운로드된 10-K", prompt: "AAPL의 저장된 10-K 중 원문 다운로드가 완료된 공시를 최신순으로 보여줘." },
      { displayText: "다운로드 실패 공시", prompt: "NVDA의 저장된 공시 중 원문 다운로드가 실패한 건을 조회하고 접수번호와 상태를 알려줘." },
      { displayText: "원본과 정정 공시", prompt: "AAPL의 저장된 최근 10-K와 10-K/A를 구분해 목록으로 보여줘. 원본과 정정 공시를 합치지 마." },
    ],
  },
  {
    title: "10-K 원문 리서치",
    description: "실제로 읽은 원문 범위를 밝히고 근거를 제시합니다.",
    starters: [
      { displayText: "사업 구조 리포트", prompt: "AAPL의 저장된 최근 10-K 원문에서 주요 사업과 제품을 읽고 공시 출처와 함께 간단한 리포트를 작성해 줘. 수집은 하지 마." },
      { displayText: "사업 위험 요약", prompt: "NVDA의 저장된 최근 10-K 원문에서 주요 사업 위험을 찾아 출처와 함께 요약해 줘. 수집은 하지 마." },
      { displayText: "부채 만기 점검", prompt: "MSFT의 저장된 최근 10-K 원문에서 부채 만기 관련 부분을 찾아 기준일·단위·원문 근거를 밝히고 요약해 줘." },
      { displayText: "경영진 논의 요약", prompt: "AMZN의 저장된 최근 10-K 원문에서 경영진의 실적 논의를 찾아 읽은 범위와 출처를 밝히고 요약해 줘." },
    ],
  },
  {
    title: "기업 · 기간 비교",
    description: "저장된 공시끼리 비교하고 자료 범위를 명시합니다.",
    starters: [
      { displayText: "두 기업 위험 비교", prompt: "AAPL과 MSFT의 저장된 최근 10-K 원문에서 공통점과 차이점이 드러나는 사업 위험을 비교하고 각 출처를 표시해 줘." },
      { displayText: "두 기업 사업 비교", prompt: "NVDA와 AMD의 저장된 최근 10-K 원문에서 주요 사업 구성을 비교해 줘. 어느 기업의 어느 공시를 읽었는지 표시해 줘." },
      { displayText: "연차 공시 변화", prompt: "AAPL의 저장된 최근 두 10-K 원문에서 사업 위험 설명의 변화를 비교해 줘. 실제 확인한 공시와 원문 범위를 밝혀 줘." },
      { displayText: "분기·연차 연결", prompt: "MSFT의 저장된 최신 10-K와 최신 10-Q를 찾아 실적 설명의 차이를 요약해 줘. 두 공시의 보고기간을 구분해 줘." },
    ],
  },
  {
    title: "선택 기업 동기화",
    description: "특정 기업의 SEC 데이터만 명시적으로 갱신합니다.",
    starters: [
      { displayText: "AAPL 최근 1년 수집", prompt: "AAPL의 최근 1년 공시 메타데이터와 원문을 SEC에서 수집하고 완료·실패 결과를 알려줘." },
      { displayText: "MSFT 최근 2년 수집", prompt: "MSFT의 최근 2년 공시 메타데이터와 원문을 SEC에서 수집하고 완료·실패 결과를 알려줘." },
      { displayText: "기업 디렉터리 갱신", prompt: "SEC 기업 디렉터리를 동기화하고 결과를 알려줘. 공시 수집은 하지 마." },
      { displayText: "최신 10-K 재확인", prompt: "NVDA의 최신 공시를 SEC에서 다시 확인해 최근 1년 공시와 원문을 수집한 뒤, 실제 확인한 최신 10-K를 알려줘." },
    ],
  },
  {
    title: "수집 범위 · 운영 안내",
    description: "대량 작업 전에 범위와 영향을 확인합니다.",
    starters: [
      { displayText: "전체 수집 옵션", prompt: "전체 기업 공시 수집의 대상, 기간, 원문 다운로드 옵션과 예상 작업 범위를 설명해 줘. 아직 실행하지 마." },
      { displayText: "선택 수집과 전체 수집", prompt: "선택 기업 공시 수집과 전체 기업 공시 수집의 차이, 입력 범위와 소요 시간을 설명해 줘. 아직 실행하지 마." },
      { displayText: "저장 최신·SEC 최신", prompt: "저장된 최신 공시와 SEC에서 재확인한 최신 공시의 차이를 설명해 줘. 동기화는 하지 마." },
      { displayText: "수집 실패 시 대응", prompt: "공시 원문 다운로드가 실패하거나 수집이 중단되면 어떤 상태를 확인하고 어떻게 다시 요청할 수 있는지 설명해 줘. 지금은 실행하지 마." },
    ],
  },
];
