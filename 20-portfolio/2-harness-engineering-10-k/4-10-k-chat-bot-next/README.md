# 4-10-k-chat-bot-next

Next.js 기반 챗봇 앱입니다. 인증/대화 저장 기능을 유지하면서, 기본 채팅 실행은 `3-10-k-parser` LangGraph-style runtime API를 통해 10-K/10-Q 질의응답을 수행합니다.

## 1. 역할

- 인증(회원/게스트) 기반 채팅 UI
- 채팅/문서 이력 Postgres 저장
- parser-backed 10-K/10-Q 질의응답 UI
- 채팅/메시지 이력 저장 및 resume stream

## 2. 빠른 실행

### 2.1 준비

```bash
cd 4-10-k-chat-bot-next
cp .env.example .env.local
pnpm install
```

### 2.2 DB 연결값 설정

`lib/db/migrate.ts`와 Drizzle 설정은 `.env.local`을 읽습니다.

최소 예시:

```bash
AUTH_SECRET=replace-with-random-secret
POSTGRES_URL=postgresql://postgres:postgres@127.0.0.1:55432/chat_bot
# parser runtime
PARSER_BACKEND_URL=http://127.0.0.1:3406

# 선택
REDIS_URL=...
```

### 2.3 마이그레이션

```bash
pnpm db:migrate
```

### 2.4 개발 서버 실행

```bash
pnpm dev
```

기본 주소: `http://localhost:3003`

## 3. Parser-backed Chat Runtime

기본 채팅은 아래 parser runtime에 의존합니다.

- `POST /api/langgraph/threads`
- `POST /api/langgraph/threads/{threadId}/runs/stream`
- `GET /api/langgraph/threads/{threadId}/stream`

즉, `3-10-k-parser`가 실행 중이어야 하고, 질의 대상 filing이 미리 parse + Neo4j 적재되어 있어야 합니다.

## 4. SEC API 엔드포인트

아래 API들은 기존 SEC 실험/관리 경로로 남아 있습니다.

### 4.1 공시 목록 조회

- `GET /api/sec/filings`
- Query:
  - `companyQuery` (필수)
  - `forms` (예: `10-K,10-Q`)
  - `limit` (기본 10)
  - `cursor` (기본 0)

### 4.2 최신 공시 원문 열람

- `POST /api/sec/full-text`
- Body:

```json
{
  "companyQuery": "AAPL",
  "targetPeriod": "auto",
  "preferForm": "10-K"
}
```

### 4.3 선택 공시 요약

- `POST /api/sec/summary`
- Body:

```json
{
  "cik": "0000320193",
  "accessionNo": "0000320193-25-000073",
  "style": "executive"
}
```

`style` 지원값: `executive`, `short`, `risk_focus`, `key_info_first`

### 4.4 투자 의사결정 브리프

- `POST /api/sec/investment-brief`
- Body:

```json
{
  "cik": "0000320193",
  "accessionNo": "0000320193-25-000073",
  "riskTolerance": "medium",
  "timeHorizon": "1y"
}
```

## 5. 연동 주의사항

- 기본 채팅 경로는 `PARSER_BACKEND_URL`이 없으면 동작하지 않습니다.
- `3-10-k-parser`는 브라우저 UI를 포함하지 않으므로, 이 앱은 인증/저장/UI shell 역할을 맡습니다.
- parser retrieval은 Neo4j 적재 상태를 전제로 하므로, chat app이 filing 적재를 대신하지는 않습니다.
- Data Readiness, freshness, parser-runtime, Graph RAG, collector degraded 상태별 복구 절차는
  [../docs/05-runbooks/operations.md](../docs/05-runbooks/operations.md)를 기준으로 확인합니다.
