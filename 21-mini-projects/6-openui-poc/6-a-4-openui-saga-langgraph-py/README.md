# OpenUI Saga + Python LangGraph

Grafana Saga의 React 구현인 `@grafana/ui@13.3.0`을 OpenUI Lang 카탈로그로 연결하는 예제다. `6-a-3-openui-shadcn-langgraph-py`를 보일러플레이트로 복사했으며 Saga 컴포넌트 어댑터와 채팅·갤러리를 구현한다.

## 실행

백엔드 (프로젝트 루트 기준):

```bash
cd backend-langgraph
uv sync --frozen
cp -n .env.example .env
# .env의 OPENAI_API_KEY 설정
uv run langgraph dev --port 2040 --no-browser
```

별도 터미널에서 프런트엔드:

```bash
cd frontend
pnpm install --frozen-lockfile
pnpm generate
pnpm sync:prompt
pnpm dev
```

- 채팅: http://127.0.0.1:3048
- 컴포넌트 갤러리: http://127.0.0.1:3048/gallery
- Python API: http://127.0.0.1:2040/docs

Python 3.12, uv, Node.js 20.9 이상, pnpm이 필요하다. 각 프로젝트의 lockfile을 사용한다. OpenAI 자격 증명은 백엔드만 소유한다. 갤러리와 저장된 예제 열람에는 모델 호출이 필요하지 않으며 새 질문에는 모델 API 비용이 발생한다.

## 지원 범위

고정 패키지의 공개 runtime export 363개를 전수 분류했다. 유지되는 공개 시각 컴포넌트 181개와 자체 SagaForm을 지원하며, 루트 SagaPage를 포함한 OpenUI 등록은 183개다. 182개 제외 항목은 deprecated/비시각 API/Grafana 실행환경 의존 등의 사유를 갤러리에 표시한다. 각 어댑터는 직렬화 가능한 props 부분집합을 제공한다.

## 개발과 검증

프런트엔드에서 `pnpm generate` 후 `pnpm sync:prompt`를 실행하고 Python을 재시작한다. `pnpm audit:catalog`로 고정 패키지의 공개 export 누락을 검사하고 `pnpm typecheck`, `pnpm lint`, `pnpm build`로 정적 검증한다. 백엔드에서는 `uv run pytest`, `uv run ruff check agent tests`를 실행한다. `pnpm test:gallery`는 실행 중인 프런트엔드에서 모델 호출 없이 전체 갤러리를 검사하고 테스트 브라우저를 종료한다. `RUN_LIVE_E2E=1 pnpm test:e2e saga-chat`는 두 서버와 실제 모델 자격 증명을 사용한다. 브라우저 검증과 실제 모델 검증의 결과는 flow 문서에서 구분한다.

## 문서

- [제품 설계](docs/stock/business.md)
- [시스템 설계](docs/stock/system.md)
- [출처](docs/stock/source-provenance.md)
- [Saga 전환 기록](docs/flow/2026-11-10-saga-migration.md)
- [Saga 공식 문서](https://grafana.com/developers/saga/about/overview/)

이전 날짜의 flow와 Report 파일은 복사된 과거 분석 기록이며 현재 구현의 검증 결과가 아니다.
