# Document comparison — Python LangGraph

[전체 예제 비교](../README.md) · [프런트엔드 안내](frontend/README.md) · [백엔드 안내](backend-langgraph/README.md)

기존 6-langgraph-platform-to-py를 보존한 독립 프로젝트다. document-comparison cookbook의 모델/도구 실행과 문서 처리·영구 대화 저장을 Python으로 옮겼다.

```text
Browser / OpenUI
  → Next.js HTTP proxy (3043)
  → Python LangGraph custom app (2035)
    → DeepAgents + OpenAI model + search_documents
    → documents.sqlite / conversations.sqlite
```

## 실행

```bash
cd backend-langgraph
uv sync --frozen
# 최초 설정: .env.example을 .env로 복사하고 OPENAI_API_KEY 설정
uv run prepare-documents
uv run langgraph dev --port 2035 --no-browser
```

다른 터미널:

```bash
cd frontend
npm ci
npm run dev
```

http://localhost:3043 에서 질문하거나 Documents에서 보고서를 확인한다. 대화는 새로고침과 서버 재시작 후에도 보존된다. 준비 명령은 실제 임베딩 API를 호출하며 기본 샘플 3개와 backend-langgraph/documents의 PDF를 인덱싱한다. OCR과 웹 업로드는 포함하지 않는다.

## 검증과 문서

- backend: `uv run pytest`, `uv run ruff check agent tests`, `uv build`.
- frontend: `npm run lint`, `npm run typecheck`, `npm run verify`.
- 실제 서버/모델: frontend에서 `npm run test:smoke`.
- [제품 설계](docs/stock/business.md), [시스템 설계](docs/stock/system.md), [백엔드 명령](backend-langgraph/README.md), [프런트엔드 명령](frontend/README.md).

원본에서 복사된 Report.md와 초기 flow는 과거 이력이다. 현재 상태는 stock을 따른다. PDF/DB/키/환경/캐시는 Git에서 제외한다. 답변은 생성형 모델과 검색에 의존하므로 출처를 확인한다.

코드 구조를 읽을 때는 [한국어 주석과 코드 읽기 안내](docs/stock/system.md#code-001-한국어-주석과-코드-읽기-안내)를 참고한다.

## 새 환경 설정과 디렉터리 이동

실행 명령의 `cd`는 각각 이 프로젝트 루트를 기준으로 한다. Python 3.12와 uv, Node.js 20.9+ 및 pnpm이 필요하다. 백엔드는 `uv.lock`, 프런트엔드는 `pnpm-lock.yaml`을 사용한다.

처음 실행할 때만 각 폴더의 `.env.example`을 `.env`로 복사한다. 기존 `.env`는 보존한다. 백엔드에 `OPENAI_API_KEY`를 설정하고, 프런트엔드에는 `LANGGRAPH_API_URL=http://127.0.0.1:2035`를 명시한다. 복사된 예시 파일의 주소가 다르면 이 프로젝트 포트로 바꾼다.

이동 후 실행 문제가 생기면 이 프로젝트 서버를 종료한 뒤 다음을 실행한다. `.langgraph_api`, PDF, SQLite, 브라우저 저장 데이터는 캐시 정리 대상에서 제외한다.

```bash
# frontend/에서
rm -rf .next
pnpm install --frozen-lockfile
# backend-langgraph/에서
uv sync --frozen --reinstall-package langgraph-cli
```

이후 위 실행 절차로 재시작한다. 캐시 재생성이나 HTTP 200 확인은 실제 모델 응답·브라우저 상호작용 검증과 별개다.
