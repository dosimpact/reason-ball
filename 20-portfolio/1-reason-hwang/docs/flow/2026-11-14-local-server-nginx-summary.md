# LOCAL-NGINX-001: 로컬 서버·Nginx 연결표 정리

- 날짜: 2026-11-14
- 요청: 사용자가 지정한 `docs/human-docs/server설정.local.md`를 첨부 화면과 예시 형식에 맞춰 간단히 정리.
- 권한: 최신 사용자 명시 요청으로 해당 파일만 human-docs 편집 금지의 예외 적용. 이미지 및 나머지 human-docs는 보존.
- 변경: 내부 바인딩·실행 명령·Nginx 전달 대상·외부 도메인, 두 Remote 및 인프라 주소 정리. PostgreSQL 5433/2972 차이와 HTTP/TCP 구분, loopback 바인딩 확인 사항 명시.
- Stock: [Workspace LOCAL-NGINX-001](../stock/tech-shared/workspace.md#local-nginx-001-외부-도메인-연결-기록) 동기화.
- 검증: 제공 이미지, package scripts, BFF 기본 host, 로컬 환경 파일의 포트 키만 대조. Markdown 링크·diff 검사. 런타임 변경 없음, 외부 연결 검증 미수행. API·View·업무 로직 실행 검증 적용 대상 아님.
- 자원: 서버·브라우저·임시 자원 생성 없음, 기존 사용자 자원 유지.
