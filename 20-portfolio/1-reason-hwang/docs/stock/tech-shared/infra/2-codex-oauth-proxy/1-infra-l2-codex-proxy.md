# Codex OAuth proxy

## 역할·HTTP 계약

`infra/2-codex-oauth-proxy`는 aiohttp 기반 OpenAI 호환 프록시다. ChatGPT OAuth 인증을 사용해 Codex upstream을 호출하며 Codex CLI 프로세스를 매 요청 실행하는 방식이 아니다.

- POST /v1/chat/completions: Chat Completions 입력을 upstream 형식으로 변환하고 JSON 응답을 되돌린다.
- POST /v1/responses: Responses 형식을 전달한다. stream=true일 때 실제 upstream SSE bytes를 전달하고, 비스트리밍은 응답을 수집해 JSON 반환한다. 완료 JSON을 가짜 토큰 스트림으로 분할하지 않는다.
- GET /v1/models: 지원 모델 목록.
- GET /health: 현재 로컬 인증 상태 확인. health만으로 upstream 생성 성공까지 보장하지 않는다.

구현 원본은 [core/proxy_server.py](../../../../../infra/2-codex-oauth-proxy/core/proxy_server.py), [api_translator.py](../../../../../infra/2-codex-oauth-proxy/core/api_translator.py)다. 일반 채팅·OpenUI의 모델 선택은 [공통 provider](../../3-langgraph-fast/chat-llm-provider.md)를 따른다.

## 설치·실행

```sh
pnpm -C infra/2-codex-oauth-proxy install
pnpm -C infra/2-codex-oauth-proxy oauth
pnpm -C infra/2-codex-oauth-proxy infra:up
pnpm -C infra/2-codex-oauth-proxy infra:ps
```

로그인 후 callback URL을 수동 입력해 `.config/chatgpt_auth.json`을 만든다. Compose는 host config 디렉터리를 /app/.config에 마운트한다. 토큰·account ID는 비밀이며 로그·문서·커밋에 포함하지 않는다. 포그라운드 실행은 `pnpm start`다.

컨테이너 내부18741, Compose 기본 호스트 loopback2890이며 CODEX_OAUTH_PROXY_PORT로 변경한다. host 직접 실행의 포트는 runtime 설정을 따른다. 로컬 프로필은 [workspace](../../workspace.md)를 확인한다. 코드 변경 배포 시 패키지의 `docker-compose up -d --build`로 이미지를 갱신한다.

## OAUTH-RELOAD-001: 실행 중 재로그인

TokenManager는 토큰/account ID 조회 시 lock 안에서 인증 파일을 다시 읽는다. 호스트 `pnpm oauth:force`로 재로그인하면 다음 인증 조회부터 반영되어 재시작이 필요 없다. 파일 누락·파싱 실패·필수 값 누락 시 이전 캐시로 성공을 가장하지 않는다. refresh 응답 대기 중 외부 교체가 있으면 새 파일을 우선한다. 마지막 확인~저장 사이 별도 프로세스 쓰기를 프로세스 간 lock으로 직렬화하지 않는 제한은 남는다.

## 검증과 오류

`test:unit`과 `PYTHONPATH=. uv run python api-test/check-auth-reload.py`는 파일 교체·삭제·손상/복구를 격리된 인증 파일/소유 HTTP 서버에서 확인한다. live upstream 검증은 `health-check:sdk`, `health-check:langgraph`, `test:api`로 구분하며 자격 증명·네트워크가 필요하다. 설치·health 성공을 실제 모델 성공으로 확대 해석하지 않는다.

401이면 파일 상태와 재로그인 반영을 확인하고 반복 refresh로 잘못된 토큰을 계속 저장하지 않는다. upstream 연결 실패·시간초과·비정상 SSE는 호출 오류이며 출력이 성공했다고 처리하지 않는다. 이미 SSE header가 전송된 이후의 장애는 두 번째 JSON 응답이 아니라 연결 실패로 전파된다.
