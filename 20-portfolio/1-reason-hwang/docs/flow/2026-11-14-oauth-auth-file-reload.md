# OAUTH-RELOAD-001: 실행 중 OAuth 재로그인 반영

- 날짜: 2026-11-14
- 배경: 기존 캐시가 만료된 refresh token을 유지하여 호스트 재로그인 이후에도 401이 발생했다.
- 변경: 인증 조회마다 파일 재로드, 누락/불완전 파일의 이전 캐시 사용 금지, refresh 대기 중 외부 교체 우선.
- 이유: 작은 로컬 JSON을 다시 읽어 mtime/inode 기반 감시의 누락과 별도 watcher를 피한다.
- stock: [OAuth proxy](../stock/tech-shared/infra/2-codex-oauth-proxy/1-infra-l2-codex-proxy.md#oauth-reload-001-실행-중-재로그인-반영).
- 검증: `pnpm test:unit` 21 PASS. 추가 4개는 원자적 교체, 불완전 파일 복구, 삭제, HTTP health 복구를 검증.
- VAL-API-001: `PYTHONPATH=. uv run python api-test/check-auth-reload.py`와 동일한 runner로 Bruno HTTP 2 requests PASS, tests 2/2, assertions 4/4. 잘못된 파일에서 health false → 파일 교체 후 동일 서버 health true. 실제 OAuth 업스트림 호출은 하지 않음.
- 브라우저 UI가 없는 인증 저장소 로직으로 HTTP API 검증을 수행했다.
- 정리: 임시 디렉터리 자동 삭제, TestServer close 완료, Bruno 자식 종료 확인. 기존 2890 컨테이너와 사용자 인증 파일은 변경하지 않았다.
- 사용 스킬: apb-bruno-api-tests (기존 API 구조 확인, Bruno 요청/검증 작성 및 실행).
- 배포: 최초 1회 `docker compose up -d --build`. 이후 재로그인은 재시작 불필요.
- 제한: 별도 프로세스의 최종 확인~저장 사이 쓰기는 프로세스 간 lock으로 직렬화하지 않는다.
