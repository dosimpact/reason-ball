# SEC-MODELING-001: 실제 통합 검증 중간 기록

날짜: 2026-11-14. 전체 상태: 진행 중. 모델링 2와 검색 인수 검증은 아직 완료하지 않았다.

## 확인된 결과

- BFF PostgreSQL → FastAPI → Neo4j 모델링 1: AAPL·CPNG·NVDA 각 23 Item 성공.
- 모델링 3: AAPL 1,242 facts, CPNG 1,329 facts, NVDA 1,305 facts 성공.
- 7종 XBRL 노드, Filing HAS_XBRL_FACT, Context FOR_ENTITY 관계와 canonical duplicateGroup 해시 검증.
- CPNG `f-57`: rawValue `26,312`, normalizedValue `26312000000`, USD, 2025 기간,
  ProductOrServiceAxis/ProductMember 보존. 같은 값의 반복 `f-445`도 독립 출현으로 보존.
- 지표·기간·차원 필터 실제 HTTP 조회에서 `f-57`과 `f-445`가 반환되고 evidence 조회 200.
- 실제 임베딩 호출 1,536차원 응답 확인. AAPL Item 1C의 실제 Toolkit 추출에서
  Source/Chunk/Topic/Statement/Fact/Entity 생성 확인. 이는 전체 보고서 모델링 2 성공을 의미하지 않는다.

## 실행 검증

| 검증 | 중간 결과 |
| --- | --- |
| BFF 기존 회귀 테스트 | 18 PASS |
| BFF 격리 PostgreSQL·HTTP | 중복 실행, 취소·재시도, lease, 복구, 입력 미준비, 날짜·페이지 회귀 PASS |
| BFF 및 Python Bruno | 각각 3 requests / 3 tests / 3 assertions PASS |
| Host Storybook | 9 PASS; CIK filter·결과·실행 제어·XBRL 표시 포함 |
| 구조 청커 | 5 PASS; 69 실제 Item, 모든 청크 800토큰 이내 |
| SEC 공식 변환 플러그인 | 5 PASS |
| MCP 실제 브라우저 | CIK 필터, 날짜, CPNG Item HTML·수치, 결과 페이지, XBRL 목록, 취소·재시도 PASS |
| 전체 모델링 2·30개 검색 gold | 진행 중 |

실행 명령은 패키지 test 스크립트와 `scripts/verify-sec-modeling-live.cjs`,
`scripts/verify_sec_modeling_graph.py`, `scripts/validate_sec_model2_live.py`다.
검색 gold는 `assets/sec-modeling/retrieval-gold.json`이며 실제 원문에서 모든 근거 문자열을 확인했다.
한국어 15개·영어 15개에 대해 Item 전체 HTML을 검색 적중으로 계산하지 않는다.

## 발견과 수정

1. 청커가 모든 표를 본문 앞에 모으던 문제를 DOM 순서 유지로 수정했다. 표 헤더·단위·짧은 앞 문맥을 반복한다.
2. Admin event polling이 처음 100개 이벤트를 반복하던 문제를 run별 cursor·증분 병합으로 수정했다.
3. 18만 건 실제 공시 목록에서 대상 회사 탐색이 어려워 CIK 필터를 추가했다.
4. PostgreSQL date가 UTC 시각으로 직렬화되어 하루 전 날짜처럼 보이던 문제를 `YYYY-MM-DD`로 수정했다.
5. Arelle pip 패키지에 없는 SEC 전용 ixt-sec 변환을 공식 EDGAR transform 소스로 연결했다.
6. 추출 proxy가 temperature 인자를 거부하여 OAuth 전용 LLM adapter에서 제거했다.
7. 실제 Toolkit 기본 추출은 6개 청크에서 514 Statements를 생성했다. 전체 본문은 보존하면서
   중복 세부 절 확장을 줄이도록 청크별 중요 진술 최대 20개의 추출 정책을 적용하기로 했다.
   prompt/config 버전을 변경하고 기존 draft를 취소 후 재실행한다. 모델은 sol을 유지하며
   reasoning effort low를 명시한다. 이 그래프는 모든 본문 명제의 완전 열거를 보장하지 않는다.
8. Statement 검색은 같은 공시·generation의 실제 연결 Chunk를 근거로 제공한다.
   ANN 후보 확장·필터 후 부족할 때 scoped exact cosine을 사용한다.

공식 변환 출처: [Arelle SEC transforms 안내](https://arelle.readthedocs.io/en/latest/plugins/popular/transforms_sec.html),
[고정 EDGAR commit](https://github.com/Arelle/EDGAR/tree/4891c4c9889c77af247428ceff4fa7cc52d534ea/transform).
upstream runtime 원문·라이선스·출처 README를 함께 보존한다.

## 브라우저 실행 증거와 정리 상태

- Host: 소유한 `3983`, PID 22009/22018/22033, 별도 `.next-sec-modeling-validation` 출력.
- BFF: 소유한 `3980`, PID 22577. 이전 PID 21952 종료 확인.
- Python: 소유한 `32981`, 담당 에이전트가 변경한 PID 목록과 최종 종료를 확인해야 한다.
- Playwright: 소유 context `sec-modeling-validation`, Chrome PID 22086. MCP 서버 자체는 공유 자원으로 보존한다.
- screenshot: `.tmp/sec-modeling/cpng-item8.png`, 상세 중간 기록 `.tmp/sec-modeling/browser-progress.json`.
- NVDA 실제 UI 취소 run `a824d47e-9092-42c6-857e-70b78a040778`, 재시도 성공 run
  `800506ba-337b-4984-ada4-bf1afbda8f27`. 이전 게시 결과는 계속 표시되었다.
- 임시 BFF 테스트 DB 컨테이너는 정리했다. 통합 검증 서버·브라우저는 아직 사용 중이므로
  **정리 미완료**다. 검증 후 소유 PID·포트·임시 build include를 정리하고 후속 flow에 기록한다.

## 영향받는 stock

- [SEC 모델링 계약](../stock/us-corporate-filings/sec-modeling.md)
- [공시 시스템](../stock/us-corporate-filings/system-design.md)
- [공통 시스템](../stock/tech-shared/system-design.md)
- [Graph DB](../stock/tech-shared/3-langgraph-fast/4-graph-db.md)
- [BFF 소유 경계](../stock/tech-shared/2-bff-apps/directory-policy.md)
- [Host 구조](../stock/tech-shared/1-fe-host/2-frontend-side-architecture.md)

후속 검증 결과·정리·완료 여부는 새 flow에 기록한다. 이 기록은 완료 선언이나 최종 PASS가 아니다.
