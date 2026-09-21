# 미션 분류 DB 기반

- 날짜: 2026-09-21
- 요청: 카테고리·난이도 catalog의 DB 스키마부터 작업.
- 변경: CLI가 생성한 `20260920154920_mission_category_catalog.sql`에 2계층 mission_categories와 초기 28개 분류, nullable missions.category_id, 계층 검증용 generated 컬럼·복합 FK·인덱스·RLS/grants를 추가했다.
- 이유: 기존 생성 API를 유지하면서 세부 분류 연결을 준비한다. 기존 문자열·CEFR 값을 유지하고 불확실한 분류는 NULL로 둔다. 분류 읽기는 공개, 관리 쓰기는 서버 전용이다.
- 검증: `pnpm test:db` 전체 PASS. JSON 분류 일치, 기존 미분류, root/잘못된 FK/3계층 거부, leaf 연결, anon 읽기와 브라우저 쓰기 차단 포함.
- 원격: dry-run에서 신규 파일 1개를 확인한 후 `db push --project-ref <기존 ref> --skip-vault --yes` 적용 성공.
- 영향: MISSION-CATALOG-01의 business/system/test stock, Supabase 및 catalog README를 동기화했다.
- 한계: 앱 API·importer·브라우저 E2E·과거 버전 분류 snapshot은 이번 범위에 포함되지 않는다. 기존 SQL 참고 스냅샷은 재추출하지 않았다. 본문·샘플 미션을 원격에 생성하지 않았다.
