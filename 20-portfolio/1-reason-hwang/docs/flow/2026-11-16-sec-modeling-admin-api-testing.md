# SEC 모델링 공시 상태와 API Testing 관리 화면

- 날짜: 2026-11-16
- 결정 ID: SEC-MODELING-ADMIN-002
- 상태: API 검증·자원 정리 완료, frontend 최종 검사 결과 대기

## 요청과 경계

`/sec-modeling`의 중심을 공시별 모델링 상태의 페이지네이션 표로 바꾸고, 각 공시를 펼쳐 모델링1/2/3의 상태·실행·결과를 확인한다. 현재 상태 통계와 고정 API preset을 제공하는 API Testing 탭을 추가한다. 기존 SEC collector의 요청 편집·응답 확인 방식을 참고하되 실제 공개 모델링 API 계약을 따른다.

사용자 지시에 따라 API 수준만 검증한다. 브라우저·Playwright·Storybook 브라우저 실행을 하지 않으며 API 성공을 화면 동작 검증으로 주장하지 않는다. 실제 비용 있는 모델링 실행, 외부 SEC 쓰기와 운영 DB 변경은 검증에 포함하지 않는다. 관련 없는 SEC chat와 human-docs 변경은 보존한다.

## 초기 검증 범위와 공백

기존 Bruno `2-bff-apps/bruno-api-tests/07-modeling`은 공시 items/stage1 존재, run history envelope, 잘못된 UUID400만 확인한다. 기존 `verify-sec-modeling.cjs`는 실제 Nest+전용 PostgreSQL 컨테이너+외부 Python fixture로 실행·취소·작업 단위 계약을 확인하지만 새 상태 집계·필터·페이지 총계는 별도 검증이 필요하다.

필요한 API 시나리오:

1. 공시 목록 각 페이지의 items와 전체 total, 안정적인 정렬·필터 범위 및 빈 마지막 페이지를 확인한다.
2. 단계별 미실행·입력 미준비·게시됨·stale·실행 중·FAILED/CANCELLED·서비스 조회 실패를 구별한다. 과거 성공 run만으로 현재 게시 결과를 ready로 판정하지 않는다.
3. 통계는 현재 페이지 길이가 아닌 서버 정의의 전체 범위 집계인지 확인하고, 집계 조회 실패를0건으로 위장하지 않는다.
4. API Testing 고정 method/path와 편집 값의 실제 전달, 서버400 응답 보존, HTTP/네트워크/스트림 오류 분류, 취소 의미를 확인한다. preset 선택이나 탭 전환만으로 변경 요청을 보내지 않는다.
5. 전용 fixture 서버·필요시 격리 DB만 사용하고 성공·실패와 무관하게 정리 후 PID/포트/임시 자원 부재를 확인한다.

Bruno API E2E 스킬과, DB를 사용하는 경우 PostgreSQL best-practices 스킬을 적용한다. 아직 실행 검증이나 DB 변경은 수행하지 않았다.

## 관련 stock

- [SEC 모델링 도메인 계약](../stock/us-corporate-filings/sec-modeling.md)
- [공용 검증 원칙](../validation/INDEX.md)

## API 실행 결과

Bruno `2-bff-apps/bruno-api-tests/08-modeling-admin`의22개 요청/22 tests/22 assertions가 PASS했다(129ms). 생산용 Nest controller/service/store와 실제 전용 PostgreSQL 컨테이너의 SQL을 사용하고, 외부 Python 게시 상태만 fixture로 고정했다. 사용자 BFF의 dist를 덮지 않도록 TypeScript 결과를 소유 임시 디렉터리에 빌드했다.

fixture는 지원 공시6개와 집계 밖20-F1개, 원문 보유5/누락1, 최신 run과 과거 run, 현재 게시/누락/stale 상태를 만든다. 실제 모델링 실행기와 외부 공급자는 실행하지 않았다.

| 시나리오 | 확인한 결과 |
| --- | --- |
| overview | 전체6, collected5/missing1, 단계별 supported5/unsupported1; 최신 run 상태 합계5 |
| 최신 실행 집계 | jobs.latest_run_id 기준으로 과거 FAILED를 중복 집계하지 않음 |
| 페이지 | limit2의3페이지에서 공시 비중복; offset100은 items[]이면서 total6 유지 |
| 필터 | 짧은 CIK 정규화, 회사명 q·formType·sourceStatus의 목록/overview 공통 범위 |
| 게시와 실행 구분 | 게시 ready이면서 latestRun FAILED, 과거 SUCCEEDED지만 원문 없음은 input_required |
| 단계 상태 | 10-Q의1/2 unsupported,10-K/A의3 unsupported,미처리·QUEUED·stale·입력 미준비 구분 |
| 잘못된 입력 | limit0/sourceStatus/formType 오류400 |
| 일괄 게시 조회 | 해당4개 목록 페이지가 bulk1회씩(크기2/2/2/1), 개별 status HTTP0회; 빈 페이지 조회 없음 |
| 외부 상태 서비스 장애 | 행·total 유지, unavailable/serviceError; SQL overview는 동일 집계 유지 |
| Python 신규 route | 실제 인증 router+storage fixture에서 정상 결과·빈 stages,잘못된 key401,중복/101개/빈 입력422 |

Python route의 storage fixture는 실제 Neo4j 내용을 검증하는 것이 아니다. 실제 GraphStore batch 조회 정책의 단위 결과와 API 검증을 구분한다. 기존 모델링1/2/3 추출 품질·실데이터 검색 정확도 검증으로 확대하지 않는다.

Frontend executor도 실제 Nest HTTP에 연결해2건을 추가 확인했다(`1-fe-host/tests/sec-modeling/api-http.ts`). Node 실행에서 same-origin 프록시 prefix만 소유 BFF origin으로 매핑했으며 변경 없는 Host proxy 자체를 다시 시험한 것은 아니다.

- preset 요청 구성만으로 fetch가 발생하지 않음.
- overview q=AAPL 요청은 HTTP200/success,필터 범위2,headers/elapsed/전송 request snapshot을 보존.
- create-1 JSON body `null`을 그대로 전송해 서버 HTTP400/http-error/응답 본문 보존.
- 잘못된 body 전후 실제 run total7 유지: 새 모델링 job 생성0.

실행 명령:

```sh
# terminal1: actual Nest + owned PostgreSQL + external publication fixture
pnpm -C 2-bff-apps exec node scripts/serve-sec-modeling-admin-fixture.cjs
# terminal2: real authenticated Python router, deterministic storage
cd 3-langgraph-fast
SEC_MODELING_KEY=qa-bulk-only PYTHONPATH=src:tests/fixtures uv run python -m uvicorn sec_modeling_bulk_status_app:app --host 127.0.0.1 --port 3987
# from 2-bff-apps/bruno-api-tests
../../3-langgraph-fast/node_modules/.bin/bru run 08-modeling-admin --env-var baseUrl=http://127.0.0.1:3980/api/sec --env-var fixtureUrl=http://127.0.0.1:3986 --env-var pythonUrl=http://127.0.0.1:3987 --bail
# frontend actual HTTP executor checks
SEC_MODELING_TEST_BASE=http://127.0.0.1:3980 pnpm -C 1-fe-host exec node --import tsx tests/sec-modeling/api-http.ts
```

여기의 service key는 fixture 전용 고정값이며 실제 자격 증명이 아니다. 실행 증거는 `/tmp/sec-modeling-admin-bruno.json`이며 소유권 정보는 `/tmp/sec-modeling-admin-owned.json`에 기록했다. 보고서와 임시 DB·빌드는 커밋하지 않는다.

## 자원 정리

전용 Node/Nest PID42775와 Python PID42827을 정상 종료했다.3980/3986/3987 LISTEN 부재와 PID 부재를 확인했다. 소유 컨테이너 `sec-modeling-admin-6264a260-b4f8-49d2-afcb-69eee600f93f`를 삭제하고 docker inspect 부재를 확인했다. 초기 fixture 준비의2회 seed 실패와 preflight1회도 finally에서 각각 컨테이너를 제거했으며 정확히 소유한4개 이름 모두 부재다. seed 실패는 downloaded 원문의 저장 metadata 제약에 맞춰 fixture를 보완한 것으로 제품 오류가 아니다.

소유 `/tmp/sec-modeling-admin-*/build`는 삭제했다. 사용자 DB/schema·서비스·dist·브라우저·공유 MCP는 수정·종료하지 않았다. 이번 작업은 Host/Next 서버나 브라우저를 만들지 않았으므로 Next 설정 복구나 브라우저 종료 대상은 없다. 자원 정리는 완료했다.

적용 스킬: `../../.agentic-playbook-rc/apb-bruno-api-tests/SKILL.md`, `/Users/studio/workspace/projects/reason-ball/.agents/skills/supabase-postgres-best-practices/SKILL.md`. API 검증은 완료했고 frontend 최종 단위·정적 결과를 수신해 아래 최종 판정을 보완한다.
