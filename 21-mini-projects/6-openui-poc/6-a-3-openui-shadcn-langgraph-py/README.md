# OpenUI shadcn + Python LangGraph

[전체 예제 비교](../README.md) · [프런트엔드 안내](frontend/README.md) · [백엔드 안내](backend-langgraph/README.md)

`original-reference/openui/examples/design-systems/shadcn`의 프런트엔드를 가져와 Python LangGraph / DeepAgents 백엔드에 연결한 독립 예제다.

## 구현

- 화면·스타터·Tailwind 테마·shadcn UI primitives·OpenUI 컴포넌트 카탈로그는 참조 예제에서 복사했다.
- 브라우저는 `shadcnChatLibrary`로 모델의 OpenUI Lang 응답을 렌더링한다.
- `fetchLLM` + `agUIAdapter()` → Next.js `/api/chat` → `createLangChainStreamResponse` → Python LangGraph.
- Python이 OpenAI 모델과 날씨·주가·검색 도구를 실행하고 `custom:openui` 스트림을 전달한다. 도구 데이터는 mock이다.
- 참조 예제의 프런트엔드 OpenAI 직접 호출·JS 도구 루프는 가져오지 않았다.
- 채팅·생성 UI 상태는 앱 전용 localStorage에 저장하며 새로고침 후 복원한다. 처음 열면 실제 모델로 생성한 use case별 예제 기록 7개가 채워진다.

## 실행

프로젝트 루트에서 터미널 1:

```bash
cd backend-langgraph
uv sync --frozen
cp .env.example .env # 최초 한 번만; 기존 .env를 덮어쓰지 않는다
# .env에 OPENAI_API_KEY 설정; 선택적으로 OPENAI_MODEL 설정
uv run langgraph dev --port 2038 --no-browser
```

터미널 2:

```bash
cd frontend
pnpm install --frozen-lockfile
cp .env.example .env # 최초 한 번만
pnpm generate
pnpm sync:prompt
pnpm dev
```

프런트엔드: http://127.0.0.1:3046 · 백엔드: http://127.0.0.1:2038 · API 문서: http://127.0.0.1:2038/docs

프런트엔드 `.env`는 `LANGGRAPH_API_URL=http://127.0.0.1:2038`, `LANGGRAPH_ASSISTANT_ID=agent`를 사용한다. OpenAI 키는 백엔드에만 둔다.

## 카탈로그 수정

`frontend/src/lib/shadcn-genui/` 또는 `src/library.ts` 수정 후 `frontend`에서:

```bash
pnpm generate
pnpm sync:prompt
```

이후 백엔드를 재시작한다. `spec.json`은 계약 확인용이며 Python 모델은 동기화된 `agent/system-prompt.txt`를 읽는다. 런타임에 프런트엔드 파일을 직접 읽지 않는다.

## 검증

```bash
# backend-langgraph/
uv run pytest
uv run ruff check agent tests

# frontend/
pnpm generate
pnpm typecheck
pnpm lint
pnpm build
pnpm test:smoke # 두 서버 실행 및 실제 모델 API 필요
pnpm test:e2e   # 두 서버와 설치된 Google Chrome 필요; 실제 모델 API 사용
```

E2E는 Python 주가 도구 → SSE → shadcn Tabs/Table 렌더링과 탭 전환을 검증한다. HTML 보고서는 `frontend/output/playwright/report/index.html`에 저장한다. 의존성 설치 폴더와 출력·환경 파일은 Git에서 제외한다.

## 문서와 출처

- [제품 설계](docs/stock/business.md)
- [시스템 설계](docs/stock/system.md)
- [통합 및 검증 기록](docs/flow/2026-10-25-shadcn-langgraph.md)
- [복사 출처와 변경 범위](docs/stock/source-provenance.md)
- 원본 라이선스: [OPENUI-LICENSE](frontend/OPENUI-LICENSE)

`Report.md`, `Report-비교-a2ui비교.md`는 기반 예제에서 복사한 과거 분석 자료다. 현재 구현은 위 stock 문서를 따른다.

## 새 환경 설정과 디렉터리 이동

실행 명령의 `cd`는 각각 이 프로젝트 루트를 기준으로 한다. Python 3.12와 uv, Node.js 20.9+ 및 pnpm이 필요하다. 백엔드는 `uv.lock`, 프런트엔드는 `pnpm-lock.yaml`을 사용한다.

처음 실행할 때만 각 폴더의 `.env.example`을 `.env`로 복사한다. 기존 `.env`는 보존한다. 백엔드에 `OPENAI_API_KEY`를 설정하고, 프런트엔드에는 `LANGGRAPH_API_URL=http://127.0.0.1:2038`를 명시한다. 복사된 예시 파일의 주소가 다르면 이 프로젝트 포트로 바꾼다.

이동 후 실행 문제가 생기면 이 프로젝트 서버를 종료한 뒤 다음을 실행한다. `.langgraph_api`, PDF, SQLite, 브라우저 저장 데이터는 캐시 정리 대상에서 제외한다.

```bash
# frontend/에서
rm -rf .next
pnpm install --frozen-lockfile
# backend-langgraph/에서
uv sync --frozen --reinstall-package langgraph-cli
```

이후 위 실행 절차로 재시작한다. 캐시 재생성이나 HTTP 200 확인은 실제 모델 응답·브라우저 상호작용 검증과 별개다.

이 예제와 `6-b-2-open-ui-sec-with-intelligent-ui`는 기본 포트 2038/3046을 공유한다. 기본 설정으로 동시에 실행하지 않는다. 동시 실행 시 백엔드 `--port`, 프런트엔드 `dev` 포트, `LANGGRAPH_API_URL`과 테스트 설정을 함께 변경한다.

## use case별 generative UX 보기

http://127.0.0.1:3046 에서 왼쪽 상단 **Expand sidebar** 또는 **Chat history**를 누른다. 01 스타트업 대시보드, 02 여행 계획, 03 주식 비교, 04 행사 RSVP 폼, 05 팀 스탠드업, 06 레시피 카드, 07 차트 쇼케이스를 선택해 볼 수 있다.

예제는 이미 생성된 응답이므로 열람에 모델 호출이 필요하지 않다. 새 질문·후속 버튼은 실제 API를 호출한다. 수치·날짜는 예제 데이터다. 새로고침 후 기록과 마지막 선택을 복원하며 기존 사용자 기록을 덮어쓰지 않는다.

명시적으로 예제 소스를 다시 생성하려면 두 서버가 실행된 상태에서 frontend의 `pnpm generate:history`를 사용한다. 이 명령은 모델 비용이 발생하며 기존 브라우저 기록은 자동 교체하지 않는다.
