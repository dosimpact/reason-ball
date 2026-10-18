# 2026-10-18 — 짧은 Canvas 요청의 빈 Chat 안내 수정

- 사용자 증상: `매출과 광고비 Canvas`를 직접 입력하면 Chat에 답변이 보이지 않음.
- 재현: 실제 `/api/workspace/run` 스트림은 canvas 계획 및 두 위젯을 생성하면서 Chat delta로 `root = Col([Text("")])`를 전송했다. Playwright 직접 입력에서도 Chat 안내가 비고 Canvas 생성만 진행되는 것을 확인했다.
- 원인: 구조화된 Plan.explanation이 빈 문자열이어도 정상 처리했고, work 노드가 이를 그대로 Text에 넣었다. 앞선 E2E는 시작 버튼의 완전한 문장과 Canvas 생성에 집중해 이 입력을 놓쳤다.
- 변경: non-chat 계획의 explanation을 trim한다. 공백뿐이면 Canvas에는 작업 개수와 진행 안내, clarify/explain에는 질문·재요청 안내를 서버에서 제공한다. 실행 전 안내이므로 완료로 표현하지 않는다. 정상 모델 설명은 그대로 사용한다.
- 영향: Chat 안내 생성만 보강한다. Canvas 작업·쿼리·저장 형식은 변경하지 않는다.
- 검증: 빈 문자열/공백/줄바꿈 × canvas/clarify/explain 9개 및 기존 쿼리 재사용 테스트까지 Python 10개 통과. 실제 짧은 입력과 기존 생성·수정 E2E 검증 진행 중.
- Stock 반영: system의 스트림 계약 및 business의 Chat 안내 계약에 추가한다.

## 검증 결과

- 실제 provider + Chrome E2E 2개 통과(21.0초): 기존 생성·수정 흐름, `매출과 광고비 Canvas` 직접 입력.
- 후자에서는 실제 모델 설명이 빈 경우 기본 안내 `Canvas 작업 2개를 진행합니다…`가 Chat에 표시되고 Canvas 두 개가 완성되는 것을 화면으로 확인했다. 증거: `frontend/output/playwright/short-input-chat-fixed.png`.
- 검증용 브라우저 runner 종료 확인. 서비스는 3045에서 계속 실행 중이고 proxy health 정상, activeRuns=0이다.
- 기존 빈 답변의 저장 기록은 변경하지 않았다. 수정 이후 새 요청부터 기본 안내가 적용된다.
