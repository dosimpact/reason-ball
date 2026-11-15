# SEC Collector 기업 확장 및 집계 작업 (검증 미완료)

- 목적: 기업 주소록 동기화, 전체 DB 통계 및 기업별 공시 확장 UI. 현재 티커가 있는 기업만 목록에 표시한다.
- 구현: BFF GET /overview는 전체 기업/티커 보유 기업/전체 공시/실제 원문 보유 수 및 form_type별 집계를 반환한다. GET /filings의 최상위 각 행에 hasContent를 추가했다. 저장 원문이 있는 경우 status와 무관하게 조회하며 단일 다운로드에서 기존 원문을 보존한다. Host는 상단 동기화 및 기업별 확장 조회를 제공한다.
- Stock: [Collector](../stock/us-corporate-filings/collector-dashboard.md), [시스템](../stock/us-corporate-filings/system-design.md), [API](../../2-bff-apps/src/us-corporate-filings/.docs/api-spec.md).
- 검증: 격리 PostgreSQL 및 실제 Nest HTTP에서 기존 기업 Bruno 28/28, 공시 Bruno 52/52 PASS. 공시 fixture에서 전체 기업·티커 기업·양식별 집계와 원문 존재 검사 PASS. 소규모 fixture의 EXPLAIN은 Seq Scan + HashAggregate이며 대규모 성능 판단 근거가 아니다. Host typecheck 및 변경 파일 ESLint PASS, BFF lint PASS. Host 전체 lint는 기존 dart-collector/api/dartTesting.ts:23의 no-constant-condition 오류로 실패.
- 미완료: 새 요구사항의 단일 다운로드 불일치·동시성 및 SSE 오류 회귀, UI Storybook과 MCP 브라우저 시나리오, 실제 규모 실행 계획은 아직 검증하지 않았다. 따라서 전체 요구사항과 커밋은 완료하지 않았다.
- 자원: 테스트 스크립트가 생성한 격리 PostgreSQL 컨테이너 및 Nest 서버를 종료했다. 사용자 서버는 건드리지 않았다.
