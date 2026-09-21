# A2UI 진행 이벤트 검증

- 요구사항: A2UI-PROGRESS-001.
- 구현: LangGraph custom event → AG-UI CUSTOM `a2ui.progress` → CopilotKit agent subscriber → 실행 진행 상태 패널. 내부 추론은 전달하지 않는다.
- 영향 stock: [Host](../stock/tech-shared/1-fe-host/a2ui.md), [LangGraph](../stock/tech-shared/3-langgraph-fast/a2ui.md).
- Python focused HTTP SSE/graph/gate 3 PASS. 실제 LangGraphAgent 변환 후 CUSTOM 이벤트 순서 확인.
- VAL-API-001: `pnpm --filter reason-hwang-langgraph-fast test:a2ui:api --env-var baseUrl=http://127.0.0.1:18082`, 7요청/8테스트/8assertion PASS. 실모델 Dynamic analyzing/composing/validating/delivering 및 RUN_FINISHED 순서 확인. 기존 Fixed/action/격리도 통과.
- VAL-VIEW-001: frontend `test:a2ui:views` 75 PASS. 진행/실패/중단 View 포함. 최초 SDK 지연 번들링 오류 후 순수 View를 구독 컴포넌트와 분리하여 전체 재실행 통과.
- VAL-BROWSER-001: Playwright MCP, 2818 production에서 결과 전 composing 표시 확인. SDK 취소는 RUN_ERROR code=abort임을 확인하고 실패와 분리. 수정된2819 dev에서 중단 표시, 같은 대화 재실행, 최종5단계/작업완료/매출$680,000/surface1개, 새 대화 초기화 PASS.
- [진행 화면](evidence/a2ui-2026-09-21/dynamic-progress.png) 시각 확인 완료.
- frontend lint/typecheck PASS. production build PASS(취소 code 분기 보완 전); 최종 취소 분기는 typecheck 및 실제 브라우저로 확인했다. 기존 favicon404 외 브라우저 오류 없음.
- 서버: 진행 이벤트 backend18082. 최신 진행 UI preview2819(dev);2818은 취소 분기 보완 전 production 검증용. 기존 사용자 preview2815/2816/2817은 보존했다.
- 전체 목표의 API-key 실제 제공자 검증 등 남은 항목은 별도이며 이번 기능 검증으로 대체하지 않는다.
