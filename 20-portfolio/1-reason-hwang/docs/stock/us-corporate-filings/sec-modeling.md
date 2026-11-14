# SEC 모델링과 검색

상태: 기능 구현 완료. 사용자 요청으로 추가 검증은 제외하고, 남은 실제 데이터 검증은 보류한다.
전체 인수 기준 통과를 의미하지 않는다. [구현 완료·검증 보류 기록](../../flow/2026-11-14-sec-modeling-implementation-complete.md).
결정 ID: SEC-MODELING-001. [구현 시작 기록](../../flow/2026-11-14-sec-modeling-implementation-start.md).
[실제 통합 검증 중간 기록](../../flow/2026-11-14-sec-modeling-integration-progress.md)은
모델링 1/3과 Admin에서 확인한 결과 및 남은 검증을 구분한다.

## 목적과 범위

모델링 1·2는 기존 10-K 범위를 유지한다. 모델링 3은 모든 CIK의 정확한 `10-K`·`10-Q`를 지원하며
`10-K/A`, `10-Q/A`, `20-F`, `6-K`, `8-K`는 모델링 3 대상에서 제외한다.
미국·해외 상장 보통주 기업은 도메인 목표이며, 3,714/1,020개 수치를 고정 allowlist나 처리 상한으로 쓰지 않는다.
외국 기업도 해당 양식을 제출한 경우 처리할 수 있다. 모든 외국 기업이 10-K·10-Q를 제출한다는 가정은 하지 않는다.
실제 실행·검증은 AAPL·CPNG·NVDA 세 회사 샘플에 한정하며 전체 기업 일괄 수집·처리를 시작하지 않는다.
수집 화면 `/sec-collector`와 모델링 관리 화면 `/sec-modeling`을 분리한다.
첫 검증 범위를 모든 회사·양식으로 일반화하지 않는다.

## 저장소와 실행 경계

| 소유자 | 저장·실행 책임 |
| --- | --- |
| BFF PostgreSQL | 수집 원본 HTML·메타데이터, 모델링 실행·단위 작업·이벤트 이력 |
| BFF 실행기 | 실행 접수, 중복 방지, lease, heartbeat, 취소·재시도, Python 호출 |
| FastAPI | HTML/XBRL 파싱, 청킹, 지식 추출, 임베딩, 검증과 그래프 게시 |
| Neo4j | 가공된 Item HTML·텍스트, lexical graph, XBRL 사실, 벡터, 활성 결과 버전 |
| Host | 상태 조회·실행 제어·결과 검토·검색 시험 |

원본은 PostgreSQL에만 보존한다. Neo4j 조회·화면 표시·검색은 PostgreSQL 원문 없이
동작해야 한다. sourceHash·sourceUrl은 추적 정보이며 원문 재조회 의존성이 아니다.
모델링 1·3 재실행 시 BFF가 원문을 명시적으로 전달한다. 모델링 2는 게시된 Item을 읽는다.
Redis, Qdrant, pgvector는 도입하지 않는다.

## SEC-MODELING-101: 문서 구조

`Company -FILED-> Filing -HAS_ITEM-> Item`을 구성한다.

| 노드 | 핵심 속성 |
| --- | --- |
| Company | id, cik, name, ticker |
| Filing | id, accessionNo, formType, filingDate, reportDate, sourceUrl, sourceHash, parserVersion |
| Item | id, partCode, itemCode, title, order, displayHtml, text, contentHash |

CIK와 accession number로 공시를 구분한다. 목차 링크만 믿지 않고 본문 제목·앵커·문서
순서로 Item 경계를 찾는다. Item 내부 제목·문단·목록·표를 유지한 displayHtml을 저장한다.
본문 XBRL wrapper는 값만 보존하고 숨겨진 메타데이터·실행 가능한 HTML·외부 자원은 제거한다.
text에도 표 헤더·단위·행과 열 의미가 남아야 한다. sourceLocator는 필수 저장 속성이 아니다.

## SEC-MODELING-102: 본문 지식과 임베딩

GraphRAG Toolkit의 Source, Chunk, Topic, Statement, Fact, Entity 6종을 지원한다.
6종은 개념적 처리 순서이며 모든 노드를 단일 직렬 관계로 연결한다는 뜻은 아니다.
Item 하나당 Source 하나를 생성하고 toolkit Source ID와 Item ID를 명시적으로 연결한다.
Statement·Fact에서 Chunk와 Item까지 근거를 역추적할 수 있어야 한다.

1. Item의 소제목·문단·표 구조에 따라 청킹한다. 기본 목표 800토큰, 문장 경계의 overlap은
   최대 80토큰이다. Item 경계를 넘지 않고 표 헤더·단위·설명이 분리되지 않도록 한다.
2. OAuth proxy의 추출 모델로 Topic·Statement·Fact·Entity를 추출한다. 기본 sol,
   명시적 선택 luna이며 실패했다고 다른 모델로 자동 변경하지 않는다.
3. 청크마다 중요 진술 최대 20개를 추출하며 전체 Chunk 본문은 보존한다. 모든 명제의 완전 열거를 보장하지 않는다.
   구조화 출력·참조 ID·근거·부정·가능성 표현을 검증한다. 미래 위험을 발생한 사실로 바꾸지 않는다.
4. Chunk·Statement를 `text-embedding-3-small`, 1536차원으로 임베딩한다.
5. Neo4j cosine 벡터 인덱스와 그래프 관계를 함께 조회한다. Chunk·Statement를
   하나의 1,536차원 물리 인덱스에 kind로 구분해 저장하고 두 검색 순위를 결합한다.

임베딩 API는 OAuth proxy와 별도로 연결한다. 임베딩 모델·차원·입력 생성 규칙 버전을 기록하며
서로 다른 모델의 벡터를 같은 인덱스에 혼합하지 않는다. Toolkit 패키지를 고정 버전으로 설치하고
ignored reference checkout에 런타임을 의존시키지 않는다. Neo4j vector adapter는 별도로 구현한다.

## SEC-MODELING-103: 선별형 XBRL 사실 (v2)

결정: SEC-MODELING-103-V2. Arelle 원본 파싱 → 정적 DROP → 원문 근거 연결 → 후보 배치 →
규칙·OpenAI Decisions 중요도 선별 및 단일 분류 → 결과 검증 → 게시. 모델링 1·2 결과에 의존하지 않으므로
10-Q도 원본만으로 실행한다. 필수 taxonomy 해석 실패는 성공으로 게시하지 않는다.

### 정적 사전 제외

`3-langgraph-fast/src/domains/sec_modeling/model3_policy.json`을 버전 관리한다. 정책 변경 후 worker를 재시작하여 적용한다.
`^https?://fasb\.org/us-gaap/[0-9]{4}$` namespace의 Concept는 회사·차원·기간과 무관하게 무조건 DROP한다.
접두사 문자열이 아니라 namespace URI로 판단한다. 다른 표준 taxonomy와 기업 확장 Concept는
후보로 통과하며 자동으로 중요한 것으로 간주하지 않는다. 제품·지역별 매출이나 고객 집중도도
us-gaap이면 제외되는 정책상 손실을 수용한다. 원본과 모델링 1은 삭제하거나 변경하지 않는다.

### 선별 및 근거

OpenAI Decisions API `POST https://api.openai.com/v1/decisions`, `gpt-6-luna`를 직접 호출한다.
OAuth proxy·Chat Completions·Responses API로 대체하거나 자동 fallback하지 않는다.
`SEC_DECISIONS_API_KEY`가 있으면 사용하고, 없으면 공용 OpenAI API 키인 `OPENAI_API_KEY`를 사용한다.
기존 `OPENAI_BASE_URL`은 OAuth proxy일 수 있으므로 Decisions의 base URL로 사용하지 않는다.

후보별 predicate 질문으로 중요도 확률, choice 질문으로 단일 분류와 각 선택지 확률을 받는다.
초기 정책은 importanceProbability >= 0.7 및 categoryConfidence >= 0.6을 모두 만족할 때 선정한다.
이 임계값은 검증된 정확도 보장이 아닌 조정 가능한 초기값이다. `OTHER`도 동일한 중요도 기준을 적용한다.
거절 응답·불충분한 근거는 선정하지 않는다. 응답의 질문 ID·개수·중복·분류 enum·확률 범위를 검증한다.
값·단위·기간은 Arelle 결과를 그대로 저장한다. 표 행·헤더, 인접 본문과 Inline XBRL continuation을
길이 제한 안에서 추출하고, 잘린 근거에는 truncated를 표시한다. sourceFactId가 없으면 파서가 생성한
위치 기반 sourceXPath로 연결한다. 원문은 신뢰하지 않는 입력이며 그 안의 지시를 따르지 않는다.

Decisions는 자유 설명문을 생성하지 않는다. selectionReason은 모델이 작성한 설명이 아니라 반환 확률,
선택 분류와 임계값을 사용한 결정적 정책 판정문이다. 근거 ID도 모델이 생성하지 않고 원문 연결기의 ID를 사용한다.
importanceProbability, categoryConfidence, categoryProbabilities와 selectionProvider/Model을 저장한다.
잘못된 의미 해석을 기계 검증만으로 보증하지는 않는다.

후보는 메모리에서 처리하며 미선정 Fact를 그래프에 저장하지 않는다. 정책·프롬프트 hash를 기록한다.
배치 사이 취소와 generation 게시·fencing 경계를 유지하고 workUnitId 및 제공자 usage를 진행 이벤트로 전달한다.
로컬 결정 캐시는 정책/프롬프트/제공자/모델/후보 내용으로 구분하고 이전 OAuth 결과를 재사용하지 않는다.
API 응답의 확률과 분류를 캐시에서도 재검증한다. 캐시·키는 커밋하지 않는다.

공식 명세: [Decisions 가이드](https://developers.openai.com/api/docs/guides/decisions),
[Create a decision](https://developers.openai.com/api/reference/resources/decisions/methods/create).
요금은 호출 횟수 고정 가격이 아니라 입력 토큰·캐시에 따라 달라진다. 출력 토큰은 과금하지 않는다.

### 그래프 스키마

```text
Company -FILED-> Filing -HAS_XBRL_FACT-> XbrlFact -OF_CONCEPT-> Concept
```

- Company·Filing 재사용. 추가 도메인 노드는 XbrlFact·Concept 2종이다.
- XbrlFact: decimal 문자열 값, rawValue, valueType, decimals/scale/sign/format/isNil,
  기업 식별자, 기간 종류·날짜, sourceContextIds, dimensionsJson, unitJson, evidenceJson,
  sourceFactId/sourceXPath, duplicateGroup/conflict, parserVersion/taxonomyHash, filingId/generationId,
  analysisCategory, importanceProbability, categoryConfidence, categoryProbabilitiesJson, selectionReason,
  selectionPolicyVersion/Hash, selectionPromptHash, selectionProvider/Model.
- Concept: namespaceUri, localName, label, dataType, periodType, balance, taxonomyHash, generationId.
  namespace·taxonomy 차이를 무시해 기업 간 Concept를 병합하지 않는다.
- Context·Dimension·DimensionValue·Member·Unit 노드는 생성하지 않는다. 그 정보는 Fact 속성에 보존한다.
- XbrlFact에 SecRecord 라벨도 붙여 같은 물리 노드를 조회용으로 재사용한다. 별도 Fact 복제 노드는 만들지 않는다.
  공시별 조회에 SecRecord.generationId 인덱스를 사용한다. API는 기존 context/dimensions/unit 객체 형태를 유지한다. source evidence는 가공된 텍스트이며 원본 HTML 복사가 아니다.

### 단일 분류

`analysisCategory`는 다음 enum 하나이며 배열이나 `isBusinessKpi`는 사용하지 않는다.

| 값 | 범위 |
| --- | --- |
| OPERATING_PERFORMANCE | 기업 KPI·고객·판매량·제품/사업부/지역별 실적·수익성·운영 효율 |
| INVESTMENT_AND_RESTRUCTURING | 설비/지분 투자·인수·매각·사업 진출/철수 |
| DEPENDENCIES_AND_COMMITMENTS | 거래처/지역 집중·구매 약정·리스·공급자 금융 |
| CAPITAL_AND_SHAREHOLDER_RIGHTS | 일반 차입·발행·배당·자사주·의결권·희석 |
| LEGAL_REGULATORY_AND_INCIDENTS | 소송·규제·세무 분쟁·사이버 사고·보상 |
| OTHER | 나머지 중요한 사실; 근거 부족을 대신하지 않음 |

직접 측정한 대상을 기준으로 한다. 인수 대금은 투자, 인수 자금 차입은 자본 구조다.
신사업 매출은 운영 성과, 투자액은 투자다. 소송 보상은 지급 의무여도 법률·규제·사고다.
자사주 매입 승인은 자본 정책이며 미래 지급 의무로 바꾸지 않는다. 각 분류의 중요도는 별도 판단한다.

### 초기화와 지원 경계

`uv run --env-file .env python scripts/reset_sec_model3.py`는 삭제 대상만 계산하고 `--apply`로 실행한다.
생성된 모델링 3 도메인·조회·게시 노드만 대상으로 하며 실행 중인 작업이 있으면 중단한다.
Company/Filing/Item/SecVector는 보호하고, PostgreSQL 원본·실행 이력은 보존한다.
관리 화면은 그래프 게시 상태를 현재 결과의 기준으로 사용하여 과거 SUCCEEDED 이력을 현재 결과로 오인하지 않는다.
2026-11-15 사용자 지시로 기존 모델링 3 데이터 삭제 후 재구축한다. 실제 삭제·샘플 검증 결과는 flow에 기록한다.

## SEC-MODELING-104: 실행 상태와 결과 게시

PostgreSQL `sec_modeling` namespace에 jobs, runs, work_units, events를 관리한다.
공시·단계별 활성 실행의 중복을 DB에서 막는다. 짧은 transaction으로 claim한 뒤 DB lock을
유지하지 않고 Python을 호출한다. lease와 execution token으로 오래된 실행기의 갱신을 차단한다.
재시도는 새 run으로 생성하고 이전 오류·이벤트를 보존한다. 청크별 성공 결과를 검증 후 재사용한다.

Neo4j 결과는 generation별 staging으로 생성한 뒤 검증을 통과한 generation만 활성화한다.
검색·결과 목록은 활성 generation만 사용한다. 이미 게시된 과거 generation의 evidence ID는
인용 재현을 위해 조회할 수 있고 `isActive`로 현재 활성 여부를 함께 반환한다. staging 근거는 공개하지 않는다. 실패·취소로 기존 성공 결과가 사라지지 않아야 한다.
모델링 1 변경 시 이전 입력을 사용한 모델링 2를 stale로 표시한다. 모델링 3은 원본에 독립적으로
의존한다. 그래프 게시 후 BFF 상태 반영 전에 중단되면 게시 기록으로 복구한다.
모델링 1·2 및 공유 그래프는 보존한다. 모델링 3의 기존 생성 데이터는 SEC-MODELING-103-V2 초기화 대상이다. 과거 실행 이력을 만들어 넣지 않는다.

## SEC-MODELING-105: API와 Admin

BFF `/api/sec/modeling`은 공시 목록, 단계별 run 생성, run 상세·이벤트 조회, 취소·재시도,
단계별 결과 조회를 제공한다. 생성은 202, 잘못된 요청은 400, 입력 미준비·중복 실행은 409다.
내부 FastAPI 실행은 서비스 키와 execution token을 사용한다. 키는 브라우저에 전달하지 않는다.
Admin은 약 2초 polling과 해제 시 AbortController를 사용하고 상태·오류·진행 수·재시도·취소를 표시한다.
Item HTML/text, lexical 근거, 정형 사실과 검색 시험을 제공한다. 별도의 전체 인증 시스템은 이번 범위 밖이다.

| FastAPI 공개 인터페이스 | 책임 |
| --- | --- |
| POST /api/sec-analysis/search | query, filingIds, itemCodes, topK를 받아 근거 반환 |
| POST /api/sec-analysis/facts/query | 공시·Concept·기간·차원·단위·analysisCategory로 선별 사실 조회 |
| GET /api/sec-analysis/evidence/{evidenceId} | 검색 근거와 해당 Item 조회 |

검색은 회사·공시 필터를 강제하고 활성 결과만 조회한다. Chunk·Statement 검색 순위를 결합하고
근거를 중복 제거한다. 필터 후 ANN 후보가 부족하면 최초 3개 보고서 범위에서 exact cosine을
보완한다. topK 기본 10, 최대 50. 검색 API는 답변 문장을 생성하지 않으며 LangGraph Agent가
반환된 근거·사실을 사용해 설명한다.

정형 사실의 `conceptQName`과 차원 QName은 접두사 문자열 대신 `{namespaceUri}localName`을
사용한다. `unit` 필터에는 반환된 unit 객체(numerator/denominator measure 배열)를 JSON
문자열로 전달한다. JSON 키·공백·measure 순서는 비교 결과에 영향을 주지 않으며, 분자·분모와
measure 중복은 보존해 USD와 USD/share를 구분한다. 잘못된 단위 JSON은 일치 결과가 없다.
`USD`라는 단축 문자열을 자동 해석하지 않는다.

## 인수 기준

| ID | Given / When / Then |
| --- | --- |
| SEC-VAL-101 | 실제 3개 보고서 / 모델링 1 실행 / 각 23 Item, 표·단위·수치 보존 및 위험 HTML 제거 |
| SEC-VAL-102 | 게시된 Item / 모델링 2 실행 / 6종 노드·근거 연결·Chunk·Statement 두 임베딩 종류 검증 |
| SEC-VAL-103 | 실제 XBRL / 모델링 3 실행 / decimal 값·기간·단위·차원·출현 근거 검증 |
| SEC-VAL-104 | 실행 중인 작업 / 중복·취소·실패·재시도·재시작 / 중복 방지와 이전 성공 결과 유지 |
| SEC-VAL-105 | KO 15개·EN 15개 gold 질문 / topK10 검색 / Recall@10 ≥90%, 다른 공시 혼입 0, 근거 연결 100% |
| SEC-VAL-106 | 실제 Admin / 실행·진행·결과·검색 조작 / MCP 브라우저에서 사용자 동작 검증 |

Bruno API E2E, Storybook, lint/typecheck/단위 테스트를 해당 변경 범위에 수행한다.
실제 모델 호출·실제 보고서 검증과 fixture 기반 장애 검증을 구분한다. 검증 자원 정리까지
확인해야 완료이며 미실행 검증을 PASS로 기록하지 않는다.

## 현재 구현 및 검증 범위

모델링 1/2/3, BFF 영속 실행 관리, Admin, Neo4j 벡터·정형 사실·근거 API와 LangGraph 도구를 구현했다.
2026-11-14 사용자 지시로 추가 검증을 중단했다. 모델링 1/3은 세 공시에서 실행했고,
모델링 2의 최종 BFF 실행은 AAPL·CPNG에서 성공했다. NVDA 모델링 2 처리와
세 공시 전체 검색 30문항 검증은 완료하지 않았다. 검색 API의 일반 정확도 또는 모든 SEC 양식 지원을 보장하지 않는다.
이미 게시된 성공 결과와 재시도용 캐시는 보존한다. 검증 재개는 별도 요청 시 진행한다.

## 2026-11-15 모델링 3 재설계 작업

모델링 3의 현재 계약은 SEC-MODELING-103-V2를 따른다. 이전 전체 XBRL 저장·7종 노드 설명은 폐기한다.
사용자 요청에 따라 구현 우선, AAPL·CPNG·NVDA 세 샘플에 한정한 검증을 진행하고 브라우저 검증은 하지 않는다.
10-Q 지원 코드와 실제 10-K 샘플 실행 결과를 구분하며, 전 시장 규모 성능 검증은 수행하지 않는다.
[재설계·초기화 기록](../../flow/2026-11-15-sec-model3-selected-facts.md).

### 모델링 3 운영 명령

- `pnpm -C 3-langgraph-fast model3:sample`: 세 로컬 샘플의 입력 manifest만 확인.
- `pnpm -C 3-langgraph-fast model3:sample --execute`: AAPL·CPNG·NVDA 10-K를 실제 파싱·선별·게시.
- `pnpm -C 3-langgraph-fast test:model3:samples`: 세 회사 로컬 fixture 기반 계약 점검. fixture가 없으면 명시적으로 SKIP.
- `pnpm -C 3-langgraph-fast model3:reset`: 삭제 대상 dry run. `--apply`는 모델링 3 데이터 삭제.
- `pnpm -C 3-langgraph-fast test:model3:api --env-var baseUrl=http://127.0.0.1:<port>`:
  게시된 세 샘플을 읽기 전용으로 검증한다. 실행 프로세스에 `SEC_MODELING_KEY`가 설정되어야 한다.
- 실제10-Q 샘플 실행 시 `model3:sample --form 10-Q --metadata <JSON경로> --execute` 사용.
  metadata는 ticker별 정확한 accessionNo/sourceUrl/filingDate를 지정하며 추측한 accession은 사용하지 않는다.

### 현재 샘플 결과 (Decisions 정책 v3)

세 실제10-K를 직접 Decisions API로 처리했다. AAPL8Fact/6Concept, CPNG16Fact/11Concept,
NVDA5Fact/5Concept이다. 초기화 및 중간 정책 결과 정리 후 모델링3 도메인은 총29Fact+22Concept이다.
기간·단위·차원·원문 값 보존과 동일 물리 Fact/조회 노드, 알려진 분류 경계 사례를 확인했다.
현재 임계값의 전체 의미 정확도, 모든10-Q 실처리, 전체 상장기업 규모 성능을 검증했다는 뜻은 아니다.
세 샘플의 실제 실행·API 검증과 자원 정리 증거는 위 flow 링크에서 확인한다.
