# Lite Canvas 프런트엔드

Next.js/React와 Intelligent UI Renderer. 독립 npm 프로젝트이며 backend와 HTTP로 연결한다.

```bash
npm ci
npm run generate
npm run dev
```

UI: http://127.0.0.1:3048. `.env`의 `LANGGRAPH_API_URL`은 http://127.0.0.1:2040 이다. OPENAI_API_KEY는 backend에만 둔다.

```bash
npm run typecheck
npm run lint
npm test
npm run verify
npm run test:e2e
```

E2E는 실제 provider/Chrome을 사용한다. 이미 실행한 이 프로젝트 서버를 쓰려면 `CANVAS_USE_RUNNING_SERVER=1 npm run test:e2e`를 사용한다.

`src/canvas`의 Workspace/ReportView가 split, 인용, PDF를 담당한다. `/reports/[reportId]`는 발행된 report를 같은 Renderer로 표시한다. API route가 raw LangGraph custom SSE와 report HTTP를 프록시한다.

[시스템 설계](../docs/stock/system.md)

발행된 리포트의 production 인쇄만 재검증하려면 `node tests/print-existing.mjs <reportId>`를 실행한다. 새 LLM 호출 없이 SVG overflow/브라우저 오류를 확인하고 `output/pdf/supplier-report.pdf`를 생성한다.
