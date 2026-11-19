# About Neo4j

Neo4j는 노드와 관계를 저장하고 Cypher로 조회하는 그래프 데이터베이스다. 이 프로젝트에서는 SEC 공시의 가공 Item, Lexical Graph, XBRL 사실과 모델링 결과의 게시 상태·검색 근거를 저장한다. 원본 공시 전체와 LangGraph 실행 checkpoint의 저장소와는 역할이 다르다. LangGraph checkpoint는 PostgreSQL saver가 담당한다.

새 모델링 결과는 generation 단위로 저장한 뒤 게시한다. `SecPublication -[:ACTIVE]-> SecGeneration`이 현재 공개된 결과를 가리킨다. `SecRecord`는 결과 조회용 표현, `SecVector`는 검색용 텍스트·임베딩을 담으며 실제 도메인 노드·관계도 별도로 저장한다.

현재 구조의 원본 문서는 [Graph DB 설계](../../stock/tech-shared/3-langgraph-fast/4-graph-db.md)와 [SEC 모델링 계약](../../stock/us-corporate-filings/sec-modeling.md)이다. 아래 설명은 코드 기준이며 실제 운영 DB 접속 검증 결과가 아니다.

## Neo4j 연결하는 코드 부분

### 1. 연결 설정 읽기

[settings.py](../../../3-langgraph-fast/src/settings.py)의 `AppSettings`와 `get_settings()`가 다음 환경변수를 읽는다. 실제 비밀번호와 `.env` 값은 문서에 기록하지 않는다.

| 환경변수 | 용도 |
| --- | --- |
| `NEO4J_URI` | Bolt 연결 주소. 코드 기본값은 `bolt://127.0.0.1:7687` |
| `NEO4J_USER` | 접속 사용자 |
| `NEO4J_PASSWORD` | 접속 비밀번호 |
| `NEO4J_DATABASE` | 사용할 database 이름 |

### 2. SEC 모델링의 공통 연결

[store.py의 GraphStore](../../../3-langgraph-fast/src/domains/sec_modeling/store.py)가 공식 Python driver를 생성한다. driver는 연결 풀을 관리하고, 각 query는 지정 database의 session을 열어 실행한다. driver 생성만으로 서버 연결 성공을 확인한 것은 아니다.

```python
# GraphStore.__init__의 핵심
s = settings or get_settings()
self.driver = GraphDatabase.driver(
    s.neo4j_uri, auth=(s.neo4j_user, s.neo4j_password)
)
self.database = database or s.neo4j_database
```

`GraphStore.close()`는 driver를 닫는다. [runtime.py](../../../3-langgraph-fast/src/domains/sec_modeling/runtime.py)의 모델링 실행 경로에서도 GraphStore를 사용한다. FastAPI 시작 시의 schema 준비 진입점은 [server.py](../../../3-langgraph-fast/src/server/server.py)의 `prepare_neo4j_schema()` 호출이다. 실행 프로필·시작 옵션에 따라 초기화 경로가 달라질 수 있다.

`GraphStore.initialize()`는 로컬 또는 명시적 migration에서 제약·인덱스를 준비하고, 비로컬 일반 실행에서는 필요한 schema와 인덱스 상태를 검사한다. 검색 인덱스 `sec_evidence_embedding`은1536차원·cosine·ONLINE이어야 한다. schema 검사와 실제 데이터 수집·모델링 실행은 별개다.

### 3. 그래프 적재용 연결

[infrastructure/neo4j/writer.py의 Neo4jWriter](../../../3-langgraph-fast/src/infrastructure/neo4j/writer.py)도 driver를 생성한다. 이 클래스는 가공된 graph payload의 노드·관계를 batch `MERGE`로 적재하는 용도다. `write_graph()` 안에서 `session.execute_write()`를 사용하며 context manager 또는 `close()`로 정리한다. 일반 SEC 조회의 공통 진입점은 GraphStore다.

## Neo4j 조회하는 코드 부분

### 1. 공통 Cypher 실행

[GraphStore.query()](../../../3-langgraph-fast/src/domains/sec_modeling/store.py)는 다음 코드로 결과를 Python dictionary 목록으로 반환한다. 이름은 query지만 쓰기 Cypher도 호출할 수 있는 공통 실행 함수다.

```python
def query(self, cypher, **params):
    with self.driver.session(database=self.database) as session:
        return session.run(cypher, **params).data()
```

값은 `$id`, `$g`처럼 parameter로 전달한다. 사용자 입력을 Cypher 문자열에 직접 이어 붙이지 않는다.

### 2. 게시된 generation과 결과 조회

| 메서드 | 역할 |
| --- | --- |
| `run_state(run_id)` | `SecRun`의 실행 상태 조회 |
| `active(filing_id, stage)` | 공시·단계의 현재 게시 generation 조회 |
| `active_many(filings)` | 여러 게시 포인터를 묶어 조회 |
| `publication_summaries()` | 게시 generation 요약 조회 |
| `records(generation, kind=None)` | generation별 결과를 종류로 필터링해 조회 |

`active()`의 핵심 Cypher:

```cypher
MATCH (p:SecPublication {id:$id})-[:ACTIVE]->(g:SecGeneration)
RETURN g
```

`records()`의 실제 Cypher:

```cypher
MATCH (r:SecRecord {generationId:$g})
WHERE $kind IS NULL OR r.type=$kind
RETURN r.data AS data ORDER BY r.id
```

`records()`는 내부 함수이므로 호출자가 올바른 공개 범위를 선택해야 한다. 모든 generation을 그대로 사용자 검색에 노출하는 함수로 사용하지 않는다.

### 3. 검색·XBRL 사실·근거 조회

[search.py](../../../3-langgraph-fast/src/domains/sec_modeling/search.py)가 업무 조회를 담당한다.

| 함수 | 역할 |
| --- | --- |
| `search(request, store)` | 요청 공시의 활성 generation을 기준으로 검색 |
| `scoped_candidates(...)` | 임베딩 검색 후보 조회·공시/generation 범위 제한 |
| `facts(request, store)` | XBRL 사실의 요청 조건 필터링 |
| `evidence(evidence_id, store)` | 근거 ID로 결과 조회, 현재 활성 여부 포함 |
| `supporting_chunks(...)` | 검색된 statement와 관련 chunk 근거 연결 |

벡터 후보 조회의 핵심은 Neo4j 내장 인덱스 호출이다.

```cypher
CALL db.index.vector.queryNodes('sec_evidence_embedding', $candidates, $vector)
YIELD node, score
WITH node AS n, score
WHERE n.generationId IN $gens AND n.filingId IN $filings
RETURN n{.id,.kind,.text,.filingId,.generationId,.metadata,.toolkitId,.chunkId} AS node, score
ORDER BY score DESC
```

`$vector`는 애플리케이션에서 생성한 임베딩이다. 인덱스 후보 조회뿐 아니라 해당 공시·generation으로 범위를 제한한 cosine 계산 경로도 있다. 검색 범위 제한과 현재 게시 여부를 함께 확인한다.

이미 게시된 과거 evidence는 인용 재현을 위해 조회할 수 있고 `isActive`로 현재 여부를 표시한다. 미게시 staging 결과는 사용자 근거로 노출하지 않는다. 따라서 검색의 최신 결과와 과거 인용의 재조회는 서로 다른 목적의 경로다.
