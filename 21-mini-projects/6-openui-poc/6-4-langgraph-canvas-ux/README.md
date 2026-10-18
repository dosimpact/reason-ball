# OpenUI Chat + Canvas · Python LangGraph + DuckDB


Chat에서 “매출과 광고비 차트를 canvas에 각각 만들어줘”로 시작한다. 차트를 선택하고 기간·지역·표현 변경을 요청할 수 있다. 데이터 새로고침과 polling은 저장된 SQL을 실행하며 모델을 다시 호출하지 않는다. Snapshot 모드는 현재 결과를 보관한다. 모든 분석 수치는 합성 데이터다.

실제 원천 변경 시뮬레이션은 backend 디렉터리에서 `uv run simulate-analytics` 실행 후 해당 위젯을 새로고침한다. 이 명령은 다음 조회 시 적용할 로컬 변경 요청을 만들며 현재 일자의 매출을 지역별로 100씩 증가시킨다. 위젯은 브라우저에 자동 저장되고, 호환되지 않는 저장본은 읽기 전용 데이터 표로 표시한다.

현재 계약은 [제품 설계](docs/stock/business.md), [시스템 설계](docs/stock/system.md), [검증 기록](docs/flow/2026-10-18-canvas-implementation.md)을 따른다. `Report.md`와 이전 flow는 복사 원본의 배경 기록이며 현재 완료 증거가 아니다.

두 개의 독립 프로젝트다. 각 폴더에 별도 의존성, 환경변수, 실행·검증 명령이 있으며 HTTP로만 연결한다.

```text
6-4-langgraph-canvas-ux/
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
Browser → frontend /api/workspace/run → Python /canvas/run
        ← Chat AG-UI + Canvas events ← LangGraph planner + tools
Canvas → /api/workspace/query/{id} → Python saved SQL → DuckDB
```

## 실행

터미널 1 — Python 백엔드:

```bash
cd backend-langgraph
uv sync --frozen
# 최초 설정 시에만: cp .env.example .env
# .env에 OPENAI_API_KEY 설정
uv run langgraph dev --port 2037 --no-browser
```

터미널 2 — Next.js 프런트엔드:

```bash
cd frontend
npm ci
npm run generate
# 최초 설정 시에만: cp .env.example .env
npm run dev
```

http://localhost:3045 에 접속한다. 프런트엔드의 `LANGGRAPH_API_URL` 기본값은 `http://127.0.0.1:2037`다. 각 프로젝트는 자신의 폴더만 복사해도 설치·실행 가능하다. 백엔드에는 Node.js가, 프런트엔드 설치·빌드에는 Python이 필요하지 않다.

날씨·주가·검색 도구는 mock 데이터다. OpenAI 모델 호출은 실제 API를 사용한다. 키는 `backend-langgraph/.env`에만 두고, 프런트엔드는 백엔드 주소와 배포 인증 설정만 갖는다.

## 검증

```bash
# backend-langgraph에서
uv run pytest
uv run ruff check agent tests

# frontend에서
npm test
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

프롬프트를 Python 자산에 동기화한 후 실행 중인 Python 서버를 재시작해야 한다. 텍스트 자산 변경만으로 자동 재로드되지 않을 수 있다.

## Intelligent UI 이관
UI 원본은 `22-reverse-engineering/open-intelligent-ui`이며 src/lib 43개 파일을 그대로 복사했다. 지도/사진/함수/액션/브라우저 저장을 포함하고, 모델 실행은 Python으로 연결했다. 라이선스는 frontend/INTELLIGENT-UI-LICENSE에 있다. 개발 중 전체 UI 예제는 http://127.0.0.1:3045/gallery 에서 확인한다.

[현재 시스템 설계](docs/stock/system.md) · [검증 및 알려진 한계](docs/flow/2026-10-18-intelligent-ui-python.md)

## Chrome E2E

`frontend`에서 `npm run test:e2e`를 실행하면 테스트가 전용 서버 두 개와 headless Chrome을 생성하고 종료한다. 포트 2037/3045가 비어 있어야 한다. 이미 직접 실행한 이 프로젝트 서버를 검사할 때만 `BASE_URL=http://127.0.0.1:3045 npm run test:e2e`를 사용한다. 모델을 사용하는 테스트에는 backend API 키가 필요하다. 보고서는 `frontend/output/playwright-report/index.html`에 생성된다.

계정 인증·공유·보고서·임의 Chat Root 일부 추출·운영 push/CDC는 이번 PoC 범위가 아니다. 고정 카탈로그의 CanvasChart를 위젯별 Renderer에 연결하며, 임의 OpenUI 버전의 자동 하위 호환성을 보장하지 않는다.
