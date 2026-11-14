# SEC 모델링 구현 완료 및 추가 검증 보류

- 날짜: 2026-11-14 (Asia/Seoul)
- 결정: SEC-MODELING-001
- 상태: 기능 구현 완료. 전체 검증 완료를 의미하지 않는다.
- 현재 계약: [SEC 모델링과 검색](../stock/us-corporate-filings/sec-modeling.md)
- 앞선 기록: [구현 시작](2026-11-14-sec-modeling-implementation-start.md), [통합 검증 중간 기록](2026-11-14-sec-modeling-integration-progress.md)

## 변경과 이유

사용자는 계획 구현을 요청한 뒤 “검증은 제외하고 구현만 우선 다해둬”라고 범위를 변경했다.
이에 추가 실제 처리·검색 평가·테스트를 중단하고 구현 변경을 정리했다.
인수 기준을 삭제하거나 미실행 검증을 통과로 바꾸지 않는다. 추가 검증은 별도 요청 시 재개한다.

구현 범위:

- PostgreSQL 원본에서 모델링 1의 Company/Filing/Item과 정제 HTML·텍스트 생성.
- 고정 버전 GraphRAG Toolkit으로 Source/Chunk/Topic/Statement/Fact/Entity 추출 및 Neo4j 벡터 저장.
- Arelle와 SEC transformation으로 모델링 3의 Concept/Context/Dimension/Member/DimensionValue/Unit/XbrlFact 처리.
- BFF 영속 jobs/runs/work_units/events, 단일 실행기, lease·heartbeat·취소·재시도·실행 복구.
- generation별 staging 후 게시, 이전 성공 결과 유지, 현재 결과와 과거 게시 근거의 구분.
- Admin `/sec-modeling`의 공시 필터·실행·상태·결과·검색 및 Statement → Chunk → Item HTML 근거 열기.
- 검색·XBRL 사실·근거 API와 LangGraph 도구 연결, 기존 mock pipeline 및 라우터 제거.
- 추출 OAuth proxy와 OpenAI 임베딩 자격 증명 분리. Qdrant/pgvector/Redis 추가 없음.

청커는 문서 순서·표 헤더·단위를 보존하고 inline 공백과 줄바꿈을 유지한다.
추출은 청크당 중요 진술 최대 20개를 요청하며 전체 청크 텍스트를 별도 보존한다.
모든 명제의 완전 추출 또는 모든 SEC 레이아웃 지원을 보장하지 않는다.

## 중단 이전에 확인한 결과

다음은 이미 수행한 결과이며, 범위 변경 후 새 검증을 수행했다는 뜻이 아니다.

| 범위 | 확인 결과 |
| --- | --- |
| 모델링 1 | AAPL·CPNG·NVDA 각 23 Item |
| 모델링 3 | AAPL 1,242 / CPNG 1,329 / NVDA 1,305 XBRL 사실 |
| AAPL 모델링 2 최종 BFF 실행 | Source 23, Chunk 163, Topic 188, Statement 2,003, Fact 6,074, Entity 1,233; 작업 단위 186/186 성공 |
| CPNG 모델링 2 최종 BFF 실행 | Source 23, Chunk 516, Topic 515, Statement 4,227, Fact 11,736, Entity 2,331; 작업 단위 539/539 성공 |
| NVDA 모델링 2 | Item 7 처리 중 사용자 요청으로 취소. 최종 게시 및 BFF 재실행 미완료 |
| AAPL 검색 부분 평가 | 10문항 중 9문항 적중, 반환 근거 100건 조회 성공, 다른 공시 혼입 0 |
| 전체 검색 평가 | 30문항 최종 평가 미실행. 서비스 종료 중 중단된 CPNG 부분 평가는 품질 결과로 사용하지 않음 |
| 최신 SEC Python 전용 테스트 | 54 PASS, 외부 toolkit 이벤트 루프 deprecation warning 1 |
| Host | 단위 5 PASS, Storybook 10 PASS |
| API | FastAPI Bruno 5 요청·5 테스트·5 assertion PASS; BFF lifecycle/lease/취소/재시도/복구 및 단위 작업 제한 E2E PASS |
| 실제 MCP 브라우저 | 공시 선택·실행 취소·재시도·Item 미리보기·XBRL 표시·검색·Statement 근거와 Chunk·sandbox Item HTML 확인 |

AAPL 최종 run은 `0d64e96c-a973-463a-bf89-b6805ef34add`, generation은
`7521dbbb927dcf363b511ee2746e07f87830fc79586910ec1e01920a72c702c5`다.
AAPL 163개 청크 중 151개는 두 추출 단계의 기존 캐시를 재사용했고, 변경된 12개는 24개 응답을 새로 생성했다.
CPNG는 516개 중 497개 재사용, 변경된 19개에서 38개 새 응답을 확인했다.
캐시 재사용은 실제 prompt hash와 생성 시각으로 확인했으며, 동시 실행 중 전체 캐시 증가량을 한 공시의 호출 수로 간주하지 않았다.

전체 Python 패키지 정적 검사에는 기존 오류가 남는다. 동일 도구의 HEAD 비교에서 Ruff는
73→67, Pyright는 64→64였고 변경 범위 검사는 통과했다. 전체 패키지 정적 검사 PASS로 기록하지 않는다.
브라우저에는 기존 favicon 404만 있었고 모델링 기능의 콘솔 오류는 없었다.

실행 증거는 로컬 `.tmp/sec-modeling/` 및 `3-langgraph-fast/.tmp/sec-modeling-live/`에 보존한다.
`browser-final.json`, `search-evidence-final.png`, `final-scoped-tests.json`,
`aapl-retrieval-final-subset.json`, `replay-aapl.json`, `replay-cpng.json`을 포함하며 런타임 산출물은 커밋하지 않는다.

## 자원 및 자격 증명 처리

NVDA run `live-model2-0001045810-v3`를 DB에서 CANCELLED로 먼저 저장해 늦은 게시를 차단했다.
직접 실행 PID 38382/38393과 FastAPI PID 73380을 종료했고 해당 PID 부재 및 32981 포트 해제를 확인했다.
Host PID 68999/69016/69037/69143과 브라우저 PID 69115는 종료 및 3983 포트 해제를 확인했다.
전용 `.next-sec-modeling-validation` 출력과 이 작업이 추가한 tsconfig include를 제거했다.
공유 MCP·사용자 서버·원본·기존 성공 그래프·재시도 캐시는 유지한다.

작업 중 하위 에이전트의 도구 오류 출력에 임베딩 키가 노출된 사실을 사용자에게 알렸다.
모델 설정 직렬화에서 자격 증명을 제거하고 추출 키의 OpenAI 키 fallback도 제거했다.
저장된 소스·캐시·로그에는 해당 키가 없음을 확인했으며 노출된 키 교체를 권고했다.
키 값은 문서와 커밋에 포함하지 않는다.

## 영향받는 stock

도메인 SEC 모델링 계약, 도메인 system-design/INDEX, 공통 system-design/test-design,
Host 아키텍처, BFF 디렉터리 정책, Python Graph DB 설계와 README를 현재 구현으로 동기화했다.
`human-docs/` 및 사용자 작업 파일은 변경하지 않았다.

최종 BFF 정리: 활성 run이 없음을 확인한 뒤 소유 BFF PID 66046을 TERM으로 종료했다.
PID 부재, 3980 포트 리스너 부재, 검증 watcher 부재를 확인했다. 실행 이력과 결과는 삭제하지 않았다.
모든 작업 소유 검증 서비스 정리를 완료했다.
