# 원격 migration 동기화

- 날짜: 2026-09-21
- 배경: 사용자가 누락된 자동 목표 추적 migration의 원격 적용을 요청했다.
- 사전 확인: 로컬/원격 migration list에서 31개 일치, `20260911000705`만 미적용. dry-run도 해당 파일 1개만 표시했다.
- 실행: `pnpm exec supabase db push --project-ref <기존 프로젝트 ref> --skip-vault --yes`.
- 결과: `20260911000705_automatic_mission_goal_tracking.sql` 적용 성공. 원격 ledger에 해당 version이 존재하고 후속 dry-run은 `upToDate: true`, 빈 migration 목록을 반환했다.
- 검증: `pnpm test:db` PGlite DB 계약 PASS. 실제 Supabase/AI 브라우저 E2E는 실행하지 않았다.
- 원격 catalog 확인: public 테이블 49개, RLS 활성 49개. `persist_mission_goal_tracking`의 authenticated EXECUTE=false, service_role EXECUTE=true.
- 연결: 기존 linked-project.json의 ref를 명시하면 CLI 연결 성공. 이전 `--linked` 단독 오류를 DB 자체 연결 불능으로 해석하지 않는다.
- 문서: system-design의 원격 적용 상태, test-design의 LEARN-02 gate, Supabase README의 과거 스냅샷 안내를 갱신했다. 과거 SQL 참고 스냅샷은 재생성하지 않았다.
- 남은 작업: LEARN-02 실제 Supabase/AI E2E 및 SQL 참고 스냅샷 재추출. 전체 제품 검증 완료를 의미하지 않는다.
