# Fixed 항공편 샘플 확장

- 날짜: 2026-09-21
- 요구: 도쿄→인천 조회가 없는 이유를 확인한 사용자가 추가 케이스를 요청했다.
- FIX-02: 샘플을 2편에서 10편으로 확장. 인천↔도쿄/오사카/방콕/싱가포르, 부산↔오사카. 기존 ID와 가격 유지, 신규 가격도 가상.
- FIX-03: 모델 프롬프트에 도시/공항 매핑·방향 준수·미지원 안내를 명시. 존재하지 않는 노선은 실제 운항 불가로 단정하지 않는다. 텍스트만 반환한 Fixed 턴을 surface 누락 오류로 처리하던 문제도 수정했다. 도구 사용 후 생성 실패와 Dynamic의 무출력 오류는 유지한다.
- stock: [LangGraph 서비스](../stock/tech-shared/a2ui-system/langgraph.md).
- VAL-API-001: 기존 Bruno 컬렉션에 역방향/미지원 시나리오 추가. 최초 실행에서 Dynamic OAuth APIConnectionError 및 Fixed 무출력 ContractError 발견. Fixed 수정 후 순차 재실행: pnpm --filter reason-hwang-langgraph-fast test:a2ui:api --env-var baseUrl=http://127.0.0.1:18083 → 9요청/10테스트/10assertion PASS (25.816초). Dynamic 연결 재시도도 PASS.
- 단위 회귀: pnpm --filter reason-hwang-langgraph-fast test tests/test_a2ui_workflow.py -q → 5 PASS. 없는 노선 안내 후 같은 thread에서 역방향 카드 생성 검증. 최초 명령의 불필요한 -- 전달로 수집 실패했으며 수정된 명령으로 정상 실행.
- 정적 검사: 변경 Python 파일 ruff PASS, package typecheck 0오류/0경고, git diff --check PASS.
- VAL-BROWSER-001: Playwright MCP, http://localhost:2820/a2ui/fixed → 실제 OAuth/18083. 도쿄→인천 NRT/ICN/$279 카드와 선택 완료 PASS. 새 대화 파리→뉴욕은 데모 데이터 부재 안내와 정상 완료 PASS. 같은 대화에서 싱가포르→인천 SIN/ICN/$389 카드 및 정상 완료 PASS.
- View 파일 변경 없음: Storybook 재실행 대상 아님. 테스트는 순차 실행. 원래 사용자 문서 변경은 보존.
