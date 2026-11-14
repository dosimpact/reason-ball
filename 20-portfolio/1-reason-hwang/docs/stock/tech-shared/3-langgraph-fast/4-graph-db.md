# Graph DB 설계 및 운영

## 문서 목적

이 문서는 `3-langgraph-fast`가 Neo4j에 저장하는 10-K 지식 그래프의 현재 구현을 설명한다.
Neo4j 컨테이너·볼륨·exporter provisioning은
[infra setup](../infra/1-infra-graph-rag/1-infra-l1-setup.md)이 소유하고, 공시 수집과 원문 저장
규칙은 [US Corporate Filings](../../us-corporate-filings/INDEX.md)이 소유한다.

## 결론과 책임 경계

### SEC-MODEL1-001: 세 보고서 문서 구조 PoC

`domains.tenk.document_structure`와 `scripts/tenk_model1_sample.py`는 독립 실행 가능한 모델링 1 PoC 경로다. LLM을 호출하지 않는다.
현재 지원·검증 대상은 사용자 제공 AAPL `aapl-20260926.htm`, CPNG `cpng-20251231.htm`,
NVDA `nvda-20260125.htm` 세 10-K 파일이다. 표지·목차·Item 전 본문 및 마지막 SIGNATURES 이후는
Item에 포함하지 않고 제외한 텍스트 길이를 summary에 기록한다. 외부 이미지도 복제하지 않는다.

```text
로컬 HTML + 명시적 공시 metadata
  → 원문 DEI의 CIK / form / 보고기간 일치 검증
  → 실제 body Item 제목·순서 확인 (목차 링크와 분리)
  → Item별 inert HTML 정제 / 표 셀 구분을 유지한 text
  → Company -FILED-> Filing -HAS_ITEM-> Item
  → JSON·HTML preview 내보내기 / opt-in Neo4j MERGE
```

| Label | ID | 속성 |
| --- | --- | --- |
| Company | `company:{CIK}` | `cik`, `name`, `ticker` |
| Filing | `filing:{CIK}:{accessionNo}` | `accessionNo`, `formType`, `filingDate`, `reportDate`, `sourceUrl`, `sourceHash`, `parserVersion`, `model=sec-model1` |
| Item | `{filingId}:item:{partCode}:{itemCode}` | `partCode`, `itemCode`, `title`, `order`, `displayHtml`, `text`, `contentHash`, `parserVersion` |

- `displayHtml`은 제목·목록·표·병합 셀·허용된 표시 스타일을 유지하고 script·외부 자원·숨김
  metadata를 제거한다. Inline XBRL은 태그만 벗기고 표시값을 남긴다. `text`는 인라인 숫자를
  쪼개지 않으며 표 셀을 탭으로 구분한다. 원본 HTML 전체는 Neo4j에 넣지 않는다.
- 공시 수준 URL·원본 해시는 출처 식별용이다. 필수 `sourceLocator`나 PostgreSQL 읽기 연결은
  없으며 가공 결과만으로 표시·후속 청킹할 수 있다. 원본 재파싱은 별도 재반입이 필요하다.
- 샘플 CLI는 세 파일 각각 23개 Item을 검증한 후에만 export/write한다. 경계 중복·역순·없는
  Item 또는 원문 식별자 불일치는 실패한다. 범용 parser의 `expected_codes`는 선택사항이다.
  body 직계 블록에서 제목을 찾는 지원 범위이며 모든 SEC 레이아웃을 지원한다고 간주하지 않는다.
- 기본 명령은 DB에 쓰지 않는다. `--write-neo4j`는 기존 `Neo4jWriter`의 ID 기반 MERGE를 사용한다.
  삭제·원문 보관·기존 노드 전체 초기화는 하지 않는다. writer의 batch transaction 한계는 동일하다.
- 이 CLI는 파일 기반 모델링 1 검증 전용이다. 통합 앱/API와 모델링 2/3은 아래 새 실행 경로를 사용한다.
- 기존 PoC 그래프를 새 실행 이력으로 간주하지 않는다. 앱 검색은 게시된 새 generation을 대상으로 한다.

```sh
# 독립 workspace root 기준
pnpm -C 3-langgraph-fast model1:sample
pnpm -C 3-langgraph-fast test:model1
pnpm -C 3-langgraph-fast model1:sample --write-neo4j
```

기본 산출물은 `3-langgraph-fast/.tmp/model1-three-filings/`의 `graph.json`, `summary.json`,
`index.html`, 회사별 `preview.html` 및 개별 Item HTML이다. 런타임 산출물은 커밋하지 않는다.
API 또는 제품 View 변경이 아닌 CLI와 정적 preview이며 실제 MCP 브라우저·DB 검증을 수행한다.
특히 NVDA는 Item 8이 참조 문구이고 재무표는 Item 15에 있으므로 Item 8 표 존재를 일반화하지 않는다.

[계획 flow](../../../flow/2026-11-14-sec-model1-three-filings-plan.md) ·
[도메인 저장 경계](../../us-corporate-filings/system-design.md#sec-model1-001-분석용-문서-구조의-저장-경계)

## SEC-MODELING-001: 통합 모델링 경로

현재 구현은 `src/domains/sec_modeling/`의 모델링 1/2/3 실행과 검색을 사용한다.
승인된 데이터·실행·검증 계약은 [SEC 모델링](../../us-corporate-filings/sec-modeling.md)에 둔다.
이 문서의 PoC 실행 결과는 통합 경로 전체의 검증 결과를 의미하지 않는다.

- BFF가 PostgreSQL 원문과 실행 요청을 내부 FastAPI에 전달한다. 모델링 2는 Neo4j Item을 입력으로 사용한다.
- 내부 `/internal/sec-modeling/*`은 서비스 키와 execution token으로 제어한다.
- 검색은 `/api/sec-analysis/search`, `/api/sec-analysis/facts/query`, `/api/sec-analysis/evidence/{id}`로 분리한다.
- 공개 BFF proxy를 사용하는 LangChain tools는 SEC Deep Agent에 등록한다. 검색 결과에는 근거와 사실을 반환하며 답변 생성은 Agent 책임이다.
- 기존 mock `ParserPipeline`, extractor, graph mapper와 `/api/tenk/*` 라우터는 제거한다.
- 기존 `RetrievalService` 호출자는 정확한 CIK+접수번호를 지정한 새 검색 계약을 사용한다. Risk·Metric·SectionText 기반 검색과 임의 점수는 사용하지 않는다.
- 공유 SEC client, 원문 문서 구조 파서, 기존 PoC 실행기와 기존 Neo4j 데이터는 보존한다.

## 저장 경계와 버전

Neo4j에는 원본 전체가 아닌 가공 Item HTML·text, lexical graph와 XBRL 사실을 저장한다.
새 결과는 generation별로 staging한 뒤 게시하며 검색·결과 목록은 활성 generation만 사용한다.
게시된 과거 evidence ID는 인용 재현을 위해 조회할 수 있으며 `isActive`로 현재 여부를 표시한다.
게시되지 않은 staging 근거는 조회하지 않는다.
`SecGeneration`, `SecPublication`, `SecRun`은 결과 게시와 복구를 위한 제어 메타데이터다.
`SecRecord`는 가공 결과의 페이지 조회 표현이고 실제 도메인 노드·관계도 별도로 저장한다.
Toolkit lexical tenant는 generation과 연결한다. 이전 PoC 노드를 삭제하거나 과거 run을 생성하지 않는다.

Neo4j 5.26의 내장 벡터 인덱스를 사용한다. 임베딩은 애플리케이션에서 생성하므로 GenAI plugin,
Qdrant, pgvector를 추가하지 않는다. Chunk와 Statement 두 종류를 검색하고 근거를 결합한다.
외부 모델 호출 실패를 빈 추출 성공으로 처리하지 않는다.

## 검증 상태

기능 구현은 완료했다. 사용자 요청으로 추가 검증은 중단했으며 NVDA 모델링 2 및 전체 30문항 검색 평가는 미완료다.
[구현 완료 기록](../../../flow/2026-11-14-sec-modeling-implementation-complete.md)은 기존 검증 결과와 보류 범위를 구분한다.
청커 회귀 테스트는 `uv run pytest tests/test_sec_structural_chunking.py -q`로 실행한다.
검색 gold 질문은 `assets/sec-modeling/retrieval-gold.json`의 한국어 15개·영어 15개이며,
보고서 선택 후 Item 필터 없이 실제 근거 문장의 검색 여부를 평가한다.

## 현재 Neo4j schema 준비

`ENV_PROFILE=local`은 Company/Filing/Item 및 XBRL 7종의 ID 제약10개와
SecGeneration/SecRecord/SecPublication/SecRun/SecVector의 제어 제약5개를 준비한다.
Neo4j native vector index는 ONLINE 상태, 1536차원, cosine 설정을 확인하고
embedding cache key 조회용 index도 확인한다. non-local profile은 DDL 없이 필요한 schema를
검증한다. 기존 Risk/Metric/SectionText 데이터·제약은 삭제하지 않지만 새 부팅 필수 조건으로
요구하지 않는다. 명시적 schema initializer는 앱을 올리기 전 준비하는 운영 경로다.
