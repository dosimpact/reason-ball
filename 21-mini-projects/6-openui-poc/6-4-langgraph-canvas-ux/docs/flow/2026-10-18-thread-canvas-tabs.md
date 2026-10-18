# 2026-10-18 — Thread별 Canvas와 탭/패널 확장

- 사용자 요청: Canvas↔Chat thread 1:1, reference analytics-template의 탭/크기 조정/패널 액션, Chat의 Canvas 상태 인식 확인.
- 확인한 기존 동작: 전역 canvas-ux:dashboard:v1 한 개. Chat은 widgets/selectedWidgetId를 전달하지만 thread 소유권과 탭/레이아웃 정보가 없음.
- 설계: thread별 독립 store + schemaVersion=2 문서, 내부 탭과 패널 layout, 요청 시작 시 store 고정. 새 채팅은 빈 draft를 쓰고 첫 메시지에서 발급된 threadId에 연결한다. 이전 전역 문서는 명시적 가져오기만 제공한다.
- 참고: reference/analytics-template/src/components/ui/components-canvas.tsx, interactable-tabs.tsx, src/lib/canvas-storage.ts, docs/canvas-system.md. 참조 파일 자체는 수정하지 않는다.
- 변경 대상 stock: 제품 CHAT/SAVE, 시스템 저장·이벤트·모델 문맥 계약. 검증 진행 중.

## 구현 및 검증

- THREAD-01~04: thread별 저장소/이벤트 소유권, draft 이전, New chat 초기화, reload와 채팅 삭제 연동.
- TAB-01~02/PANEL-01~02: 탭 추가/선택/이름 변경/삭제 확인, 패널 drag·너비/높이 변경, 탭 이동/순서/삭제. 자연어 레이아웃 편집은 후속 범위로 E에 명시.
- CONTEXT-05~06: Python planner에 전체 현재 thread 문맥 전달. 실제 모델 응답에서 탭/활성 탭/640px 높이를 확인했고 상태 질문 전후 widgets와 조회 호출 수가 동일했다.
- 브라우저 전체 12개 통과(48.4초). 두 번째 thread 생성은 결정적 SSE fixture, 상태 설명과 기존 생성/분석 경로는 실제 Python/provider 호출로 구분한다. 드래그 높이 변경, 탭 이동, 두 채팅 복원, 탭과 패널 삭제를 검증했다.
- frontend 333 tests, Python 48 tests 통과. Ruff/typecheck/build 통과, lint 오류 0/기존 경고 5개. 초기 미지원 형식 검사는 안내 문구 변경 때문에 실패했고 사용자용 문구를 정리한 후 전체 재실행에서 통과했다.
- stock/business.md, stock/system.md를 현재 구현과 동기화했다. 이전 검증 기록은 당시 증거로 보존한다.

- 최종 추가 확인: 첫 메시지 전 New chat 반복 클릭도 탭을 초기화하도록 연결한 뒤 해당 Chrome 시나리오 재실행 통과(1개, 5.7초), typecheck 및 Python 레이아웃 보존 회귀 10개/Ruff 통과. 전체 E2E 보고서는 이후 대상 재실행 결과로 갱신되므로 위의 12개 전체 실행과 구분한다.
