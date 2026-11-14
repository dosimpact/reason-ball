# SEC-MODEL1-001: 세 보고서 문서 구조 PoC 계획

- 날짜: 2026-11-14
- 범위: US corporate filings / `3-langgraph-fast`
- 상태: 구현·검증 진행 전 합의 기록. 완료 증거는 별도 validation flow로 남긴다.

## 배경과 결정

사용자는 Apple `aapl-20260926.htm`, Coupang `cpng-20251231.htm`, NVIDIA
`nvda-20260125.htm` 세 로컬 보고서만 대상으로 모델링 1을 실행하도록 요청했다.
`docs/human-docs/1-sec-분석/`의 파일은 입력으로만 읽고 변경하지 않는다.

- SEC-MODEL1-001: `Company → FILED → Filing → HAS_ITEM → Item`만 생성한다.
- SEC-MODEL1-002: Item에 정제 `displayHtml`과 읽을 수 있는 `text`를 저장한다.
  제목·문단·목록·표 구조와 표시 숫자를 보존하고 XBRL 메타데이터·스크립트는 제거한다.
  원본 HTML 전체를 Neo4j에 저장하지 않는다.
- SEC-MODEL1-003: CIK·접수번호·Item 코드 기반 안정 ID로 재실행을 허용한다.
  원본 해시와 파서 버전은 추적 정보이며 렌더링 시 PostgreSQL 조회를 요구하지 않는다.
  사용자 설명의 “원문 위치에 연결하지 않는다”를 우선해 `sourceLocator`는 필수로 두지 않는다.
- SEC-MODEL1-004: 모델링 2/3, 임베딩, 새 API·앱 화면, PostgreSQL 자동 수집 연동은 제외한다.
  CLI가 세 로컬 파일을 가공하고 선택적으로 Neo4j에 적재한다.

## 검증 계획

| Given / When | Then |
| --- | --- |
| 세 원문을 CLI로 파싱 | 각 23개 실제 Item을 찾고 목차·본문 중복을 배제 |
| XBRL이 감싼 표시 숫자와 표를 정제 | 숫자·표 구조 유지, XML·실행 가능 요소 제거 |
| 실제 Neo4j에 적재 후 재실행 | 3 Company, 3 Filing, 69 Item; 중복 노드·관계 없음 |
| 정제 HTML preview를 MCP 브라우저에서 탐색 | 세 회사의 Item 이동, 표·숫자 표시, 새로고침 정상 |
| 검증 종료 | 작업이 생성한 서버·브라우저 자원 정리, 기존 서비스 유지 |

CLI/파서 비즈니스 로직의 정적 HTML 결과는 VAL-BROWSER-001에 따라 실제 브라우저로 확인한다.
API 계약과 앱 View 컴포넌트는 변경하지 않으므로 API E2E/Storybook은 이 범위에 해당하지 않는다.
실제 사용자 산출물인 세 공시 그래프와 검증 증거는 보존하며 임시 서버만 종료한다.

## 동기화할 stock

- [Graph DB](../stock/tech-shared/3-langgraph-fast/4-graph-db.md)
- [공시 시스템 설계](../stock/us-corporate-filings/system-design.md)

구현이 완료되면 기존 mock extraction pipeline과 새 모델링 1 CLI의 책임을 구분해 반영한다.
