# 채팅 도구 인자와 결과 표시

- 배경: Behind the scenes가 실제 인자 대신 빈 객체, 결과 대신 완료 문구를 표시했다.
- 변경: 현재 턴의 호출 ID로 LangGraph 도구 인자와 결과 메시지를 연결해 SDK 타임라인에 전달한다. 저장된 대화 복원에도 적용하고 중간 assistant 메시지는 제외한다. 오류 결과가 있으면 오류 내용도 전달한다.
- 범위: 서버 스트림 또는 저장 기록에 들어 있는 ToolMessage content를 표시한다. 서버가 별도로 보관하는 artifact나 스트림에 없는 HTTP 상세는 보장하지 않는다.
- Stock: [Host OpenUI](../stock/tech-shared/1-fe-host/open-ui.md).
- 검증: Host typecheck 및 변경 파일 ESLint PASS, `pnpm --filter @reason-hwang/fe-host test:chat` 23/23 PASS. SDK pairToolActivity에 실제 인자·결과가 전달되는 것을 검증했다. 사용자의 기존 브라우저 검증 선호에 따라 브라우저·Storybook 실행은 생략했다.
