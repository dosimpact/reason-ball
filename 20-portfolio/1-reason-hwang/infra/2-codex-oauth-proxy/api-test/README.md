# API endpoint tests

이 테스트는 실제 Codex OAuth 프록시를 Docker Compose로 실행하고 `POST /v1/chat/completions`, `GET /v1/models` 엔드포인트를 검증한다.

## 사전 준비

1. OAuth 인증 정보를 발급한다.

   ```bash
   pnpm oauth
   ```

2. Docker Desktop 또는 Docker Engine을 실행한다. 테스트 runner가 현재 소스를 반영하도록 Compose 이미지를 빌드하고 서비스를 실행한다.

## 실행

```bash
pnpm test:api
```

runner는 `OAuth 확인 → Docker Compose 빌드 및 기동 → health 확인 → Bruno 실행` 순서로 동작한다. 테스트가 직접 시작한 Compose 서비스만 종료하며, 기존에 실행 중이던 서비스는 갱신 후 유지한다. 실행 로그는 `api-test/reports/`에 저장한다.

각 요청의 HTTP 상태, 응답 시간, JSON 응답 본문은 터미널과 실행 로그에 함께 출력된다.
