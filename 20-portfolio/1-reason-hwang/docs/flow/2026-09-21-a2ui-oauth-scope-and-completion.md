# A2UI OAuth 검증 범위 및 완료 기록

- 날짜: 2026-09-21
- 맥락: API-key 실모델 자격 증명 확인 질문에 사용자가 “지금 OAuth만 검증”이라고 결정하고 목표 재개를 요청했다.
- 결정: A2UI-MODEL-001, MODEL-01, A2UI-VAL-001의 실제 모델 검증 범위를 OAuth로 한정한다. API-key 연결 지원 코드는 유지하되 실제 실행은 미검증으로 표시한다. 과거 API-key 차단 기록은 역사로 보존한다.
- 현재 구현: 61 UI 파일/66 어댑터, 4 정적 카탈로그와 v0.9 계약, Dynamic/Fixed/action, 편집 가능한 카탈로그, 진행 SSE, SEC 회사·공시 조회와 선택 원문 기반 보고서.
- 검증: 계약 69 PASS, Storybook 75 PASS, Python 143 PASS/13 opt-in SKIP, 프런트 lint/typecheck/build PASS, Python typecheck 및 변경 범위 lint PASS. 최종 순차 HTTP 회귀는 Dynamic/Fixed 7요청/8테스트/8assertion, SEC 8요청/8테스트/8assertion PASS.
- 브라우저: 실제 OAuth 생성, 지역 변경, 항공편 선택, 데이터 모델 편집, 진행 표시, 취소/재시도, SEC 페이지/필터/선택/보고서 생성 검증. SEC 통신 실패와 SSE RUN_ERROR는 통제 fixture, BFF503/모델 장애 복구는 graph 테스트다. 실제 상위 장애 전체 경로를 검증했다고 주장하지 않는다.
- 제한: 전체 Python lint는 변경하지 않은 18개 파일의 기존 48오류로 실패한다. 해당 파일은 이번 작업에서 수정하지 않는다. API-key 실모델 검증은 범위 밖이다.
- 문서 동기화: a2ui-system의 INDEX, 공통 설계, langgraph, SEC, 운영·검증, 완료 감사에 현재 범위를 반영했다.
- 완료 절차: 최종 diff/생성물 검사 후 A2UI 변경만 커밋한다. 별도 reverse-biz 및 청월당 문서와 문서 지도 항목은 보존하며 제외한다.
- 증거: [완료 감사](../stock/tech-shared/a2ui-system/acceptance-audit.md), [최종 HTTP 회귀](2026-09-21-a2ui-final-http-regression.md).
