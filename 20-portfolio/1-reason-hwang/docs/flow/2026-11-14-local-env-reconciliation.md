# LOCAL-ENV-001: 다른 컴퓨터에서 복사한 앱 환경 설정 동기화

- 날짜: 2026-11-14
- 요청: Host/BFF/FastAPI의 세 로컬 환경 파일을 현재 Mac 및 Docker에 맞게 수정.
- 확인: 실행 중인 Docker published ports 및 infra `.env`, 각 앱의 환경 변수 사용 코드를 대조.
- 변경: 두 앱의 PostgreSQL 포트 5432 → 2972 및 비밀번호 동기화. FastAPI Neo4j Bolt 7687 → 2971 및 비밀번호 동기화. 타 컴퓨터 OpenAPI 절대경로를 현재 checkout으로 수정. Host LangGraph upstream 2024 → 8000.
- 유지: 공개 API 경로 `/api/langgraph`, starter_graph, OAuth proxy 2890 및 지원 모델. 사용자 human-docs 변경은 읽거나 수정하지 않음.
- stock: [LOCAL-ENV-001](../stock/tech-shared/workspace.md#local-env-001-mac-studio-로컬-연결-설정).
- 검증 PASS: PostgreSQL 실제 호스트 TCP 인증 + SELECT 1, Neo4j Bolt verify_connectivity, 두 앱 DB 값 일치, OpenAPI 경로 존재 및 JSON paths, live proxy 모델 목록에 설정 모델 존재, proxy health token_valid=true.
- 범위: 로컬 설정만 변경, 애플리케이션 구현/API 계약 변경 없음. 앱 서버 시작이나 schema migration은 수행하지 않음. 전체 UI/API E2E는 미실행이며 전체 앱 동작을 보장하지 않음.
- 확인 필요: 2800/2801은 다른 Docker 서비스가 사용 중. 2980/2981로 변경할지 사용자에게 질문함. 기존 서비스를 종료하거나 포트 계약을 임의 변경하지 않음.
- 추가 미확정: BFF SEC_USER_AGENT는 example.com placeholder이며 실제 SEC 요청에 쓸 연락처가 필요함. 이메일을 임의 생성하지 않음.
- 자원: DB 연결 close, HTTP 요청 종료. 새 서버/컨테이너 미생성. uv run이 로컬 가상환경 의존성을 lockfile 기준으로 동기화함.
