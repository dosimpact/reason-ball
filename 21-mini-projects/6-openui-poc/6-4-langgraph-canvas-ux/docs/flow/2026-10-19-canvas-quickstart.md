# 2026-10-19 Canvas Quick Start 보강

## 문맥과 결정 — QUICKSTART-01

첫 사용자가 시도할 Canvas 질문을 보강해 달라는 요청이다. 기존 9개 질문 중 Canvas 예시는 매출·광고비 차트 하나였다. 일반 질문은 유지하고 Canvas 예시를 6개로 늘렸다.

## 변경과 이유

- 시작 카드 앞부분: 매출·광고비, 주간 메모, 입력 폼, 비교표, Chat에서 Canvas로 추가, 차트·메모 혼합 생성.
- 각 prompt에 생성 위치와 콘텐츠 종류를 명시했다. 빈 작업공간에서 사용할 수 있고, 예시 데이터·로컬 폼 입력 범위도 명시한다.
- 환영 제목은 “무엇을 만들어볼까요?”로 변경했다.
- 브라우저에서 기존 목록이 가로 캐러셀인 것을 확인했다. 루트 AgentInterface의 starterVariant를 card로 지정하고 목록을 2열·최대 높이 제한·내부 스크롤로 표시해 입력창을 보존했다.
- 카탈로그·모델 시스템 프롬프트·API 계약은 변경하지 않았다.

## 동기화한 Stock

- [제품 설계 QUICKSTART-01](../stock/business.md#quickstart-01--첫-사용자-canvas-예시)
- [시스템 설계 QUICKSTART-01](../stock/system.md#quickstart-01--시작-질문-구성)

## 검증

- frontend `npm run typecheck`, `npm run lint:fsd`: 통과.
- 변경 TSX의 ESLint: 오류 0, 기존 img 경고 1.
- 개발 서버 3045/2037을 유지한 채 별도 Playwright 세션으로 확인했다.
- 첫 화면에 Canvas 예시 6개가 기존 일반 질문 8개보다 먼저 표시되는 것을 확인했다.
- “Canvas 주간 메모” 카드 클릭 → 실제 Python/provider 요청 → 목표·할 일·회고를 포함한 등록형 Canvas 메모 1개 생성·저장 확인.
- 1280×720 및 390×844 화면에서 카드 배치를 시각 확인했다. 모바일 가로 overflow가 없고 입력창이 화면 안에 있음을 확인했다.
- 화면 증거: frontend/output/playwright/quickstart-canvas.png, quickstart-canvas-mobile.png (로컬 산출물).
- 새 prompt 전체를 실제 provider로 전수 실행한 것은 아니다. 나머지 예시의 생성 기능은 기존 지원 계약을 따르며 이번 실행 검증은 주간 메모 1개다.
