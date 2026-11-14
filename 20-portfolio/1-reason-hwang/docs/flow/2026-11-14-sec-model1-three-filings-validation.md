# SEC-MODEL1-001: 세 보고서 구현·검증 결과

- 날짜: 2026-11-14
- 범위: `3-langgraph-fast` 모델링 1 CLI, 기존 API·제품 View 변경 없음
- 계획: [합의 및 검증 시나리오](2026-11-14-sec-model1-three-filings-plan.md)
- 요구사항: SEC-MODEL1-001~004, VAL-BROWSER-001, VAL-CLEANUP-001

## 구현 및 결과

서브 에이전트가 parser·샘플 CLI·테스트를 구현하고, 주 에이전트가 실제 Neo4j 적재·재조회와
MCP 브라우저 검증을 수행했다. `beautifulsoup4`를 직접 의존성으로 명시했다.
원본 파일은 읽기만 했으며 세 HTML의 작업 전후 SHA-256이 일치한다.
작업 중 사용자의 분석 노트에 별도 변경이 있었으나 이를 수정하거나 되돌리지 않았다.

| 보고서 | Item | 정제 HTML bytes 합계 | text 문자 합계 | table 요소 |
| --- | ---: | ---: | ---: | ---: |
| AAPL / 2026-09-26 | 23 | 1,030,117 | 223,785 | 54 |
| CPNG / 2025-12-31 | 23 | 1,637,753 | 420,308 | 292 |
| NVDA / 2026-01-25 | 23 | 1,219,977 | 328,496 | 56 |

table 요소 수에는 레이아웃 표도 포함된다. 정제 결과는 원문 전체가 아니며 표지·목차·Item 앞
본문과 SIGNATURES 이후는 제외하고 summary에 제외 길이를 기록한다. 그림은 복제하지 않는다.

Neo4j의 작업 전 노드는 0개였다. 두 번의 실제 CLI 쓰기 후 모두 Company 3, Filing 3,
Item 69 및 FILED 3, HAS_ITEM 69로 동일했다. 75개 노드의 모든 속성을 graph.json과 대조해
동일함을 확인했다. 전체 초기화·삭제 없이 기존 writer의 MERGE를 사용했다.

## 검증

| 검증 | 명령 / 도구 | 결과 |
| --- | --- | --- |
| 경계·정제·DEI mismatch·실제 3개 원문·preview 링크 | `pnpm -C 3-langgraph-fast test:model1` | 10 PASS, 0 SKIP |
| 기존 parser·constraint 회귀 | `pnpm -C 3-langgraph-fast test tests/domains/tenk/test_pipeline.py tests/test_neo4j_constraints.py` | 8 PASS |
| 범위 정적 검사 | 새 parser·CLI·test 대상 Ruff 및 Pyright | PASS, 타입 오류 0 |
| 실제 Neo4j 적재 | `pnpm -C 3-langgraph-fast model1:sample --write-neo4j` 두 번 | 75 nodes / 72 relationships, 재실행 중복 없음 |
| DB 내용 검증 | Neo4j driver read + graph.json 모든 속성 대조 | PASS |
| 브라우저 Item 이동 | Playwright MCP navigate/run_code, 회사 선택 후 69개 Item 링크 클릭 | 69/69 heading 표시 PASS |
| 표·숫자·새로고침 | AAPL Item8, CPNG Item8, NVDA Item15 | 표 각각 40/107/43, 새로고침 유지 PASS |
| Inline XBRL 수치 | CPNG Item8의 `26,312` 검색·표 screenshot | 원문과 같은 표시값 2개, PASS |
| 링크 정리 | 세 전체 preview의 fragment 대상 존재 검사 | 끊어진 fragment 0 |
| 콘솔·네트워크 | MCP console_messages / network_requests | 오류 0, 외부 자원 요청 0 |
| 원본 보존·변경 범위 | 입력 해시·scoped diff check | 세 HTML 무변경, 작업 diff whitespace PASS |

API 계약과 앱 View 컴포넌트를 변경하지 않아 Bruno API E2E·Storybook은 적용 대상이 아니다.
기능 결과물인 정적 preview는 VAL-BROWSER-001에 따라 실제 브라우저에서 검사했다.

### 검증 중 확인한 차이와 수정

- CPNG 목차 Item11이 Item7A와 같은 앵커를 가리킨다. 실제 본문 제목·순서로 분할해
  Item11의 Executive Compensation을 확인했다.
- 초기 브라우저 검증은 모든 회사의 Item8에 표가 있다고 가정해 NVDA에서 실패했다.
  원문과 추출 본문을 대조한 결과 NVDA Item8은 참조 문구이고 재무표는 Item15에 있다.
  소스 배치를 유지한 채 검증 기대값을 수정하고 통과했다.
- 개별 Item preview의 다른 Item 앵커는 `preview.html#target`으로 변환한다.
  제외된 목차 등 실제 대상이 없는 링크는 텍스트만 남긴다. 이 처리는 그래프 payload를
  변경하지 않는 exporter 단계이며 합성 회귀 테스트로 확인했다.
- 테스트 파일 생성 중 잘못된 경로를 먼저 실행한 한 번의 호출은 테스트 0개로 실패했고,
  최종 committed `test:model1` 명령으로 전체 검증했다.
- 전체 git diff check에는 기존 사용자 문서의 trailing whitespace가 있었으므로 해당 문서를
  변경하지 않고 작업 소유 파일만 별도로 검사했다.

## 산출물

`3-langgraph-fast/.tmp/model1-three-filings/`:

- `index.html`, `aapl/preview.html`, `cpng/preview.html`, `nvda/preview.html`
- 기업별 `item-*.html`, `graph.json`, `summary.json`

`3-langgraph-fast/.tmp/model1-validation/`:

- `input-hashes.json`, `neo4j-first-write.json`, `neo4j-second-write.json`
- `cpng-item8.png`, `cpng-revenue.png`

산출물과 DB 데이터는 요청한 결과로 보존하고 Git에는 커밋하지 않는다.

## 자원 정리

- 기존 BFF·FastAPI·Neo4j·사용자 변경 사항·공유 MCP 서버는 유지했다.
- 첫 정적 서버 PID 90719는 초기화 지연으로 종료했고 정상 종료(exit 143)를 확인했다.
- 실제 preview 서버 PID 91080, 포트 3897은 작업 전용으로 생성하고 TERM으로 종료했다.
- Playwright MCP는 시작 시 about:blank 한 탭이었다. `browser_close` 후 열린 탭 없음 및
  작업 Chrome PID 90062와 확인한 helper PID의 종료를 `ps`로 확인했다.
- `ps -p 90719,91080,90062,90068,90074` 출력 없음, 포트 3897 listener 없음.
- 임시 서버·브라우저 잔존 없음. 도구 호스트가 관리하는 공유 MCP 서버·캐시는 삭제하지 않았다.

## 현재 한계와 stock 동기화

이 파서는 세 보고서의 body 직계 Item 제목 레이아웃을 대상으로 한다. 모든 10-K/10-Q,
자동 PostgreSQL 반입, 기존 retrieval/API의 신규 속성 연동, 모델링 2/3까지 구현한 것은 아니다.
Neo4j에는 원본 HTML이나 XML metadata를 저장하지 않는다. 실제 DB 연결과 읽기는 검증했지만
대규모 성능·동시 적재·파서 버전 이관은 이번 범위 밖이다.

- [Graph DB 현재 계약](../stock/tech-shared/3-langgraph-fast/4-graph-db.md)
- [패키지 문서 지도](../stock/tech-shared/3-langgraph-fast/INDEX.md)
- [공시 저장 경계](../stock/us-corporate-filings/system-design.md)

위 stock에 승인된 범위·현재 구현·명령·제약을 반영했다.
