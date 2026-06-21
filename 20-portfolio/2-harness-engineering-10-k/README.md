# Project 나는 사업보고서를 읽기 싫다고요.  

목표 : Codex로 대형 프로젝트 완성해보기  
- gpt pro 월 30만원의 효용을 보고 싶다. 30만원의 효용이라면 실제로 쓸만한 프로덕트까지 나와야 된다고 생각이 든다.  

Goal : 기업의 사업보고서를 열람할 수 있고 이를 통한 투자의사결정 프레임 워크에 맞게 판단을 내려주는 AI 어시스턴스를 만든다.  

## Monorepo Commands

이 저장소는 이제 `pnpm workspace + turbo + uv` 기준으로 운용합니다.

### First Setup

```bash
pnpm install
pnpm run dev
```

`pnpm run dev` brings up local infra, runs the chatbot database migration, and
starts the collector, parser, and chatbot services. Use `pnpm run infra:up` when
you only need PostgreSQL, Neo4j, Grafana, and Loki.

`3-10-k-parser`는 `uv`가 없으면 자동으로 `python3 -m pip install --user uv`를 시도합니다.

### Main Commands

```bash
pnpm run infra:up
pnpm run infra:down
pnpm run dev
pnpm run build
pnpm run start
pnpm run test:unit
pnpm run test:e2e
pnpm run doctor
pnpm run doctor:verify
pnpm run doctor:probe
pnpm run doctor:probe:local
```

### CI Gates

GitHub Actions workflow `.github/workflows/project-gates.yml` runs the same
release gates used locally:

- Pull requests and `main` pushes run `pnpm run doctor:verify` and
  `pnpm run test:e2e`.
- Nightly and manual runs can execute `pnpm run test:graph-rag` for live SEC
  parser-to-Neo4j-to-Graph-RAG coverage.

### Service Layout

- `1-infra-graph-rag`: Neo4j, PostgreSQL, Grafana, Loki
- `2-10-k-collector`: SEC metadata/download collector
- `3-10-k-parser`: parser, Graph RAG, LangGraph-style runtime (`3406`)
- `4-10-k-chat-bot-next`: CopilotKit + LangGraph chatbot UI with Data Readiness,
  Decision Quality, and SEC admin recovery surfaces

### Operations Runbook

장애 복구, 포트/환경변수 계약, Data Readiness, freshness/Graph RAG/parser degraded 상태별
확인 명령은 [docs/05-runbooks/operations.md](docs/05-runbooks/operations.md)에
정리되어 있습니다.
