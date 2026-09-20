# BFF 미사용 항목 정리 및 문서 최신화

- 날짜: 2026-09-20. 사용자가 BFF 하위 미사용 파일 정리와 docs 최신화를 요청.
- 조사: 모든 src 파일은 import/bootstrap/TypeORM 경로에서 사용. scripts는 package 명령 또는 명시적 실수집 도구. template/todo remotes는 workspace 및 remote 전달 설정에서 사용하므로 유지.
- 삭제: 동일 URL·404 검사를 중복한 tests/bruno-filing-routes/14-missing-job.bru, 사용하지 않는 filingsDir 설정, 요청 DTO로 대체된 SEC_BACKFILL_RETENTION_YEARS 설정, Bruno 환경의 미사용 변수 10개.
- 수정: 회사 두 번째 페이지 요청 URL이 page=1이던 불일치를 page=2로 정정. 기존 사용자 companyLimit=200000 등 다른 설정은 작업 트리에 보존하고 별도로 커밋하지 않음.
- 문서: [BFF 지도](../stock/tech-shared/2-bff-apps/INDEX.md), [디렉터리 정책](../stock/tech-shared/2-bff-apps/directory-policy.md), [도메인 설계](../stock/us-corporate-filings/system-design.md), Swagger/SEC upstream/공통 기술·검증·도메인 지도 최신화. 패키지 README에 파일 유지 기준과 명령 추가.
- 보존: migration 원문, 기존 데이터, ZIP cache, SSE 로그, 실행 프로세스, remote 앱, 회귀/opt-in 검증 스크립트. 역사 flow는 수정하지 않음.
- 검증: pnpm test 17 PASS, pnpm lint PASS. test:filing-routes:e2e 37 requests/tests/assertions PASS (중복 1개 제거), live SSE/metadata-only/bulk body/작업 테이블 미사용 검사 PASS.
- 공개 Bruno 회사 2페이지 요청: 소유한 실수집 API 127.0.0.1:54257에 pageSize=2로 읽기만 수행, 1 request/test 및 4 assertions PASS.
- 문서 로컬 링크·diff 검사. 비즈니스/API 구현 변경 없이 미사용 설정/테스트/문서 정리이므로 기존 브라우저 증거를 유지.
- 백그라운드 PID 37706 생존 확인. 13:43 UTC경 문서 downloaded=587/failed=0 이후 계속 진행. 전체 수집 완료로 보고하지 않음.
