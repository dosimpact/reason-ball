# Document comparison — Python LangGraph

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
