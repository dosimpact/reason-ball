# SEC Intelligent UI 도구 활동과 진행 상태

- 배경: SEC 채팅은 노드 상태만 스트리밍하고 공시 준비는 JSON만 반환해 도구 호출 내용이 보이지 않았다.
- 변경: SEC 도구의 호출 인자·모델에 전달하는 결과·상태를 `sec.activity`에 추가해 기존 진행 단계와 같은 턴에서 펼쳐 표시한다. `/prepare`는 Accept가 SSE일 때 도구 이벤트와 준비 결과를 스트리밍하며 기존 JSON 계약을 유지한다. 원문 도구는 모델에 제공하는 발췌를 표시하고 별도 전체 artifact는 전송하지 않는다.
- Stock: [SEC Chat](../stock/sec-chat.md), [LangGraph SEC 설계](../stock/tech-shared/3-langgraph-fast/sec-intelligent-ui.md).
- 검증: Python 테스트 38/38 PASS (실제 ToolNode와 준비 SSE/JSON 호환 포함), Host typecheck·변경 파일 ESLint PASS, 변경 Python 소스 Ruff PASS. 격리 FastAPI fixture에서 Bruno 실제 HTTP SSE 1/1 PASS; provider와 외부 SEC 서버는 fixture로 대체했다. 전체 테스트 파일 Ruff는 기존 import 정렬 경고가 남아 있으므로 전체 lint 통과로 보지 않는다. 브라우저·Storybook은 사용자 선호에 따라 실행하지 않았다.
- 정리: 작업 소유 Uvicorn PID 3701을 정상 종료했다. 포트 16492와 임시 디렉터리를 확인·정리했다. 기존 사용자 서버는 유지했다.
