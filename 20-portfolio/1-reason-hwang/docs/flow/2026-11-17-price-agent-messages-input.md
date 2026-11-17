# 2026-11-17 price_agent messages 입력 통일

PRICE-MESSAGES-001. 사용자 요청으로 query 필드를 state·추출·실행 helper·포맷터에서 제거했다. 최신 HumanMessage.text로 응답 언어를 결정하고 Host JSON 입력 예제·실제 graph 검증 스크립트·테스트를 갱신했다. 현재 계약은 [기술 설계](../stock/technical-analysis/system-design.md#price-messages-001-가격-에이전트-입력)에 반영했다. 기존 다른 사용자 변경은 보존했다.

검증: price_agent pytest21 PASS(빈 입력·언어 변경·schema query 부재 포함), Host typecheck PASS. Bruno 스킬 원칙으로 기존 소유 HTTP harness38971에 query 없는 messages만 전달해 실제 graph/모델/Yahoo AAPL3일 결과 확인:1 request/1 test/1 assertion PASS. 제품 SDK/브라우저 전체 흐름 재검증은 아니다. API 호출 검증이며 UI 표현 변경은 없다. 소유 harness 정상 종료·포트 해제 확인, 사용자 서버 유지. diff check PASS.
