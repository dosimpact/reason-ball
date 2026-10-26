# OpenUI: Next.js frontend + Python LangGraph backend

두 개의 독립 프로젝트다. 각 폴더에 별도 의존성, 환경변수, 실행·검증 명령이 있으며 HTTP로만 연결한다.

```text
6-a-1-openui-langgraph-py/
├── backend-langgraph/  # Python 3.12 + uv + LangGraph / DeepAgents
│   ├── agent/         # 그래프, 도구, 스트림 변환기, 프롬프트 자산
│   ├── tests/
│   ├── .env.example
│   ├── pyproject.toml
│   ├── uv.lock
│   └── langgraph.json
├── frontend/          # Next.js + React + OpenUI
│   ├── src/
│   ├── tests/
│   ├── .env.example
│   ├── package.json
│   └── package-lock.json
└── docs/              # 두 프로젝트의 통합 설계와 변경 기록
```

```text
Browser → frontend /api/chat → backend-langgraph (Python)
        ← AG-UI SSE          ← protocol v2 custom:openui
```

## 실행

터미널 1 — Python 백엔드:

```bash
cd backend-langgraph
uv sync --frozen
# 최초 설정 시에만: cp .env.example .env
# .env에 OPENAI_API_KEY 설정
uv run langgraph dev --port 2034 --no-browser
```

터미널 2 — Next.js 프런트엔드:

```bash
cd frontend
npm ci
# 최초 설정 시에만: cp .env.example .env
npm run dev
```

http://localhost:3042 에 접속한다. 프런트엔드의 `LANGGRAPH_API_URL` 기본값은 `http://127.0.0.1:2034`다. 각 프로젝트는 자신의 폴더만 복사해도 설치·실행 가능하다. 백엔드에는 Node.js가, 프런트엔드 설치·빌드에는 Python이 필요하지 않다.

날씨·주가·검색 도구는 mock 데이터다. OpenAI 모델 호출은 실제 API를 사용한다. 키는 `backend-langgraph/.env`에만 두고, 프런트엔드는 백엔드 주소와 배포 인증 설정만 갖는다.

## 검증

```bash
# backend-langgraph에서
uv run pytest
uv run ruff check agent tests

# frontend에서
npm run lint
npm run typecheck
npm run verify
npm run test:smoke  # 두 서버 실행 필요, 실제 OpenAI API 사용
```

## 문서

- [백엔드 안내](backend-langgraph/README.md)
- [프런트엔드 안내](frontend/README.md)
- [제품 설계](docs/stock/business.md)
- [시스템 설계](docs/stock/system.md)
- [Python 전환 기록](docs/flow/2026-10-18-python-migration.md)
- [프로젝트 분리 및 최종 검증](docs/flow/2026-10-18-project-split.md)

코드 구조를 읽을 때는 [한국어 주석과 코드 읽기 안내](docs/stock/system.md#code-001-한국어-주석과-코드-읽기-안내)를 참고한다.
