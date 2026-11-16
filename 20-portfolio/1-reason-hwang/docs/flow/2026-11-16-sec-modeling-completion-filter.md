# SEC 모델링 완료 단계 필터 — 2026-11-16

- 결정: SEC-MODELING-ADMIN-003
- 요청: 공시별 진행 상태 테이블에서 모델링 1·2·3 완료 공시 필터링.
- 설계: 단계별 체크박스, 여러 단계는 AND. 완료는 최근 실행 SUCCEEDED가 아닌 현재 원문에 유효한 게시 readiness=ready.
- 목록 전체 범위에서 필터링 후 페이지네이션하며 total·overview에 동일 조건을 적용한다.
- 원문 변경, 모델링 2 입력 generation 변경, 미지원 양식, 미게시 결과는 완료에서 제외한다.
- 상태 서비스 장애는 필터 결과가 0건이라고 오인하지 않도록 실패로 알린다.
- 기존 관리 화면 작업의 사용자 API-only/브라우저 제외 범위를 유지한다. Playwright·Storybook 실행은 제외한다.
- 현재 설계 반영 대상: [SEC 모델링](../stock/us-corporate-filings/sec-modeling.md).

## 구현·검증 기록

- UI: 단계별 체크박스·AND 안내·적용 조건 요약·전체 초기화. 기존 Apply 흐름으로 첫 페이지로 이동한다.
- API: `completedStages=1,2,3`, 게시 요약과 원문 hash·모델링2 입력 generation을 비교해 페이지 분할 전에 필터링.
- 필터링 뒤 게시 상태가 달라지거나 확인 불가가 되면 목록을 잘라 total을 왜곡하지 않고 503으로 재조회하도록 알린다.
- `pnpm -C 1-fe-host test:sec-modeling`: 12/12 PASS.
- frontend 소유 파일 ESLint, `pnpm -C 1-fe-host typecheck`: PASS.
- 실제 운영 데이터는 읽기 전용 HTTP로 확인했다. `completedStages=1,2,3&limit=1`의 total=2,
  offset0=AAPL, offset1=CPNG이고 세 단계 readiness가 모두 ready다. 같은 조건 overview.totalFilings=2,
  offset1000은 items=[]이면서 total=2를 유지한다. 공시 재처리·운영 데이터 변경은 수행하지 않았다.
- Storybook 회귀 시나리오는 추가했으나 기존 사용자 예외에 따라 실행하지 않았다. 화면 상호작용 성공으로 주장하지 않는다.
- 백엔드 build PASS, Node 정책 테스트 9/9, Python 게시 요약 테스트 3/3 PASS.
- Bruno 격리 API 테스트 15 requests / 15 tests / 15 assertions PASS. 실제 Nest+전용 PostgreSQL과
  게시 상태 fixture로 단일·복수·전체 단계, stale·미지원 제외, 양식 교집합, 페이지 total, overview,
  잘못된 단계 400, 게시 서비스 장애 503, 내부 Python 요약 API의 인증 200/401을 검증했다.
- 증거: `/tmp/sec-completion-bruno-final.json`. 운영 Neo4j 쓰기나 모델링 실행은 없다.

## 격리 API 검증 재현

- 먼저 `pnpm -C 2-bff-apps build`.
- `SEC_COMPLETION_FIXTURE=1 node 2-bff-apps/scripts/serve-sec-modeling-admin-fixture.cjs`로
  소유 fixture를 실행한다(3980 Nest, 3986 상태 fixture, 전용 임시 PostgreSQL).
- `3-langgraph-fast` 디렉터리에서 `uv run python -m uvicorn tests.fixtures.sec_modeling_bulk_status_app:app --host 127.0.0.1 --port 3987`.
- `2-bff-apps/bruno-api-tests` 디렉터리에서
  `../../3-langgraph-fast/node_modules/.bin/bru run 09-modeling-completion --env-var baseUrl=http://127.0.0.1:3980/api/sec --env-var fixtureUrl=http://127.0.0.1:3986 --env-var pythonUrl=http://127.0.0.1:3987`.
- 이 collection은 fixture 전용이며 운영 서버에 장애 mode 요청을 보내는 용도로 사용하지 않는다.

## 자원 정리

- 기존 Bruno 관리 API 회귀도 새 fixture에서 22/22 PASS: `/tmp/sec-completion-regression-final.json`.
- 최초 회귀 확인에서는 완료 필터용 10-Q fixture와 이전 요청의 측정치가 기존 기대값에 영향을 주었다.
  새 fixture는 `SEC_COMPLETION_FIXTURE=1`에만 활성화하고 회귀는 깨끗한 기본 fixture로 재실행해 통과했다.
- 소유 PID 57775·58609·59010·59499·59550 종료, 3980·3986·3987 LISTEN 없음 확인.
- `sec-modeling-admin-` 전용 컨테이너 없음과 임시 build 제거 확인. 사용자 서비스·DB는 유지했다.
- 브라우저/Storybook/MCP 연결은 생성하지 않았다. 이번 수정에 대한 실제 브라우저 검증은 미실행이다.
