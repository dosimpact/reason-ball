# 2026-11-17 price_agent 불완전한 도구 이력 수정

PRICE-HISTORY-001. 사용자 보고의 502를 조사했다. 실행 중인 OAuth proxy 로그에서 상위 SSE error의 실제 사유가 `No tool output found for function call`임을 확인했다. 프록시가 해당 오류 이벤트를 파싱 실패로 감싸 `Invalid response from upstream` 502를 반환했다. 신규 쿠팡 요청은 실제 모델/Yahoo에서 성공했다. 원래 실패 요청 전체는 확보하지 않았으므로 생성 경로까지 단정하지 않는다.

요청 추출에서 결과 없는 과거 호출과 고아 결과를 모델 입력에서 제외하고 완전한 쌍·기존 대화는 유지한다. 이전 오류 상태도 초기화한다. 프록시의 일반 SSE 오류 분류는 이번 변경 범위 밖이며, upstream 장애 전체가 해결됐다고 주장하지 않는다.

[현재 설계](../stock/technical-analysis/system-design.md#price-history-001-불완전한-가격-도구-이력).

검증:
- price_agent pytest 18 PASS: 기존 정상·오류·Yahoo·캐시, 불완전 이력 제거, 정상 pair 유지.
- 실제 모델/Yahoo: 쿠팡10일 신규 요청 성공, 불완전 과거 호출+기존 오류가 있는 AAPL3일 요청 성공.
- apb-bruno-api-tests 스킬 적용: 별도 소유 FastAPI HTTP harness38971에서 실제 price_agent graph 호출. Bruno1 request/1 test/1 assertion PASS, AAPL3일·error_code=null 확인. 제품 SDK thread 전체 경로가 아니라 문제 노드/실제 graph의 HTTP 검증이다.
- Ruff 실행은 설치되지 않아 미실행. pytest와 diff check로 확인했다.
- 브라우저 UI 변경 없음. 서버 harness 정상 종료와 포트38971 해제 확인. 공유 proxy/사용자 서버는 재시작하지 않았다. 모델 호출 외 사용자 DB 변경 없음.
