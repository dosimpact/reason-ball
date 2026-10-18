# OpenUI Dynamic Canvas × Python LangGraph

`analytics-template`의 Canvas UX를 OpenUI로 구현한 로컬 분석 PoC다. Chat 미리보기를 추가·드래그하거나 자연어로 Canvas에 직접 차트를 만든다. 탭, 위젯 이동·정렬·크기 조절, AI 수정, 브라우저 저장·복원을 지원한다. `6-3`의 전체 OpenUI 채팅은 `/chat`에 유지한다.

Python은 실제 DuckDB 합성 매출·광고 데이터를 조회한다. 최초 분석과 자연어 변경은 LangGraph가 처리하고, 필터·새로고침·1분 polling은 등록 쿼리 API로 실행해 모델을 호출하지 않는다. `reference/analytics-template`와 `reference/tambo`는 참고 소스이며 앱 런타임에 연결하지 않는다.

## 실행

백엔드 터미널:

```bash
cd backend-langgraph
uv sync --frozen
# 최초 설정 때만 .env.example을 .env로 복사하고 OPENAI_API_KEY 설정
uv run langgraph dev --port 2037 --no-browser
```

프런트엔드 터미널:

```bash
cd frontend
npm ci
npm run generate
npm run generate:canvas
# 최초 설정 때만 .env.example을 .env로 복사
npm run dev
```

[Dynamic Canvas](http://127.0.0.1:3045) · [전체 OpenUI 채팅](http://127.0.0.1:3045/chat) · [개발 갤러리](http://127.0.0.1:3045/gallery)

`backend-langgraph/.env`의 기존 키를 사용한다. 프런트엔드는 `LANGGRAPH_API_URL=http://127.0.0.1:2037`만으로 백엔드에 연결한다. 두 프로젝트의 설치·빌드는 독립적이며 런타임 통신은 HTTP다. 브라우저 테스트 fixture 준비만 개발 도구로 Python CLI를 호출한다.

## 사용 예

1. “매출과 광고비 차트를 Canvas에 각각 만들어줘.”
2. 매출 위젯 선택 → “이 차트만 한국 지역 최근 6개월로 바꿔줘.”
3. “캔버스 차트의 의미를 설명만 해줘.”
4. 지역·기간 필터나 새로고침 버튼으로 모델 없이 데이터 조회.
5. 위젯의 갱신 정책을 수동 / 1분마다 / 현재 값 보관 중 선택.

관리용 합성 데이터 정정:

```bash
cd backend-langgraph
uv run python -m agent.fixtures correct --delta 1000
```

최신 KR 매출에 1000 USD를 더하고 원천 revision을 증가시킨다. Canvas에서 해당 위젯을 새로고침하면 데이터와 기준 시점만 갱신되고 프로그램·입력 상태는 유지된다. 쿼리와 DuckDB는 `backend-langgraph/runtime/`, 문서·표시 결과·입력값은 이 브라우저의 localStorage에 저장한다.

## 검증

```bash
# backend-langgraph/
uv run pytest -q
uv run ruff check agent tests
uv build

# frontend/
npm test
npm run lint
npm run typecheck
npm run verify

# 두 서버 실행 후 frontend/에서
npm run test:smoke                 # 기존 Chat의 실제 모델·도구·후속 대화
npm run test:browser               # 실제 모델 Canvas 생성·수정·설명·Add
npm run test:browser:interactions  # 실제 제목·pie·Markdown·탭·카운터
npm run test:browser:context       # 중복 제목·없는 대상 확인
npm run test:browser:ux            # drag/resize/복원/실패/중단/갱신 fixture
```

브라우저 검사는 고정 버전 `@playwright/mcp`를 MCP SDK로 실행하고 `browser_run_code_unsafe` 등 실제 MCP 도구를 호출한다. 시스템 Chrome을 격리 프로필·headless로 열며, 성공·실패 모두 `finally`에서 `browser_close`와 MCP transport 종료를 수행한다. 증거는 Git에서 제외된 `frontend/output/playwright/`에 저장된다. provider 검사에는 API 호출 비용이 발생한다. UX 검사의 correction 단계는 로컬 합성 데이터만 변경한다.

컴포넌트 계약을 바꾼 경우 생성한 두 프롬프트를 `backend-langgraph/agent/{system-prompt,canvas-prompt}.txt`에 명시적으로 복사하고 Python 서버를 재시작한다. backend 패키지는 자체 프롬프트 자산만 읽는다.

## 문서와 지원 범위

- [요구사항](요구사항.md): B~E 범위와 검증 기준
- [제품 설계](docs/stock/business.md), [시스템 설계](docs/stock/system.md): 현재 구현
- [구현·검증 기록](docs/flow/2026-10-18-canvas-implementation.md): 요구사항별 증거와 제한
- [백엔드](backend-langgraph/README.md), [프런트엔드](frontend/README.md)

현재는 단일 로컬 사용자용 PoC다. 계정 동기화·공유·보고서·운영 CDC/push와 임의 OpenUI root 내부 카드의 자동 추출은 후속 범위다. Add/drag는 독립 root 또는 전체 응답을 복사한다. 지원 호환성은 고정 OpenUI 버전과 명시적 문서 v1→v2 fixture에 한정한다. 합성 데이터와 기존 Chat mock 도구를 실시간 외부 데이터로 표시하지 않는다. 과거 복사된 flow 기록은 원본 프로젝트의 이력이다.
