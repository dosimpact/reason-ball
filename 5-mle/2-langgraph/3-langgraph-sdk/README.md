

## 실행  

  1. 환경 파일 준비:

  cp .env.example .env

  .env에 최소한 OPENAI_API_KEY를 넣으세요.

  2. LangGraph 서버 실행:

  uv run langgraph dev --host 0.0.0.0 --port 2931

  프론트 코드가 기본적으로 http://localhost:2931을 보도록 되어 있어서 포트는 2931이 맞습니다.

  3. 다른 터미널에서 React 앱 실행:

  pnpm dev