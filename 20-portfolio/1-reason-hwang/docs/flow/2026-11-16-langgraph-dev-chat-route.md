# Langgraph dev chat 주소 변경

- 변경: Host 채팅의 기본 경로를 `/langgraph-dev-chat`으로 변경하고 기존 `/chat`은 쿼리 문자열을 보존해 새 주소로 리다이렉트한다. 사이드바와 모바일 메뉴 제어 및 관련 E2E 경로를 동기화했다. 기존 LangGraph thread metadata와 저장 기록은 변경하지 않는다.
- Stock: [Host 구조](../stock/tech-shared/1-fe-host/2-frontend-side-architecture.md), [공통 시스템](../stock/tech-shared/system-design.md), [기술 분석](../stock/technical-analysis/system-design.md).
- 검증: `next typegen`으로 이전 생성 라우트 타입을 갱신한 뒤 Host typecheck와 변경 파일 ESLint PASS. 리다이렉트 E2E 시나리오를 추가했지만 사용자 선호에 따라 브라우저 실행은 하지 않았다. 실행 서버 재시작은 하지 않았다.
