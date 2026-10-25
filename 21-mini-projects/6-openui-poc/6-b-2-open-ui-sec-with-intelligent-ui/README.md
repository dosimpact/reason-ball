# SEC document comparison + Intelligent UI

[전체 예제 비교](../README.md) · [프런트엔드 안내](frontend/README.md) · [백엔드 안내](backend-langgraph/README.md)

6-2의 문서 비교 앱을 독립 복사하고, 6-3의 추가 UI 기능을 통합한 프로젝트다. 원본 환경 파일은 그대로 복사했다. 기존 문서 검색/출처/SQLite 대화 저장을 유지한다. SEC 실시간 수집기를 추가한 것은 아니며, 준비된 보고서를 검색한다.

## 실행

백엔드(2038):
```bash
cd backend-langgraph
uv sync --frozen
uv run langgraph dev --port 2038 --no-browser
```

프런트엔드(3046):
```bash
cd frontend
npm ci
npm run generate
npm run dev
```

http://127.0.0.1:3046 — 문서 비교와 인터랙티브 요청. 개발 모드의 `/gallery`는 변환된 45개 예제, `/preview`는 검증용 렌더러다. `Documents`에서 준비된 보고서를 확인한다. 로컬 PDF를 추가하면 백엔드에서 `uv run prepare-documents`를 실행한다.

## 통합 규칙

6-2의 84개 컴포넌트 이름과 기존 호출 계약을 보존한다. Card의 자식 허용 목록만 추가 확장한다. 6-3의 동명/상이한 계약 17개는 `VStack` 또는 `Iui*`로 등록한다. 중복 Label/Divider는 기존 Label/Separator를 사용한다. 배열 함수 Slice는 차트 Slice와 충돌하므로 IuiSlice로 등록한다. 결과는 137개 컴포넌트 + 59개 함수 + CopyToClipboard다.

카탈로그를 수정한 경우 `npm run generate` 후 `frontend/src/generated/system-prompt.txt`를 `backend-langgraph/agent/system-prompt.txt`로 명시적으로 복사하고 백엔드를 재시작한다.

## 검증

```bash
# backend-langgraph
uv run pytest
uv run ruff check agent tests
# frontend
npm test
npm run lint
npm run typecheck
npm run verify
npm run test:e2e
```

`test:e2e`는 설치된 Google Chrome을 headless로 사용하며 실제 OpenAI/임베딩 API를 호출한다. 기본 실행은 사용 중이지 않은 2038/3046 포트에 서버를 직접 시작하고 종료한다. 두 서버를 이 작업용으로 이미 실행한 경우만 `E2E_EXTERNAL_SERVERS=1 npm run test:e2e`를 쓴다. HTML 보고서는 `frontend/playwright-report/index.html`이다. 테스트 대화는 테스트 종료 시 삭제한다.

- [제품 설계](docs/stock/business.md)
- [시스템 설계](docs/stock/system.md)
- [전체 컴포넌트 통합 판단표](docs/stock/library-merge.md)
- [통합 및 검증 기록](docs/flow/2026-10-18-unified-library.md)

6-2에서 복사된 기존 flow/Report는 원본 프로젝트의 과거 이력이다. 환경/PDF/SQLite/검증 산출물은 Git 제외다.

## 새 환경 설정과 디렉터리 이동

실행 명령의 `cd`는 각각 이 프로젝트 루트를 기준으로 한다. Python 3.12와 uv, Node.js 20.9+ 및 npm이 필요하다. 백엔드는 `uv.lock`, 프런트엔드는 `package-lock.json`을 사용한다.

처음 실행할 때만 각 폴더의 `.env.example`을 `.env`로 복사한다. 기존 `.env`는 보존한다. 백엔드에 `OPENAI_API_KEY`를 설정하고, 프런트엔드에는 `LANGGRAPH_API_URL=http://127.0.0.1:2038`를 명시한다. 복사된 예시 파일의 주소가 다르면 이 프로젝트 포트로 바꾼다.

이동 후 실행 문제가 생기면 이 프로젝트 서버를 종료한 뒤 다음을 실행한다. `.langgraph_api`, PDF, SQLite, 브라우저 저장 데이터는 캐시 정리 대상에서 제외한다.

```bash
# frontend/에서
rm -rf .next
npm ci
# backend-langgraph/에서
uv sync --frozen --reinstall-package langgraph-cli
```

이후 위 실행 절차로 재시작한다. 캐시 재생성이나 HTTP 200 확인은 실제 모델 응답·브라우저 상호작용 검증과 별개다.

이 예제와 `6-a-3-openui-shadcn-langgraph-py`는 기본 포트 2038/3046을 공유한다. 기본 설정으로 동시에 실행하지 않는다. 동시 실행 시 백엔드 `--port`, 프런트엔드 `dev` 포트, `LANGGRAPH_API_URL`과 테스트 설정을 함께 변경한다.
