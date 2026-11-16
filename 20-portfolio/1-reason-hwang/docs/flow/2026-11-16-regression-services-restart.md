# 회귀 수정 통합 및 서비스 재시작

- 날짜: 2026-11-16. 사용자 요청: 남은 회귀 수정 및 서비스 재시작.
- TA 시계열 근거, TA-Lib 상태/입력 제약, Query deadline, SEC 금융 검산의 현재 계약은 각 당일 flow 및 stock을 참조한다.
- Python TA 회귀 276 PASS, Host 관련 테스트60 PASS, SEC15 PASS. Bruno TA공통6/TA-Lib5/SEC10 PASS. 각 suite는 중복될 수 있으므로 합산하지 않는다.
- 브라우저 검증은 사용자 지시로 SKIP. 고정 모델 API 검증은 실제 모델의 해석/추출 품질을 보증하지 않는다.
- 재시작: BFF pnpm dev PID12325, FastAPI pnpm dev PID12326, LangGraph dev pnpm dev:langgraph PID12327, FE pnpm dev PID12328. 로그 /tmp/reason-hwang-services/. 사용자 요청에 따른 유지 대상 서버이며 검증 임시 서버가 아니다.
- 재시작 확인: 2980 /docs/sec 200, 2981 /health 200, 2982 /ok 200, 2983 /langgraph-dev-chat 200. BFF /api/health는 존재하지 않아404이며 health failure로 해석하지 않는다.
- 2981 및2982 /assistants/search 모두11 graph, technical_analysis_canvas_agent 포함. 기존 stale development process의 Canvas 누락 해소.
- 소유 검증 서버3981/3987/3194 및 임시Next빌드는 담당자가 정리 확인. 사용자 브라우저/DB/인프라 설정 변경 없음.
- SEC 검산 보호는 SEC API Agent research/chat 경로에 적용. 원시 sec_deep_agent 그래프 직접 실행은 이 후처리 경계 밖이다.
