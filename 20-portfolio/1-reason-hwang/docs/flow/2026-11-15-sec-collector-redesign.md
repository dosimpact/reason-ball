# SEC-COLLECTOR-REDESIGN-001: 공시 중심 수집 화면

- 날짜: 2026-11-15
- 요청: 기업 목록을 공시 테이블 필터로 사용하고, 공시 테이블을 주 화면으로 재구성한다. 행별 다운로드 상태·확장 상세·즉시 수집과 기본 화면에서 감춘 디버깅 정보를 제공한다.
- Host: 기업 필터 다음에 `수집된 공시` 전체 폭 테이블을 배치했다. 행은 `다운로드 완료`·`미다운로드`·`다운로드 실패`를 표시한다. 상세는 선택 행 다음에 펼치며 XBRL 뷰어 링크와 저장 원문·SEC 출처 링크를 유지한다. 미완료/실패 행은 accession별 수집 SSE를 호출한다. 기존 일괄 수집 옵션은 접힌 영역으로 유지한다.
- BFF: `POST /api/sec/filings/:cik/:accessionNo/download-jobs`를 추가했다. 저장된 메타데이터 한 건의 원문만 다운로드하고 failed를 재시도하며 completed/error SSE를 반환한다. metadata/DB schema는 변경하지 않는다.
- 디버깅: 세션 기록과 요청/응답 검사를 오른쪽 디버깅 버튼이 여는 Sheet drawer로 이동했다. API Testing 탭과 shared UI는 유지한다.
- 보존: 작업 전 사용자 XBRL 링크 변경은 row detail로 옮겨 유지했다. `human-docs/`, DART·SEC 모델링·iXBRL의 관련 없는 변경을 수정하지 않았다.
- Stock: [Collector 설계](../stock/us-corporate-filings/collector-dashboard.md), [SEC 시스템 설계](../stock/us-corporate-filings/system-design.md), [BFF 디렉터리 정책](../stock/tech-shared/2-bff-apps/directory-policy.md), [Host 구조](../stock/tech-shared/1-fe-host/2-frontend-side-architecture.md), [BFF API 명세](../../2-bff-apps/src/us-corporate-filings/.docs/api-spec.md)를 동기화했다.
- 검증: 저장소 지침과 상위 실행 정책에 따라 테스트·Storybook·브라우저·Bruno 검증은 실행하지 않았다. 결과를 PASS로 간주하지 않는다.
