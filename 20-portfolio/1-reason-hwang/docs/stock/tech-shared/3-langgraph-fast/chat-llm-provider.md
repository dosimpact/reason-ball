# CHAT-LLM-001: 공통 채팅 LLM provider

`3-langgraph-fast/.env`의 `CHAT_LLM_PROVIDER` 하나로 모든 채팅 LLM과 OpenUI 출력 LLM을 전환한다.
기본값은 `oauth-proxy`이며 `openai`를 선택하면 OpenAI API 키로 직접 호출한다.

```dotenv
CHAT_LLM_PROVIDER=oauth-proxy
CHAT_LLM_OAUTH_BASE_URL=http://127.0.0.1:2890/v1
CHAT_LLM_OAUTH_MODEL=gpt-5.6-luna
CHAT_LLM_OAUTH_API_KEY=chatgpt-oauth-placeholder
CHAT_LLM_OPENAI_BASE_URL=https://api.openai.com/v1
CHAT_LLM_OPENAI_MODEL=gpt-4.1-mini
CHAT_LLM_OPENAI_API_KEY=
```

OpenAI로 전환할 때는 실제 키와 지원 모델을 `CHAT_LLM_OPENAI_*`에 설정하고 flag를 `openai`로 바꾼다.
provider가 설정되지 않으면 OAuth proxy를 사용한다. 잘못된 flag나 OpenAI 키 누락은 오류다.
OAuth 전용 주소·모델·키는 기존 `OPENAI_*` 설정을 fallback으로 읽을 수 있다.
OpenAI 모드는 기존 `OPENAI_BASE_URL`과 `OPENAI_MODEL`을 읽지 않으며 기본 공식 주소와 모델을 사용한다.
직접 API 키는 전용 키가 없으면 `OPENAI_API_KEY`를 읽지만 placeholder는 허용하지 않는다.

이전 `SEC_CHAT_MODEL*`, `SEC_CHAT_API_KEY`, `OPENUI_MODEL*`, `OPEN_UI_MODEL*`는 공통 선택을
덮어쓰지 않는다. 프로그래밍 방식의 명시적 모델 주입은 테스트용으로 유지한다.
`main_graph`의 기존 provider 입력은 호환성을 위해 검증하지만 실제 채팅 provider는 환경 flag로 선택한다.

채팅·도구 호출은 기존 Chat Completions 방식, OAuth OpenUI 출력은 기존 Responses 방식과
system→developer 호환 변환을 유지한다. provider 통합은 API 전송 형식을 전부 같게 만든다는 뜻이 아니다.
임베딩 `SEC_EMBEDDING_*`, 추출 `SEC_EXTRACTION_*`, 직접 Decisions API는 별도 설정이다.
`OPENAI_API_KEY`를 다른 직접 API 클라이언트가 사용하고 있다면 그 키를 보존한다.

수정 후 FastAPI와 LangGraph 프로세스를 재시작한다. 모델 객체는 그래프를 로드할 때 생성될 수 있다.
기존 실행 중인 작업에 설정을 즉시 바꾸는 기능은 제공하지 않는다.

`bruno-api-tests/36-chat-provider/`와 `tests/fixtures/chat_provider_app.py`의 로컬 upstream fixture로 기본값, 두 provider의 SDK 요청 주소·모델·인증 헤더, 잘못된 설정과 키 누락 오류를 확인했다. 외부 모델 호출과 브라우저 검증은 수행 범위에 포함되지 않았다.
