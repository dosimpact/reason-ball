import type { TemplateInput } from "@/entities/planner/model";

const common = `\n## 검증 결과 기록\n- AI: 체크리스트 항목별 결과와 실행 명령·환경·증거를 기록합니다. 상세 결과는 이 문서의 검증 결과 자식 문서를 갱신합니다.\n- 사람: 아래 검증 절차를 직접 수행한 뒤 각 항목의 사람 확인을 체크합니다. AI 결과와 독립적으로 기록합니다.\n- 설계 변경: 영향받은 항목만 reopen하고 다시 검증합니다.\n`;
const prompt =
  "설계된 범위만 구현하세요. 미정 사항은 추측으로 확정하지 마세요. 체크리스트별 AI 검증 결과와 증거를 기록하고 검증 결과 자식 문서를 갱신하세요. 사람 확인은 대신 체크하지 마세요.";
export const verificationTemplates: TemplateInput[] = [
  {
    name: "design-verification-view",
    title: "설계-검증 View",
    kind: "design-verification",
    body: `## 비즈니스 목적 (What)\n- 사용자·문제:\n- 제공할 동작 및 완료 조건:\n- 범위 / 제외 범위:\n\n## React 컴포넌트 메타 정보\n- 컴포넌트 이름 / 파일 경로 / export:\n- 라우트 / 상위·하위 컴포넌트:\n- Props 이름·타입·필수 여부·기본값:\n- 이벤트·콜백 / 상태 / 데이터 의존성:\n\n## 구현 설계 (How)\n- 레이아웃 / shadcn 컴포넌트:\n- 상호작용 / 접근성 / 키보드 / 반응형:\n- 기본·로딩·빈 결과·오류·비활성 상태:\n\n## Storybook 검증\n- stories 파일 / Story ID / 접속 URL:\n- 실행 명령 / 테스트 데이터·mock:\n- 시나리오별 조작 → 기대 결과:\n- AI 1차 검증: 스토리 렌더링·상호작용·스크린샷 확인 및 결과 기록.\n- 사람 최종 검증: Storybook에서 각 상태·상호작용·키보드·화면 크기를 직접 확인 후 체크.\n${common}`,
    example:
      "컴포넌트: LoginForm, Props: onSubmit(email, password), 상태: 기본/전송 중/실패. Story: LoginForm/Error. 잘못된 비밀번호 제출 → 오류 메시지 표시 및 재입력 가능. 사람은 Storybook에서 직접 제출해 확인합니다.",
    prompt,
    checklist: [
      "Props·이벤트·상태가 React 설계와 일치한다",
      "Storybook에서 기본·로딩·빈 결과·오류 상태가 설계대로 표시된다",
      "Storybook 상호작용·키보드 접근성·반응형 동작을 확인한다",
    ],
  },
  {
    name: "design-verification-api",
    title: "설계-검증 API",
    kind: "design-verification",
    body: `## 비즈니스 목적 (What)\n- 호출자·사용 사례 / 완료 조건:\n- 범위 / 제외 범위:\n\n## 서버 메타 정보\n- 프레임워크(NestJS / Express 등)·모듈·Controller/Router·Service 경로:\n- Method / Path / 인증·인가 / 환경별 Base URL:\n\n## API 계약 및 구현 설계 (How)\n- Path·Query·Headers·Body: 필드·타입·필수·검증 규칙:\n- 성공 응답: 상태 코드·스키마·예시:\n- 실패 응답: 인증·권한·입력·충돌·미존재·서버 오류:\n- 업무 규칙 / 데이터 변경 / 트랜잭션 / 멱등성:\n- 외부 의존성 / 비밀값은 환경변수로 참조:\n\n## Bruno API 검증\n- Collection / .bru 파일 / 환경 / 실행 명령:\n- 테스트 데이터 준비 / 인증 설정 / 정리 절차:\n- 요청별 입력 → 예상 HTTP 상태·응답·부작용:\n- AI 1차 검증: 실제 HTTP 요청과 assertions 실행, 결과 기록.\n- 사람 최종 검증: Bruno에서 직접 API call 후 응답·오류·데이터 변경을 확인하고 체크.\n${common}`,
    example:
      "NestJS OrdersController POST /orders: items 필수, 인증 필요. 성공 201 및 orderId, 잘못된 수량 400, 미인증 401. Bruno 01-create-order.bru에서 테스트 토큰으로 호출하고 생성된 주문을 정리합니다.",
    prompt,
    checklist: [
      "정상 요청의 상태 코드·응답·데이터 변경이 API 계약과 일치한다",
      "입력 오류·인증·권한·미존재 등 실패 응답을 실제 호출로 확인한다",
      "Bruno 요청의 환경 설정·테스트 데이터 준비·정리 절차가 재현 가능하다",
    ],
  },
  {
    name: "design-verification-e2e",
    title: "설계-검증 E2E",
    kind: "design-verification",
    body: `## 비즈니스 목적 (What)\n- 사용자 역할 / 핵심 사용자 여정 / 완료 조건:\n- 브라우저 수준 검증이 필요한 구현 범위:\n\n## 흐름 및 구현 설계 (How)\n- 진입 URL / 화면 전환 / 관련 View·API 문서 링크:\n- 사전 상태 / 테스트 계정 / 데이터 / 외부 의존성:\n- 단계별 사용자 조작 → 화면·URL·데이터 기대 결과:\n- 정상·오류·취소·새로고침·재시도 경로:\n\n## 브라우저 E2E 검증\n- 도구: Playwright MCP / Chrome CDP:\n- 브라우저·뷰포트 / Base URL / 실행·연결 방법:\n- Given(준비) / When(조작) / Then(기대 결과):\n- 안정적인 locator / 대기 조건 / 데이터 정리:\n- AI 1차 검증: 브라우저 흐름 실행, 화면·네트워크·콘솔 결과와 스크린샷/trace 기록.\n- 사람 최종 검증: Playwright MCP 또는 Chrome CDP로 연 브라우저에서 실제 사용자 흐름을 재현·확인 후 체크.\n${common}`,
    example:
      "Given 테스트 사용자가 로그인함 / When 상품 선택 → 주문 제출 / Then 완료 URL로 이동하고 주문 내역에 1건 표시. Playwright MCP 또는 Chrome CDP로 실제 화면을 확인하고 주문 테스트 데이터를 정리합니다.",
    prompt,
    checklist: [
      "브라우저에서 핵심 사용자 여정과 화면·URL·데이터 결과가 일치한다",
      "오류·취소·새로고침·재시도 경로를 확인한다",
      "Playwright MCP 또는 Chrome CDP 검증 절차와 실행 증거를 재현할 수 있다",
    ],
  },
];
