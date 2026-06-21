# Lexical Graph 구조 정리 (graphrag-toolkit)


Ref : google.com/search?q=graphrag-toolkit&oq=graphrag-toolkit&gs_lcrp=EgZjaHJvbWUyBggAEEUYOTIICAEQABgTGB4yCAgCEAAYExgeMggIAxAAGBMYHjIICAQQABgTGB4yCAgFEAAYExgeMgYIBhBFGDzSAQcxMzlqMGo3qAIAsAIA&sourceid=chrome&ie=UTF-8  



## 한 줄 요약
- 질문하신 이해가 맞다: 일반 텍스트를 LLM이 `주제/진술/사실/엔티티`로 추출하고, 툴킷이 이를 **고정된 그래프 모델**에 맞춰 Graph DB에 적재한다.

## 1) 어떤 구조(스키마)로 만들어지나
lexical graph는 3개 티어로 구성된다.

1. `Lineage` 티어
- `Source` 노드: 원문 문서 메타데이터(예: URL, 날짜, 작성자)
- `Chunk` 노드: 청크 텍스트(및 임베딩)
- 관계: chunk 간 `PREVIOUS/NEXT`, 계층 `PARENT/CHILD` 등

2. `Summarisation` 티어
- `Topic` 노드: 문서 내부 주제(문서 스코프)
- `Statement` 노드: 질문응답 컨텍스트의 핵심 단위(독립된 주장/문장)
- `Fact` 노드: triple 형태의 의미 단위(SPO/SPC)
- 관계:
- `Fact`는 하나 이상의 `Statement`를 `SUPPORTS`
- `Statement`는 같은 topic 내에서 순서 관계(`PREVIOUS`)를 가짐

3. `Entity-Relationship` 티어
- `Entity` 노드: 예) Amazon, Company
- `RELATION` 관계: 엔티티 간 관계 값
- `Fact`가 subject/object로 entity와 연결됨

## 2) 생성 파이프라인(Extract -> Build)
### Extract 단계
1. 문서를 chunk로 분할
2. (선택) LLM이 proposition 추출
- 복잡 문장 정리, 대명사 해소 등으로 후속 추출 품질 향상
3. LLM이 `topics/statements/facts/entities/relations` 추출

### Build 단계
- Extract 결과를 `Source/Chunk/Topic/Statement/Fact` 노드 스트림으로 분해
- 그래프 스토어에 upsert/merge
- 벡터 스토어에 임베딩 인덱싱(기본적으로 chunk, statement 중심)

## 3) LLM이 하는 일 vs 툴킷이 하는 일
### LLM 역할
- 비정형 텍스트에서 의미 단위 추출
- 엔티티, 관계, 주제, 진술, 사실의 후보 생성

### 툴킷 역할
- 그래프 스키마 강제(노드/엣지 타입, 파이프라인 순서)
- 추출 결과를 표준 모델로 정규화해 저장
- micro-batching, extract/build 분리 실행, 벡터 인덱싱, 쿼리 전략 제공

## 4) 왜 "그냥 청크 RAG"와 다른가
- 기본 컨텍스트 단위를 chunk보다 작은 `statement` 중심으로 둔다.
- `Topic`은 같은 문서 내 연결성(local connectivity)을 높인다.
- `Fact`는 문서 간 연결성(global connectivity)을 제공한다.
- 그래서 질문과 직접 유사하지 않은데도 답변에 필요한 근거를 그래프 탐색으로 가져오기 쉽다.

## 5) 저장소 관점
- Graph Store + Vector Store를 함께 사용
- Graph Store: openCypher 기반(Neo4j/Neptune/FalkorDB 등)
- Vector Store: chunk/statement 임베딩 인덱스 저장

## 6) 10-K/10-Q/6-K에 적용할 때의 해석
- 문서 원문(보고서) -> chunk -> proposition/statement/fact/entity 추출
- 보고서별 토픽과 statement를 만들고, 공통 fact/entity로 기업 간/기간 간 연결 가능
- 나중에 질의 시 "특정 기업의 리스크 변화", "분기 대비 연간 변화" 같은 탐색형 QA에 유리

## 7) 메타키를 반드시 추가하는 것이 좋은 이유
- 결론: `Source` 문서 메타를 잘 설계해두면, 이후 질의에서 기업/보고서 단위 필터링 정확도가 크게 올라간다.
- lexical-graph는 문서 메타를 기반으로 `chunk/topic/statement` 조회를 제한할 수 있다.
- `fact/entity`는 여러 문서에 걸쳐 공유될 수 있으므로, "어떤 보고서 근거인지"는 lineage 경로로 추적한다.

권장 메타키(SEC 보고서용):
- `cik`
- `ticker`
- `company_name`
- `form_type` (`10-K`, `10-Q`, `6-K`, `20-F` 등)
- `accession_no`
- `filing_date`
- `report_period`
- `fiscal_year`
- `fiscal_quarter`
- `source_url`
- `local_path`
- `doc_version` 또는 `is_amendment`

질의/운영에서 바로 얻는 이점:
- 특정 기업만 조회: 예) `cik=320193`
- 특정 보고서 유형만 조회: 예) `form_type=10-K`
- 특정 기간만 조회: 예) `filing_date >= 2024-01-01`
- 동일 기업의 분기/연간 비교 질의가 쉬워짐
- 원문 추적성 확보: `accession_no`, `source_url`, `local_path`로 감사 가능

주의사항:
- 메타값은 스칼라(string/int/float/date) 위주로 넣는다.
- 배열/중첩 dict 메타는 필터링 제약이 있으므로 피한다.
- 버전 업데이트를 고려해 문서 식별에 안정적인 키 조합(`cik + accession_no`)을 유지한다.

## 참고한 로컬 문서
- `2.benchmark/graphrag-toolkit/docs/lexical-graph/overview.md`
- `2.benchmark/graphrag-toolkit/docs/lexical-graph/graph-model.md`
- `2.benchmark/graphrag-toolkit/docs/lexical-graph/indexing.md`
- `2.benchmark/graphrag-toolkit/docs/lexical-graph/storage-model.md`
