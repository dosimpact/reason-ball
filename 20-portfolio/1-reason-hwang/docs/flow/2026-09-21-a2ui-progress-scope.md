# A2UI 진행 상태 SSE

- 요구사항 A2UI-PROGRESS-001: Dynamic 생성 대기 중 LangGraph가 수행하는 단계를 화면에 표시한다.
- 계약: AG-UI CUSTOM `a2ui.progress` 이벤트에 허용된 stage 코드를 전달한다. 질문 처리, 화면 구성, 검증, 재시도, 결과 전달을 실제 실행 지점에서 발행한다. 모델 추론·프롬프트·원문은 포함하지 않는다.
- UI: 현재 실행 단계와 순서를 표시하고 RUN_FINISHED/RUN_ERROR/취소에서 종료한다. 새 실행 및 새 대화에서 이전 진행 상태를 분리한다.
- Stock 영향: tech-shared/1-fe-host/a2ui.md, tech-shared/3-langgraph-fast/a2ui.md.
- 검증: 실제 SSE 순서 테스트, Bruno HTTP, Storybook 및 MCP 브라우저를 순차 수행한다. 현재 구현 중.
