# Graph DB 설계 및 운영

## 문서 목적

이 문서는 `3-langgraph-fast`가 Neo4j에 저장하는 10-K 지식 그래프의 현재 구현을 설명한다.
Neo4j 컨테이너·볼륨·exporter provisioning은
[infra setup](../infra/1-infra-graph-rag/1-infra-l1-setup.md)이 소유하고, 공시 수집과 원문 저장
규칙은 [US Corporate Filings](../../us-corporate-filings/INDEX.md)이 소유한다.

## 결론과 책임 경계

`3-langgraph-fast`는 다음을 소유한다.

- 공시 원문의 section 분할과 구조화 정보 추출
- 추출 결과를 Neo4j node/relationship payload로 변환
- graph constraint 초기화와 환경별 검증
- node 및 relationship의 멱등 upsert
- 회사·공시 선택, risk/metric/section 근거 검색
- `/api/tenk/*`와 `/graph/tenk/*` API 및 관련 CLI

`2-bff-apps`는 SEC 공시를 수집하고 PostgreSQL `public`에 원문과 수집 상태를 저장하지만
Neo4j schema나 graph write를 수행하지 않는다. PostgreSQL의 LangGraph metadata/checkpoint와
Neo4j의 공시 지식 그래프도 서로 다른 저장 영역이다.

```text
SEC 원문/metadata
  -> ParserPipeline
       -> FilingSegmenter
       -> LLMExtractor
       -> GraphMapper
       -> Neo4jWriter
  -> Neo4j
       -> RetrievalService
       -> 10-K graph/API response
```

## 연결 설정

| 환경 변수 | 기본값 | 의미 |
| --- | --- | --- |
| `NEO4J_URI` | `bolt://127.0.0.1:7687` | Bolt endpoint |
| `NEO4J_USER` | `neo4j` | 접속 사용자 |
| `NEO4J_PASSWORD` | 로컬 placeholder | 비밀번호. 실제 값은 `.env`에만 둔다. |
| `NEO4J_DATABASE` | `neo4j` | 논리 database 이름 |

`AppSettings`가 설정을 읽고 `Neo4jWriter`와 `RetrievalService`가 각각 Neo4j driver를 생성한다.
호출자는 pipeline/service 종료 시 `close()`로 driver를 닫는다. 비밀번호와 원문 전체를 로그에
남기지 않는다.

로컬 인프라는 Neo4j 5.26 Community, HTTP 7474, Bolt 7687을 기본으로 하며 APOC와
APOC Extended plugin을 활성화한다. 애플리케이션의 현재 graph write/read 경로는 표준 Cypher를
사용하며 APOC에 직접 의존하지 않는다.

## 환경별 schema 준비

FastAPI lifespan은 `ENV_PROFILE`이 설정되면 PostgreSQL 준비와 별개로 Neo4j schema를 준비한다.

| Profile | 시작 동작 |
| --- | --- |
| `local` | 9개 uniqueness constraint를 `IF NOT EXISTS`로 멱등 생성 |
| `dev`, `staging`, `production` | `SHOW CONSTRAINTS`로 이름을 검증하며 DDL은 실행하지 않음 |

비로컬 환경에서 constraint가 하나라도 없으면 startup은
`Neo4j schema is missing or outdated; migrations are local-only`로 실패한다. 명시적 초기화는 다음
두 경로를 사용할 수 있다.

```sh
uv run python scripts/tenk_init_neo4j.py --database neo4j --pretty
```

```http
POST /api/tenk/init-neo4j
Content-Type: application/json

{"database":"neo4j"}
```

## Constraint 계약

모든 graph node는 안정적인 `id`를 identity key로 사용한다.

| Constraint | Label | Property |
| --- | --- | --- |
| `company_id_unique` | `Company` | `id` |
| `filing_id_unique` | `Filing` | `id` |
| `item_id_unique` | `Item` | `id` |
| `section_text_id_unique` | `SectionText` | `id` |
| `statement_id_unique` | `Statement` | `id` |
| `fact_id_unique` | `Fact` | `id` |
| `entity_id_unique` | `Entity` | `id` |
| `metric_id_unique` | `Metric` | `id` |
| `risk_id_unique` | `Risk` | `id` |

별도 migration version node/table은 없다. 현재 schema readiness 기준은 위 9개 constraint 이름이다.

## Graph model

```text
(Company)-[:FILED]->(Filing)
                       +--[:HAS_ITEM]->(Item)
                                          +--[:HAS_SECTION]->(SectionText)
                                          |                         +--[:HAS_STATEMENT]->(Statement)
                                          |                                                    +--[:SUPPORTED_BY]->(Fact)
                                          |                                                    +--[:MENTIONS]->(Entity)
                                          +--[:HAS_METRIC]->(Metric)
                                          +--[:HAS_RISK]->(Risk)
```

### Node 역할과 주요 property

| Label | 역할 | 주요 property |
| --- | --- | --- |
| `Company` | 공시 제출 기업 | `id`, `name`, `ticker`, `cik` |
| `Filing` | 한 공시 문서 | `id`, `document_id`, `accession_no`, `form_type`, `filing_date`, `source_url`, 기업 식별값 |
| `Item` | Filing 안의 SEC item | `id`, `item_code`, `part_code`, `filing_id` |
| `SectionText` | Item의 원문 section | `id`, `section_id`, `title`, `text`, `item_code`, `part_code`, `filing_id` |
| `Statement` | section에서 추출한 문장 | `id`, `text`, `confidence`, `item_id`, `filing_id` |
| `Fact` | subject-predicate-object 구조 사실 | `id`, `subject`, `predicate`, `object_or_complement`, `fact_type`, `confidence` |
| `Entity` | 문장에서 언급한 개체 | `id`, `value`, `classification` |
| `Metric` | 재무·업무 지표 | `id`, `metric_name`, `value`, `unit`, `currency`, `period`, `scale`, `confidence` |
| `Risk` | 위험 정보 | `id`, `risk_type`, `risk_text`, `likelihood`, `impact`, `change_vs_prior`, `confidence` |

### Identity 생성 규칙

- Company: `cik` 우선, 다음 `ticker`, 마지막으로 정규화한 회사명.
- Filing: `accession_no` 우선, 다음 `source_url`, 마지막으로 `document_id`.
- Item/Section: 상위 Filing/Item identity와 item·section code 조합.
- Statement/Fact/Metric/Risk: 정규화한 의미 필드를 SHA-1 안정 hash로 변환.
- Entity: 공백과 대소문자를 정규화한 entity value.

같은 identity로 다시 파싱하면 새 node를 계속 추가하지 않고 기존 node property를 갱신한다.

## 쓰기 계약

`GraphMapper`는 node와 relationship을 identity 기준으로 먼저 deduplicate한다. `Neo4jWriter`는
label, key field, relationship type별로 payload를 묶고 최대 250행씩 `UNWIND` batch를 실행한다.

- Node: `MERGE` 후 `SET n += row.props`.
- Relationship: 시작·종료 node를 `MATCH`, 관계를 `MERGE`, 이후 property 갱신.
- label과 relationship type은 안전한 identifier pattern을 통과해야 한다.
- 임의 문자열을 Cypher identifier로 직접 삽입하지 않는다.
- 관계 대상 node가 없으면 해당 관계는 생성되지 않는다.
- 여러 batch를 하나의 전체 filing transaction으로 감싸지 않으므로 중간 실패 시 앞선 batch는 남을
  수 있다. 재실행 가능한 identity/upsert 구조로 복구한다.

`dry_run=true`인 parsing 요청은 segment/extract/map까지만 수행하고 Neo4j write를 생략한다.

## 검색 계약

`RetrievalService`는 질문을 `risk`, `metric`, `compare`, `brief`, `summary` intent로 분류한다.

1. `filing_id` 또는 `accession_no`가 있으면 해당 Filing을 우선 선택한다.
2. 그렇지 않으면 `cik`, `ticker`, 회사명 부분 일치로 최신 Filing을 선택한다.
3. risk intent는 `Risk`, metric intent는 `Metric`을 우선 조회한다.
4. 전용 node가 없으면 관련 SEC item의 `SectionText`로 fallback한다.
5. 나머지 intent는 query term이 포함된 section을 찾고, 결과가 없으면 section fallback을 사용한다.
6. 반환 근거는 item label, node type, filing/company 정보, 간단한 순위 score와 reason을 포함한다.

검색은 현재 Cypher substring/item-code 기반이다. vector index, embedding, full-text index, semantic
reranker는 구현되어 있지 않다. answer는 근거 snippet을 조합하며 생성형 최종 합성 단계는 아니다.

## API와 CLI

| 진입점 | 동작 |
| --- | --- |
| `POST /api/tenk/init-neo4j` | constraint 명시적 초기화 |
| `POST /api/tenk/parse-file` | 한 파일 parse 및 기본 Neo4j write |
| `POST /api/tenk/parse-manifest` | manifest 레코드 순회 parse/write |
| `POST /api/tenk/query` | filing 선택, intent 검색, evidence/answer 반환 |
| `POST /graph/tenk/run` | 10-K LangGraph 경로 실행 |
| `scripts/tenk_init_neo4j.py` | API 서버 없이 constraint 초기화 |
| `scripts/tenk_graph_write.py` | API 서버 없이 파일 parse/write |
| `scripts/tenk_query.py` | API 서버 없이 evidence 검색 |

파일 경로를 받는 parsing API/CLI는 현재 로컬 파일 접근을 전제로 한다. BFF PostgreSQL 원문을 직접
읽는 통합 adapter는 이 경로에 구현되어 있지 않다.

## 운영과 관측

```sh
cd ../infra/1-infra-graph-rag
docker compose --env-file .env up -d neo4j neo4j-exporter
docker compose --env-file .env ps neo4j neo4j-exporter
```

- Neo4j healthcheck는 container 내부 `cypher-shell`의 `RETURN 1`로 확인한다.
- 데이터, 로그, import, plugin은 `VOLUME_PREFIX` 아래 bind mount에 보존한다.
- Neo4j exporter는 Bolt/APOC를 통해 Prometheus metric을 노출한다.
- 컨테이너 로그는 Alloy→Loki, metric은 exporter→Prometheus→Grafana 경로로 관측한다.
- volume 삭제나 graph 전체 초기화는 정상 migration/cleanup 절차가 아니며 명시적 승인 없이 수행하지
  않는다.

애플리케이션 연결 확인 예시:

```cypher
RETURN 1;
SHOW CONSTRAINTS;
MATCH (n) RETURN labels(n), count(*) ORDER BY count(*) DESC;
MATCH ()-[r]->() RETURN type(r), count(*) ORDER BY count(*) DESC;
```

## 검증과 현재 제약

- Constraint profile 정책은 `tests/test_neo4j_constraints.py`에서 단위 검증한다.
- Parser pipeline은 writer test double로 write/no-write 경계를 검증한다.
- Mapper와 retrieval은 순수 변환 및 fake driver/session 중심으로 검증한다.
- 실제 Neo4j 통합 검증은 서비스가 준비된 환경에서 명시적으로 수행해야 한다.
- writer/retrieval은 동기 Neo4j driver를 사용하므로 async endpoint에 직접 편입할 때 event loop blocking
  여부를 별도로 검토해야 한다.
- graph schema version history, rollback runner, TTL/retention, tenant 격리, vector search는 현재 없다.
- `Company` 등 일부 label 이름은 추출 `Entity.classification` 값과 동일할 수 있지만, graph label과
  entity classification property는 별도 개념이다.

## 구현 기준 경로

- 설정: `src/settings.py`
- lifecycle: `src/server/server.py`
- constraint: `src/infrastructure/neo4j/constraints.py`
- writer: `src/infrastructure/neo4j/writer.py`
- pipeline: `src/domains/tenk/pipeline.py`
- graph mapping: `src/domains/tenk/graph_mapper.py`
- retrieval: `src/domains/tenk/retrieval.py`
- API: `src/server/routers/tenk.py`
