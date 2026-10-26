# OpenUI: Next.js frontend + Python LangGraph backend

[전체 예제 비교](../README.md) · [프런트엔드 안내](frontend/README.md) · [백엔드 안내](backend-langgraph/README.md)

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
│   └── pnpm-lock.yaml
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
pnpm install --frozen-lockfile
# 최초 설정 시에만: cp .env.example .env
pnpm dev
```

http://localhost:3042 에 접속한다. 프런트엔드의 `LANGGRAPH_API_URL` 기본값은 `http://127.0.0.1:2034`다. 각 프로젝트는 자신의 폴더만 복사해도 설치·실행 가능하다. 백엔드에는 Node.js가, 프런트엔드 설치·빌드에는 Python이 필요하지 않다.

날씨·주가·검색 도구는 mock 데이터다. OpenAI 모델 호출은 실제 API를 사용한다. 키는 `backend-langgraph/.env`에만 두고, 프런트엔드는 백엔드 주소와 배포 인증 설정만 갖는다.

## 검증

```bash
# backend-langgraph에서
uv run pytest
uv run ruff check agent tests

# frontend에서
pnpm lint
pnpm typecheck
pnpm verify
pnpm test:smoke  # 두 서버 실행 필요, 실제 OpenAI API 사용
```

## 문서

- [백엔드 안내](backend-langgraph/README.md)
- [프런트엔드 안내](frontend/README.md)
- [제품 설계](docs/stock/business.md)
- [시스템 설계](docs/stock/system.md)
- [README 점검 기록](docs/flow/2026-10-25-readme-audit.md)

코드 구조를 읽을 때는 [한국어 주석과 코드 읽기 안내](docs/stock/system.md)를 참고한다.

## 새 환경 설정과 디렉터리 이동

실행 명령의 `cd`는 각각 이 프로젝트 루트를 기준으로 한다. Python 3.12와 uv, Node.js 20.9+ 및 pnpm이 필요하다. 백엔드는 `uv.lock`, 프런트엔드는 `pnpm-lock.yaml`을 사용한다.

처음 실행할 때만 각 폴더의 `.env.example`을 `.env`로 복사한다. 기존 `.env`는 보존한다. 백엔드에 `OPENAI_API_KEY`를 설정하고, 프런트엔드에는 `LANGGRAPH_API_URL=http://127.0.0.1:2034`를 명시한다. 복사된 예시 파일의 주소가 다르면 이 프로젝트 포트로 바꾼다.

이동 후 실행 문제가 생기면 이 프로젝트 서버를 종료한 뒤 다음을 실행한다. `.langgraph_api`, PDF, SQLite, 브라우저 저장 데이터는 캐시 정리 대상에서 제외한다.

```bash
# frontend/에서
rm -rf .next
pnpm install --frozen-lockfile
# backend-langgraph/에서
uv sync --frozen --reinstall-package langgraph-cli
```

이후 위 실행 절차로 재시작한다. 캐시 재생성이나 HTTP 200 확인은 실제 모델 응답·브라우저 상호작용 검증과 별개다.
