# Lite Canvas UX

공급업체 리포트를 대화로 요청하면 LangGraph 메인 에이전트가 리포트 서브에이전트로 라우팅하고, Intelligent UI로 생성한 리포트가 옆 Canvas에 스트리밍된다.

- `공급업체1 리포트 생성해줘`: KPI·차트·필터·근거로 구성한 리포트.
- `리포트 다시 만들어줘`: 현재 thread의 리포트 하나를 새 ID로 교체.
- 리포트 텍스트 드래그 → **채팅에 물어보기**: 인용과 현재 리포트/원문을 근거로 질문.
- `공급업체1 PDF 보고서용으로 리포트 만들어줘`: 탭·필터 없이 주요 내용을 펼친 정적 리포트.
- `공급업체1의 W1/W2 광고 매출 비교해줘`: 원문을 조회해 채팅 Intelligent UI로 답변. Canvas를 교체하지 않는다.
- **PDF 저장**: 브라우저 인쇄에서 PDF 저장.
- **공유 링크**: 발행 후 `/reports/{reportId}`에서 같은 렌더러로 조회.

## 실행

백엔드:

```bash
cd backend-langgraph
uv sync --frozen
uv run langgraph dev --port 2040 --no-browser
```

프런트엔드:

```bash
cd frontend
npm ci
npm run generate
npm run dev
```

접속: http://127.0.0.1:3048

복사된 `.env`를 사용한다. 백엔드가 `OPENAI_API_KEY`를 소유하고 프런트엔드는 `LANGGRAPH_API_URL=http://127.0.0.1:2040`으로 연결한다. 기본 모델은 메인/질문 `gpt-4.1-mini`, 생성/수치검토 `gpt-5.4`이며 백엔드 `OPENAI_MODEL` / `OPENAI_REPORT_MODEL`로 변경한다. 검증 endpoint `OPENUI_VALIDATOR_URL`의 기본값은 `http://127.0.0.1:3048/api/program/validate`다.

두 서버가 모두 실행되어야 리포트를 생성할 수 있다. 제공된 공급업체1~8의 원문에는 의도적으로 불일치한 수치가 있으며, 원문 주장과 직접 계산을 구분해 표시한다. AI의 검토가 모든 사실 오류를 보증하지는 않는다.

## 검증

```bash
# backend-langgraph
uv run pytest
uv run ruff check agent tests

# frontend
npm run typecheck
npm run lint
npm test
npm run verify
npm run test:e2e
```

`test:e2e`는 Chrome을 사용하며 실제 OpenAI 호출 비용이 발생한다. 서버가 없으면 테스트가 2040/3048 서버를 시작하고 종료한다. 직접 실행해 둔 이 프로젝트 서버를 사용할 때만 `CANVAS_USE_RUNNING_SERVER=1 npm run test:e2e`를 사용한다. 다른 프로젝트 서버를 재사용하지 않는다.

브라우저 증거는 `frontend/output/playwright/`, SSE/검증 결과는 `frontend/output/validation/`, PDF는 `frontend/output/pdf/`, Playwright HTML 보고서는 `frontend/playwright-report/`에 생성된다. 실행 데이터와 검증 산출물은 Git에서 제외된다.

## 구조

- `backend-langgraph/agent/graph.py`: 메인 라우터, 리포트 서브그래프, 인용 답변, 검증/수정.
- `backend-langgraph/agent/reports.py`: 원문 카탈로그, KPI 계산, SQLite 리포트 저장소.
- `frontend/src/canvas/`: 분할 화면, SSE 소비, 리포트 Renderer, 인용 UI, 인쇄.
- `frontend/src/app/reports/[reportId]/`: 발행된 리포트 조회 화면.
- `test-set/`: 제공된 원본 자료. 백엔드는 자신의 패키지 데이터 복사본을 읽는다.

현재 서비스 origin으로 공유 링크를 만든다. 로컬 주소는 해당 서비스에 접근할 수 있는 환경에서만 열리며 인터넷 배포는 포함하지 않는다. 재생성하면 이전 report ID와 공유 링크는 제거된다.

[문서 지도](docs/README.md) · [현재 제품 설계](docs/stock/business.md) · [현재 시스템 설계](docs/stock/system.md)

## 범용 Intelligent UI

`Plan a relaxed afternoon exploring Lisbon, with three stops and a map`처럼 일반 요청을 입력하면 채팅에서 지도·카드·폼을 렌더링한다. 공급업체 리포트 요청은 Canvas로 분리된다. 범용 모델은 `OPENAI_UI_MODEL`(기본 gpt-4.1-mini)이며 기존 날씨/주가/검색 도구는 데모 데이터다.
