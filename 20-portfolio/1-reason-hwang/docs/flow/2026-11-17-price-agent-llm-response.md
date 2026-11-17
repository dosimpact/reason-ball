# 2026-11-17 price_agent 답변 LLM 전환

PRICE-RESPONSE-LLM-001. 사용자 요청으로 format_response.py의 결정적 Markdown/언어별 오류 조립을 async 모델 호출로 대체했다. 최신 사용자 메시지와 JSON 조회 결과만 전달해 과거 tool protocol 문제를 답변 모델에 재전달하지 않는다. error_code가 있으면 stale prices를 제외한다. 모델을 bind_tools하지 않아 답변 단계에서 새 도구를 호출하지 않는다. 현재 계약은 [시스템 설계](../stock/technical-analysis/system-design.md#price-response-llm-001-가격-답변-생성)에 반영했다.

검증: price_agent pytest19 PASS. 조회 근거 전달·최신 질문·오류 시 stale 가격 제외·graph 추출/응답 모델 각각 호출을 확인했다. 기존 고정 문구 테스트는 모델 입출력 계약 테스트로 바꿨다.

Bruno 스킬 원칙으로 소유 HTTP harness38971에서 실제 graph·모델·Yahoo 조회: 불완전 과거 이력이 포함된 messages 요청에 AAPL3일, error_code=null, 최종 response의 AAPL 표시 확인.1 request/1 test/1 assertion PASS. 제품 SDK thread UI 전수 검증과 구분한다. 소유 Uvicorn 정상 종료·포트 해제 확인, 기존 사용자 서버/브라우저 유지. diff check PASS. 답변 생성은 추가 모델 호출이므로 지연·비용이 늘며 수치 표현의 의미 정확성을 자동 보증하지 않는다.
