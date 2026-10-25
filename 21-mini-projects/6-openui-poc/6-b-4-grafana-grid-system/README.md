# Filing Studio — SEC Chat + Canvas

6-5의 문서 비교·Intelligent UI를 시작점으로, 헤드리스 Chat과 Grafana 방식의 자체 Canvas를 연결한 독립 앱이다. Grafana 서버나 계정은 사용하지 않는다. Python Deep Agent는 SEC 수집 서브에이전트, 문서 검색, 연간 재무 데이터와 Canvas 명령을 사용한다.

> 구현·검증은 진행 중이다. 현재 환경에서 SEC 직접 접근은 HTTP 403으로 차단되어 실제 최신 원문 수집 성공을 검증하지 못했다. 준비된 PDF 검색과 모델·임베딩 호출은 동작한다. 전체 완료 여부는 [구현 현황](docs/stock/implementation-status.md)을 따른다.

## 실행

```bash
# backend-langgraph
uv sync --frozen
uv run langgraph dev --port 2041 --no-browser

# 별도 터미널, frontend
npm ci
npm run dev
```

- 대시보드: http://127.0.0.1:3049
- HTML 온보딩 + React Flow 구조도: http://127.0.0.1:3049/onboarding
- 전체 Canvas 인쇄: `/print?thread=<대화 ID>` — Canvas의 PDF / 인쇄 버튼으로 연다.
- 기존 문서 비교 화면: `/comparison`, 보고서 목록: `/documents`
- 개발 전용 UI 예제: `/gallery`, 렌더러 검증: `/preview`

루트 `.env`와 `backend-langgraph/.env`를 서버에서 읽는다. 외부 환경변수 → 루트 `.env` → 백엔드 `.env` 순으로 먼저 설정한 값이 우선한다. `OPENAI_API_KEY`, `SEC_USER_AGENT`가 필요하며 키는 브라우저로 전달하지 않는다. 데이터는 기본적으로 `backend-langgraph/data`의 SQLite와 PDF에 저장한다. `DOCUMENT_DATA_DIR`로 별도 경로를 사용할 수 있다.

## 검토용 공식 보고서 준비

```bash
# backend-langgraph: 기존 연간 자료와 분기 자료를 함께 포함
uv run prepare-documents --include-history --include-quarterly
```

기본 연간 보고서 3개, NVIDIA FY2025 연차보고서, FY2027 Q2 공식 10-Q PDF를 준비한다. 이미 받은 PDF는 재사용하고 인덱스는 새로 완성한 뒤 교체한다. 다시 준비할 때 두 옵션을 유지해야 기존 검토 대화에서 참조하는 5개 문서가 계속 검색된다. 이 경로는 기업 공식 PDF 준비이며 SEC API 수집 경로와 별개다.

## 카탈로그 변경

```bash
# frontend
npm run generate
cp src/shared/ui/openui/generated/system-prompt.txt ../backend-langgraph/agent/system-prompt.txt
```

생성한 메타데이터와 백엔드 프롬프트를 함께 갱신하고 서버를 재시작한다. 생성 시 maplibre worker의 import.meta 경고가 나올 수 있으며 브라우저 번들 검증은 별도로 수행한다.

## 검증

```bash
# backend-langgraph
uv run pytest
uv run ruff check agent tests

# frontend
npm test
npm run typecheck
npm run lint
npm run verify
```

`npm run test:e2e`는 승계한 `/comparison`과 갤러리 회귀 테스트다. 새 대시보드의 실제 사용자 흐름은 Playwright CLI로 확인하고 `frontend/output/playwright/`에 증거를 저장한다. 기존 테스트는 소유하지 않은 서버를 재사용하지 않는다. 이 작업이 소유한 실행 서버에서 기존 E2E를 돌릴 때만 `E2E_EXTERNAL_SERVERS=1`을 사용한다.

[문서 지도](docs/README.md) · [사용자 시나리오](docs/stock/user-scenarios.md) · [제품 설계](docs/stock/business.md) · [시스템 설계](docs/stock/system.md)
