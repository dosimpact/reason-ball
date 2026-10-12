# 2026-10-07 — UI-PUSH-GUIDE-25: 구현 가이드 1 pager

- 맥락: 사용자가 25번 push_ui_message의 LangGraph·UI를 구현할 수 있는 한 페이지 가이드를 요청함.
- 변경: 예제 폴더 README에 상태/그래프 구성, UI 발행/패치, 두 ID의 연결, 내부/최종 LLM 계약, 실패 분기, SDK 이벤트 처리, 단일 메시지 reducer, UI 검증/병합/렌더링, 실행 및 완료 조건을 정리함.
- 근거: 현재 graph, 여덟 frontend 모듈, 공유 SDK 클라이언트, package scripts, stock/plan 및 최신 SSOT·utility revert 기록을 대조함. push_ui_message 시그니처는 공식 API reference로 확인함.
- 영향 stock: business-design.md와 system-design.md의 UI-PUSH-CHAT-25에 구현 가이드 링크를 추가함. 제품 동작과 런타임 코드는 변경하지 않음.
- 검증: 문서의 로컬 링크, graph ID·props·stream modes·script names를 현재 파일과 대조하고 git diff --check를 수행함. 문서 변경만 있으므로 빌드/provider/browser E2E는 재실행하지 않음.
- 상태: 완료. README 및 progress/implement.md에 진입점과 완료 상태를 기록함.
