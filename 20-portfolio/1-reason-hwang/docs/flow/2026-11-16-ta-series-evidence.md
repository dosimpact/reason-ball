# TA-EVIDENCE-001: 가격·거래량과 밴드 폭 해석 근거

- 날짜: 2026-11-16. 사용자 요청의 TSLA 밴드 폭·AMZN 가격/거래량·종합 설명 부족을 개선한다. human-docs는 읽기만 했다.
- 공통 pure helper가 실제 표시 구간의 null 제외 first/last/min/max/delta/상대변화·단위·날짜를 제공한다. 채널 폭은 (upper-lower)/middle*100, 시작값0/음수 상대변화는 미제공한다. 전체 배열을 모델에 보내지 않는다.
- 같은 계산 tool을 사용하는 inline/Canvas에 적용하고 Canvas compose/선택보고서 설명도 근거를 포함한다. 프롬프트는 해당 근거로 질문에 답하고 인과/예측 추정을 금지한다. 숫자 계산과 차트 원본은 불변이다.
- stock: [TA20](../stock/tech-shared/3-langgraph-fast/ta20.md#ta-evidence-001-분석-설명의-시계열-근거).
- CPU `pnpm -C 3-langgraph-fast test tests/domains/talib_agent/test_series_evidence.py tests/test_technical_analysis_agent.py -q`: 21 PASS. 가격+20%, 거래량-40%, 밴드폭20%→50%(30pp/상대150%) 독립 fixture, null/0/음수 분모 검증.
- Bruno `28-talib-price-regression`: 6requests/6tests/6assertions PASS. 고정 OHLCV를 실제 공유 분석 도구에 넣어 HTTP ToolMessage evidence/폭단위/배열부재도 검증했다. 외부 모델 호출0. 이 증거는 실제 모델의 문장 품질 보장은 아니며 브라우저는 사용자 지시로 skip.
- owned port3987 fixture PID8655/8812 종료, listener/PID 부재 확인. 사용자 서비스 변경·재시작/커밋 없음.
