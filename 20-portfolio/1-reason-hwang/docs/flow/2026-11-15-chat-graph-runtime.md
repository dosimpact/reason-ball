# 채팅 그래프 실행 서버 연결

- 날짜: 2026-11-15
- 배경: 채팅이 FastAPI 호환 서버 2981의 비어 있는 assistant 목록을 조회해 기본 채팅만 표시했다. 실제 LangGraph CLI는 2982에 있다.
- 변경: 채팅 SDK에 실행 서버 전용 same-origin 프록시를 연결하고 기존 FastAPI 프록시는 유지했다. `LANGGRAPH_RUNTIME_API_URL`로 실행 서버 주소를 지정한다.
- Stock: `docs/stock/tech-shared/1-fe-host/2-frontend-side-architecture.md`를 갱신했다.
- 확인: 2981 assistant 검색은 빈 배열이었다. 2982는 포트를 열었지만 `/ok` 요청이 시간 초과되어 목록과 실행은 확인하지 못했다. 실행 서버 상태 확인이 필요하다. Host 타입 검사는 통과했다.
