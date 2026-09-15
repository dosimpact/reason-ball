# 명시적 LAN 접속

날짜: 2026-09-15
상태: 사용자 요청에 따른 구현

- 변경 전: 127.0.0.1 바인딩과 로컬 Host만 허용해 LAN 접속 불가.
- 변경 후: `dev:lan`으로 0.0.0.0 바인딩. `PLANNER_ALLOWED_HOSTS`에 명시한 서버 주소를 로컬 주소에 추가하고 동일 Origin 검사를 유지한다. Next 개발 자산에도 허용 주소를 연결한다.
- HTTP LAN에서는 보안 컨텍스트 전용 randomUUID 대신 getRandomValues로 UUID를 생성한다. 클립보드 제한 시 오류 대신 수동 복사를 안내한다.
- 로컬 기본 명령·기존 데이터는 변경하지 않는다. 인증을 추가한 것은 아니므로 신뢰하는 내부망 전용이다.
- 영향 문서: README, 현재 설계 09. 테스트: HTTP LAN 허용·다른 Host/Origin 및 wildcard 거부, 비보안 컨텍스트 요청 ID.
- 검증: 전체 테스트 40개·lint·typecheck 통과. 서버를 LAN 모드로 재시작한 뒤 서버 기기에서 LAN 주소로 UI/API 200, SSE ready, 실제 MCP SDK 도구 11개 조회 및 다른 Origin 403을 확인했다. 다른 기기의 방화벽·네트워크 경로는 별도 확인이 필요하다.
