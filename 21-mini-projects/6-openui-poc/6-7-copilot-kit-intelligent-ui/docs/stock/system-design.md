# 시스템 설계

공식 커밋 8391a94c1c3939c679e40ddd7bfc08a9ef690e70 기반. 독립 pnpm 9 워크스페이스이며 부모 pnpm-workspace.yaml에서 제외한다. 공식 pnpm-lock.yaml과 apps/agent/uv.lock을 유지한다.

- apps/app: Next.js 16 + React 19 + CopilotKit, 포트 3000. /api/copilotkit이 Python 에이전트와 통신한다.
- apps/agent: Python 3.12+, uv, FastAPI, DeepAgents/LangGraph, 포트 8123. .env에서 서버 자격증명을 읽는다. Jev 미들웨어는 각 사용자 턴의 렌더러를 선택하며 키가 없으면 실패한다.
- packages/design-system: 공유 CSS와 도구 스타일. dev 스크립트 실행 전에 빌드한다.
- apps/mcp: 선택적인 standalone MCP 서버, 포트 3100. 기본 dev는 함께 실행하지만 프런트 MCP 연결은 별도 설정 사항이다.
- 환경 파일은 Git 제외. 실제 OpenAI 키는 apps/agent/.env에 저장하며 파일 권한은 600. TYPESAFE_API_KEY는 미설정.

DEMO-01~03 검증과 한계는 [설치 기록](../flow/2026-10-20-demo-install.md). 실행 절차는 ../../README.local.md. 여러 lockfile 때문에 Next.js가 부모 디렉터리를 루트로 추론하는 경고가 있으나 빌드와 화면 실행은 통과했다.
