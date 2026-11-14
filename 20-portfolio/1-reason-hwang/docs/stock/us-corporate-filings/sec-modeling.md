# SEC 모델링과 검색

상태: 기능 구현 완료. 사용자 요청으로 추가 검증은 제외하고, 남은 실제 데이터 검증은 보류한다.
전체 인수 기준 통과를 의미하지 않는다. [구현 완료·검증 보류 기록](../../flow/2026-11-14-sec-modeling-implementation-complete.md).
결정 ID: SEC-MODELING-001. [구현 시작 기록](../../flow/2026-11-14-sec-modeling-implementation-start.md).
[실제 통합 검증 중간 기록](../../flow/2026-11-14-sec-modeling-integration-progress.md)은
모델링 1/3과 Admin에서 확인한 결과 및 남은 검증을 구분한다.

## 목적과 범위

AAPL·CPNG·NVDA 3개 10-K를 문서 구조, 본문 지식, XBRL 재무 사실로 처리한다.
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

## SEC-MODELING-103: XBRL 사실

Arelle로 원본 Inline XBRL과 참조 taxonomy를 해석한다. 모델링 2의 LLM 출력은 입력이 아니다.
필수 taxonomy를 해석하지 못한 결과를 성공으로 게시하지 않는다.

```text
Filing -HAS_XBRL_FACT-> XbrlFact
  XbrlFact -OF_CONCEPT-> Concept
  XbrlFact -IN_CONTEXT-> Context -FOR_ENTITY-> Company
  XbrlFact -IN_UNIT-> Unit
  Context -HAS_DIMENSION_VALUE-> DimensionValue
  DimensionValue -OF_DIMENSION-> Dimension
  DimensionValue -HAS_MEMBER-> Member
```

| 노드 | 핵심 의미·속성 |
| --- | --- |
| XbrlFact | 보고된 값·출현 근거, rawValue, normalizedValue, valueType, decimals, scale, isNil, parserVersion |
| Concept | namespaceUri + localName, label, dataType, periodType, balance |
| Context | 기업 식별자·기간·차원 조합, sourceContextIds, startDate/endDate 또는 instantDate |
| Dimension | namespaceUri + localName, label, explicit/typed 구분 |
| Member | explicit dimension의 namespaceUri + localName, label |
| DimensionValue | dimension별 explicit member 또는 정규화한 typedValue |
| Unit | 분자·분모 measure QName을 보존하는 canonicalExpression |

`c-7`은 특정 문서의 context ID이며 고정된 정보 카테고리가 아니다. `xbrldi`는 차원 XML
네임스페이스 접두사다. 보고서마다 실제 namespace·context 내용을 해석해야 한다.
수치는 float로 변환하지 않고 정밀도를 유지하는 decimal 문자열로 보존한다. format·scale·sign·nil,
기간·복합 단위·explicit/typed dimension을 함께 처리한다. 비수치 사실도 수치 0으로 바꾸지 않는다.
반복 출현과 충돌 값을 구분하고, 정정공시·비교 수치를 개념·기간만으로 덮어쓰지 않는다.
서로 다른 회사의 확장 Concept도 이름만으로 합치지 않는다. 정확한 근거가 있을 때만 Item과 연결한다.
현재 `conflict`는 같은 개념·맥락·차원·단위 그룹에서 정규화한 값이 다르다는 표시다.
decimals에 따른 반올림 허용 구간까지 판정한 회계 오류 확정값은 아니며, 서로 다른 원래 값과
정밀도를 보존해 후속 검토할 수 있게 한다.

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
기존 PoC 그래프는 보존하며 새 namespace와 버전으로 격리한다. 과거 실행 이력을 만들어 넣지 않는다.

## SEC-MODELING-105: API와 Admin

BFF `/api/sec/modeling`은 공시 목록, 단계별 run 생성, run 상세·이벤트 조회, 취소·재시도,
단계별 결과 조회를 제공한다. 생성은 202, 잘못된 요청은 400, 입력 미준비·중복 실행은 409다.
내부 FastAPI 실행은 서비스 키와 execution token을 사용한다. 키는 브라우저에 전달하지 않는다.
Admin은 약 2초 polling과 해제 시 AbortController를 사용하고 상태·오류·진행 수·재시도·취소를 표시한다.
Item HTML/text, lexical 근거, 정형 사실과 검색 시험을 제공한다. 별도의 전체 인증 시스템은 이번 범위 밖이다.

| FastAPI 공개 인터페이스 | 책임 |
| --- | --- |
| POST /api/sec-analysis/search | query, filingIds, itemCodes, topK를 받아 근거 반환 |
| POST /api/sec-analysis/facts/query | 공시·Concept·기간·차원·단위로 정형 사실 조회 |
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
