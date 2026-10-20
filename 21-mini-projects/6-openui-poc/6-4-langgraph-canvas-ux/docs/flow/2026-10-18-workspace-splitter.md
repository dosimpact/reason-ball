# Chat / Canvas splitter — 2026-10-18

## 요청과 결정

SPLIT-01: 사용자가 Chat과 Canvas 경계를 마우스로 끌어 두 영역의 너비를 조절한다. 기존 패널 내부 resize와 구분한다.

10px 세로 separator, pointer capture와 이동 중 즉시 반영, 양쪽 최소 430px을 적용한다. 기본 비율 50:50. 950px 이하에서는 기존 세로 쌓기와 splitter 숨김을 유지한다. 비율은 현재 화면 메모리에 유지하며 reload 영속화는 추가하지 않는다. 키보드 방향키 2%, Home/End 한계, Enter/더블클릭 초기화, Escape/pointercancel 드래그 취소를 제공한다. API/LLM 호출과 Canvas 저장 데이터 변경은 없다.

영향 stock: business.md, system.md, canvas-system/canvas-system.md. 검증 결과는 작업 후 추가한다.

## 검증 결과

- `npm run typecheck`: PASS.
- `npm run lint`: 오류 0, 기존 경고 5개.
- `npm run verify`: FSD 오류/경고 0, production build PASS.
- 별도 소유 Next production 3055에서 Chrome E2E 4개 PASS(6.7초): splitter 2개 + 기존 registry/DnD 회귀 2개.
- 드래그 중 즉시 너비 변경, 양쪽 430px 하한, Escape 취소, 더블클릭/키보드 초기화, 방향키/Home/End, 모바일 세로 배치, 작성 중 입력 보존 확인. splitter 조절 중 workspace API 요청 0 확인.
- 보고서: `frontend/output/splitter-report/index.html`, 화면: `frontend/output/playwright/splitter.png`. 이전 전체 provider 회귀 보고서를 덮어쓰지 않았다.
- 이번 변경은 frontend 레이아웃에 한정한다. Python/provider 호출은 이번 검증에 필요하지 않아 재실행하지 않았다.
- business/system/Canvas 상세 stock에 SPLIT-01을 동기화했다. 기존 2037/3045 서비스는 유지하고 검증용 3055만 종료한다.
