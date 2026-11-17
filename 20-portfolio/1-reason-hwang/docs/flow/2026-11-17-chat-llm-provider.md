# 공통 채팅 LLM provider 전환 — 2026-11-17

- 요구: CHAT-LLM-001. 전체 채팅 LLM을 하나의 `.env` 플래그로 전환하며 기본은 OAuth proxy.
- 채팅·OpenUI 출력의 provider 선택을 통합하고 임베딩·SEC 추출·Decisions는 별도 설정으로 유지한다.
- provider별 주소·키·모델을 묶어 이전 전용 override가 전환을 방해하지 않도록 한다.
- 사용자 로컬 `.env`에는 기본 flag를 반영하되 자격 증명이나 `.env` 파일은 커밋하지 않는다.
- 구현·검증 및 정리 결과는 완료 시 추가한다.

## 구현과 검증

- ChatModelSettings를 공통 선택기로 도입하고 SEC/TA chat_model, OpenUI ModelSettings,
  starter/simple/price/main의 기존 provider adapter가 같은 flag를 따르도록 연결했다.
- main_graph의 legacy provider 이름은 검증하지만 실제 경로는 공통 환경 flag가 결정한다.
- worker execution version에 provider·모델·주소를 포함한다. 키는 hash 입력에 넣지 않는다.
- `.env.example`에 두 provider 설정을 명시하고 로컬 `.env`에는 기본 oauth-proxy flag와 OpenAI 빈 키 슬롯을 추가했다.
- 기존 SEC/OpenUI 검사 26 PASS 및 변경 Python Ruff PASS.
- Bruno 스킬을 적용한 HTTP fixture 검증 5 requests/5 tests/5 assertions PASS.
  OAuth·OpenAI·기본값은 실제 SDK ainvoke를 로컬 upstream으로 보냈고 잘못된 flag·키 누락은 422로 검증했다.
- 외부 유료 모델 호출과 브라우저 검증은 하지 않았다. 기존 API 중심 범위를 유지했다.
- 소유 uvicorn PID34873 종료, 39871 LISTEN 없음 확인. 사용자 서비스는 재시작하지 않았다.

재현: `3-langgraph-fast`에서 `PYTHONPATH=src:. uv run python -m uvicorn tests.fixtures.chat_provider_app:app --host 127.0.0.1 --port 39871`,
별도 터미널의 `bruno-api-tests`에서 `../node_modules/.bin/bru run 36-chat-provider --env local --env-var baseUrl=http://127.0.0.1:39871`.
현재 stock: [공통 채팅 LLM](../stock/tech-shared/3-langgraph-fast/chat-llm-provider.md).

최종 회귀: provider/UI/API/SEC/TA/TA-Lib 관련 78개 PASS(기존 deprecation 경고 13개). SDK mock HTTP에서 양쪽 provider 주소·모델·인증 헤더를 확인했다.
