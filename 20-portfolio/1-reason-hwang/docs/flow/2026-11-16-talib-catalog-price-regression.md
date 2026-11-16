# TALIB-REG-001: 빈 그룹 필터와 주봉 준비 이력 회귀 수정

- 날짜: 2026-11-16
- 근거: 사용자 지정 회귀 보고서는 읽기만 했으며 수정하지 않았다.
- 변경: catalog group/search 공백 정규화, 일반 Yahoo 조회의 최근 요청 창 선선택, 실제 주기 오류 문구. fixed-origin 전체 검증과 요청 범위 안 불량 가격 거부는 유지한다.
- 원인: group=""이 실제 빈 이름 group으로 필터되었다. SK하이닉스 weekly600은 장기 period=max 응답 전체를 검증하므로 요청 밖 과거 음수 조정가격에서 실패했다. 실제 읽기 조회에서 전체1403행/불량155행(2002년까지)을 확인했다. 수정 후 동일 bounded 실제 읽기는 2015-05-25~2026-11-09 KRW 599개 유효 봉을 반환했다(선택600행 중 결측 제외). 값 보정·추정은 하지 않았다.
- stock: [TA 계산·조회](../stock/tech-shared/3-langgraph-fast/ta20.md#talib-reg-001-카탈로그-필터와-유한-가격-창).
- CPU: `pnpm -C 3-langgraph-fast test tests/domains/talib_agent/test_catalog_filters.py tests/graph/subgraph/price_agent/test_yahoo_finance_tool.py -q` 14/14 PASS. 빈/null/공백/유효·알수없는 그룹, 창 밖 불량/창 안 불량/fixed-origin 회귀 포함.
- API: Bruno 스킬 원칙으로 `28-talib-price-regression` 4requests/4tests/4assertions PASS. test-only FastAPI fixture에서 실제 도구/어댑터와 고정700행을 사용했다. production graph의 모델완료조건 검증은 별도 담당 범위이며 이 fixture가 대신 증명하지 않는다.
- 실행: collection 디렉터리에서 `../node_modules/.bin/bru run 28-talib-price-regression --env-var regressionBaseUrl=http://127.0.0.1:3987`.
- 자원: owned fixture PID98026 정상 종료. `ps` PID 부재와 port3987 listener 부재 확인. 외부 Yahoo 읽기2회, 외부 모델/DB쓰기0. 사용자 서비스 재시작 없음. 브라우저는 사용자 지시로 skip.
