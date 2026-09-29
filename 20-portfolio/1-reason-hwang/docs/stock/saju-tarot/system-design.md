# LangGraph·시스템 설계

> 설계 기본안 / 구현 전. 사용자 입력→결정적 근거→해석→검수→결과의 도메인 책임을 분리한다. 설치된 라이브러리의 정확한 API는 구현 시 lockfile로 확인하며 최신 문서 예제를 그대로 복사하지 않는다.

## 1. 소유권과 통합 경계

| 계층 | 새 책임·예정 위치 | 변경하지 않는 것 |
| --- | --- | --- |
| UI remote | `2-bff-apps/remotes/saju-tarot/`, template의 mount/unmount 계약 재사용 | template 원본, 1-fe-host 화면 |
| 도메인/API | `3-langgraph-fast/src/domains/fortune/`: schemas, router, service, repository, saju, tarot, content | 기존 SEC 업무 모듈 |
| 사주 그래프 | `src/graph/primary_graphs/saju_graph/`: state, nodes, workflow | main_graph 처리 흐름 |
| 타로 그래프 | `src/graph/primary_graphs/tarot_graph/`: state, nodes, workflow | simple_llm 처리 흐름 |
| 등록 | FastAPI app의 router 등록, langgraph.json 독립 graph ID 추가 | 기존 endpoint·graph ID 계약 |
| 데이터 | 기존 PostgreSQL의 langgraph 스키마 내 fortune_* 테이블·전용 checkpoint namespace | public SEC 데이터 |

공통 코드 후보는 LLM 호출 어댑터·스키마 검증·DB 접근·오류 매핑이다. 사주 규칙·카드 의미·도메인 프롬프트를 범용 shared로 올리지 않는다. workflow는 단계 연결만, 각 node는 한 수준의 업무, 순수 계산은 node 바깥 함수로 둔다.

독립 개발 진입은 새 remote Vite 서버(제안 포트 2804, 충돌 확인 필수)다. 브라우저는 같은 origin의 /api/fortune/v1을 호출하고 Vite 개발 프록시가 FastAPI로 전달한다. 이는 **이 remote의 로컬 개발 한정 경로**이며 기존 호스트의 운영 프록시 정책을 바꾸지 않는다. mount export와 standalone entry를 모두 검증한다. 기존 호스트에 노출·운영 배포하는 작업은 이번 범위 밖이며, 후속 통합 시 [공유 토폴로지](../tech-shared/system-design.md)에 맞춰 호스트 프록시/remote 등록을 별도 승인·검증한다.

## 2. 그래프 이전의 결정적 처리

사주 초안 생성: 서버 입력 검증 → 달력·시간 정규화 → 계산 어댑터 → 원국·분포 검사 → 승인된 해석 규칙 연결 → facts/hash/버전 저장 → ready.

타로 초안 생성: 서버 입력 검증 → 승인된 78장 카탈로그 확인 → 난수 Fisher–Yates 셔플 → token↔card 매핑 저장 → draft. 선택 API가 서버 배열에 대응하는 token을 검증하고, 3장 순서가 정해지면 ready. generate 트랜잭션에서 선택을 동결하고 카드 의미 스냅샷을 저장한다.

이 단계는 모델 호출이 없다. 계산 엔진/카탈로그가 준비되지 않았으면 capabilities에 unavailable을 표시한다. 개발용 fixture는 명시적인 테스트 환경에서만 허용하고 화면에 “샘플 결과”로 표시한다.

## 3. LangGraph 흐름

두 그래프의 공통 단계:

`START → load_frozen_input → build_evidence → compose → validate_structure → review_meaning → commit_result → END`

- 구조 검사 실패: repair_budget가 남으면 `repair → validate_structure`; 아니면 fail.
- 의미 검사 실패: 치명적 안전 거절은 fail, 수정 가능한 경우 한 번만 repair 후 구조·의미 재검사.
- 어느 단계에서나 삭제·만료·취소 또는 소유권 상태 불일치이면 publish하지 않고 종료.
- 사주 build_evidence: SajuFacts + 적용 가능한 승인 규칙만 선택.
- 타로 build_evidence: 확정된 3장·위치와 해당 카탈로그 의미만 선택. 덱을 다시 섞지 않음.
- compose/repair는 [프롬프트](prompts.md), 구조 검사는 [출력 계약](contracts.md), review는 제한된 품질 판정이다.

UI에서 입력과 선택을 끝낸 뒤 호출하므로 v1에 사람 응답을 기다리는 interrupt는 필요하지 않다. 후속 대화형 상담 때 별도 설계한다. 체크포인터는 그래프 복구용, 결과 테이블은 제품 조회용이다. LangGraph의 영속 checkpoint는 thread 단위 상태를 저장하므로 reading과 내부 thread를 매핑한다. [공식 persistence 문서](https://docs.langchain.com/oss/python/langgraph/persistence).

## 4. 상태 계약

GraphState 필드:
`reading_id, attempt_id, input_hash, domain, frozen_input, facts, evidence, candidate, validation_errors, review, repair_count, model_call_count, deadline_at, result_hash, error`.
typed state를 사용하고 대화 messages만으로 제품 상태를 표현하지 않는다. candidate는 UI에 노출하지 않는다. 불변 facts를 모델 응답으로 덮어쓰지 않는다.

| 제품 상태 | 진입 조건 | 다음 상태 |
| --- | --- | --- |
| draft | 타로 3장 미선택 | ready 또는 draft |
| ready | 사주 검증·계산 완료 / 타로 3장 선택 | generating, 입력 수정 시 draft/ready |
| generating | 생성 작업 DB 수락 | validating 또는 failed |
| validating | 초안/수정본 구조·의미 검사 | generating(수정), completed, failed |
| completed | 검수 통과·결과 DB commit | 변경 없음; 삭제/만료만 |
| failed | 예산 초과·오류·검수 실패 | retryable이면 generating, 아니면 새 초안 |
| expired | 생성 후 24시간 경과 | 접근 차단·삭제 |

stage는 prepare/compose/check/persist로 UI 표시만 돕는다. 제품 상태의 단일 원본은 DB reading 행이다. 체크포인트와 UI 로컬 값으로 completed를 독립 판정하지 않는다.

## 5. 실행 예산과 복구

기본 실행은 compose 1회 + reviewer 1회. 수정은 최대 1회이며 수정 뒤 reviewer 1회를 포함한다. **전체 모델 HTTP 시도 상한 6회**(compose/reviewer/repair/transport retry 모두 합산), 네트워크·429·5xx 재시도는 각 호출 1회까지·지수 지연, 전체 벽시계 90초·개별 호출 25초 제한. provider가 지원하지 않는 파라미터는 보내지 않는다. 예산은 DB attempt에 누적해 재시작으로 초기화되지 않도록 한다.

모델의 명시적 refusal은 SAFETY_REFUSAL, 재시도 불가. CONTENT_INVALID도 한 번의 repair 후 실패하면 동일 작업 자동 재시도 불가. MODEL_TIMEOUT/일시적 MODEL_UNAVAILABLE/GENERATION_INTERRUPTED만 사용자 명시적 retry 허용(최대 1회), 동일 facts/cards 유지, 새 attemptId/threadId 사용. 따라서 하나의 reading은 최대 2 attempts·총 12 HTTP 시도. 새 질문 생성은 별도 비용 제한 적용.

작업 수락 트랜잭션에서 frozen input, job 행, 멱등 키를 함께 저장하고 202 반환한다. 요청 수명에만 의존하는 background task가 아니라 **단일 프로세스의 DB 작업 소비 루프**로 처리한다. 기존 단일 Uvicorn worker 정책을 유지한다. lease 30초·5초 heartbeat, 시작 시 미완료 작업 검사:
- 미시작 queued는 처리한다.
- 만료 lease는 attempt 실행 상태와 checkpoint를 확인한다. 모델 응답 저장 지점 이후는 저장된 값으로 재개한다.
- 외부 호출 완료 여부가 불명확하면 무조건 재호출하지 않고 GENERATION_INTERRUPTED로 끝낸다. 사용자가 동일 카드로 명시적 재시도할 수 있다.
- 결과 commit은 readingId unique·owner·상태·expiresAt·deletedAt을 한 트랜잭션에서 확인한다. 이미 완료된 결과는 그대로 반환한다.

DB 효과의 중복을 막지만 외부 LLM 호출의 exactly-once를 보장한다고 하지 않는다. 그래프 checkpoint만으로 결제/외부 부수효과의 멱등성이 생기지 않는다. 모델 응답 캐시는 `attemptId+node+repairIndex+inputHash`로 저장하며 raw 응답도 24시간 수명 안에만 둔다.

## 6. 저장·보안

| 테이블 | 필수 데이터 / 제약 |
| --- | --- |
| fortune_sessions | sessionTokenHash, createdAt, expiresAt; 마지막 초안 생성 후 24h, 신규 세션으로 기존 결과 양도 금지 |
| fortune_readings | id, ownerSessionId, domain, status, revision, inputJson/inputHash, factsJson/factsHash, resultJson/resultHash, versions, createdAt/expiresAt, deletedAt |
| fortune_draws | readingId unique, revision, deckVersion, tokenMap, selection, lockedAt; 선택 전 데이터 외부 비공개 |
| fortune_attempts | id, readingId, sequence(1/2), internalThreadId, state, leaseUntil, budget, errorCode |
| fortune_idempotency | owner+method+path+key unique, requestHash, readingId, response reference |
| fortune_feedback | readingId unique, value; 읽기와 같이 만료 |

익명 쿠키는 최소 256bit 난수, HttpOnly, SameSite=Lax, 운영 Secure. 쓰기 요청은 허용 Origin 검사, JSON Content-Type 필수. CORS 와일드카드+credentials 금지. 조회도 소유자 조건으로 쿼리. 원문 입력/결과/쿠키/토큰은 URL·분석 로그·오류 추적에 넣지 않는다. 서버 키는 remote 번들에 포함하지 않는다.

세션 요청은 기존 브라우저의 유효 세션을 재사용한다. 새 초안 생성 시 해당 세션·쿠키 expiresAt을 최소 now+24h까지 갱신해 새 reading의 보관기간을 보장한다. reading.expiresAt은 항상 해당 reading.createdAt+24h이며 세션 갱신으로 과거 reading의 수명을 늘리지 않는다. 조회·polling은 어느 수명도 연장하지 않는다. 세션이 만료되면 새 세션으로 이전 결과 접근권을 복원하지 않는다.

배포 기본: TLS·저장 볼륨 암호화, checkpoint 포함 민감 데이터의 모델/관측 서비스 전송 최소화. 모델에는 닉네임/원시 생년월일 대신 계산 facts·질문·상황을 전달한다. 질문 자체는 민감할 수 있으므로 고지·provider 데이터 처리 설정 확인이 출시 게이트다. v1 민감 테이블과 checkpoint는 장기 백업 대상으로 넣지 않는다. 기존 백업에서 이를 분리할 수 없으면 24시간 삭제를 보장하는 배포를 출시하지 않는다.

1시간 간격 purge는 만료/삭제 reading의 draws/attempt payload/cache/checkpoint/feedback/멱등 키를 함께 삭제한다. 삭제 완료 후 내용 없는 집계 지표만 보관 가능. 삭제된 결과를 checkpoint 재개로 되살릴 수 없어야 한다. 원문 없는 작업 식별/오류코드 로그는 7일, 비식별 일별 집계는 30일 보관 기본안이다.

## 7. 품질·비용 관측

세션당 rolling 24h 생성 10회(명시적 retry도 포함), 동시 실행 1건, 초안 생성 30회, reset 20회로 제한한다. 익명 쿠키만으로 악의적 다중 세션을 막을 수 없으므로 공개 배포는 별도 비식별 IP 속도 제한·전체 provider 비용 상한을 갖춘다. 제한 때문에 실패한 요청은 새 카드나 빈 결과를 남기지 않는다.

모델 provider/name은 환경설정, 실제 model revision·promptVersion·schemaVersion은 결과에 저장한다. 기본 모델 선정은 [동일 평가셋 비교](quality-acceptance.md) 이후 고정한다. 특정 최신 모델의 성능을 검증했다고 쓰지 않는다. 사주 계산 엔진과 카드 콘텐츠 버전이 바뀌어도 이미 완료된 결과는 재작성하지 않는다.

구현 검사: 결정적 함수 단위 테스트, PostgreSQL 멱등/권한/복구 통합, Bruno HTTP E2E, Storybook 상태, 브라우저 업무 흐름. 상세는 [인수 기준](quality-acceptance.md).
