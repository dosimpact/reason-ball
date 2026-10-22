# 2026-10-22 SEC-IUI-008 설명형 답변 렌더링

- 배경: 사용자 보고에서 ###, ** 등 기본 마크다운이 그대로 노출됐다. 코드상 program 없는 assistant reply의 p 출력과 Text의 인라인 전용 처리를 확인했다. 보고된 과거 응답의 실제 payload는 보존되지 않아 어느 경로였는지는 단정하지 않는다.
- 변경: 일반 응답 fallback도 OpenUI Markdown 사용. Text의 블록 문법은 기존 MarkdownBlocks로 처리. present 프롬프트는 Markdown 또는 Title/List 조합을 선택하고 차트와 공존하도록 명시.
- Stock: [마스터](../stock/sec-chat.md), [프런트](../stock/tech-shared/1-fe-host/sec-intelligent-ui.md).
- 검증: Storybook 11개 통과(직접 Markdown 및 Text 블록 서식). 실제 모델에 사용자 질문을 그대로 입력해 MCP에서 제목 6개·목록 5개·강조 13개 렌더링 확인. 기존 서버 유지, 검증 브라우저는 공식 close로 종료.
- 추가 검증: 대화 E2E 6개, Bruno API 13개, TypeScript 검사, 변경 컴포넌트 ESLint 통과. 테스트 프로세스 정상 종료와 MCP 열린 탭 없음 확인. 기존 사용자 서비스 2800/8000은 유지했다.
