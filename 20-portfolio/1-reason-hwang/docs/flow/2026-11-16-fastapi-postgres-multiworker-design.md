# PostgreSQL 기반 FastAPI 여러 worker 설계

- 날짜: 2026-11-16
- ID: LG-OSS-MULTI-001
- 요청: Redis 없는 여러 worker 설계를 사용자가 지정한 `docs/human-docs/0.infra/langgraph-oss.md`에 포인트별로 작성.
- 범위: 해당 파일의 편집은 이번 명시적 요청에 한정한다. 다른 human-docs 파일은 변경하지 않는다.
- 변경: 기존 초기 전환 계획은 보존하고 상단에 현재 stock 안내를 추가했다. 미구현 후속 설계로 DB 접수·전역 용량·thread 순서·lease/fencing·checkpoint 보호·취소·복구·SSE 이벤트·연결 예산·전환 및 API 검증 기준을 추가했다.
- 이유: worker별 Task/잠금/이벤트 메모리와 startup 일괄 recover는 다중 프로세스의 공통 상태로 사용할 수 없다. 기존 PostgreSQL saver만으로 실행 소유권이나 오래된 writer 보호가 해결되지 않는다.
- 제안 정책: 미실행 대기 작업은 재선점 가능, 실행 시작 후 owner 유실은 interrupted이며 자동 재실행하지 않음. 무제한 토큰 replay는 기존 합의대로 제외. 모든 기본 시간·용량 수치는 부하 검증 전 제안값이다.
- 영향 stock: [FastAPI runtime](../stock/tech-shared/3-langgraph-fast/fastapi-runtime.md)의 후속 설계 경계만 추가. 현재 단일 worker 구현 설명은 유지.
- 검증: 현재 RunManager/recover/saver 연결과 문서 대조, 로컬 Markdown 링크 대상·diff 검사. API·UI 동작 변경이 없어 실행 테스트는 해당 없음. PostgreSQL SELECT/NOTIFY 공식 문서를 확인했다.
- 스킬: supabase-postgres-best-practices의 SKIP LOCKED·짧은 트랜잭션 지침 적용.
- 자원: 서버·브라우저·DB·임시 컨테이너를 생성하지 않았으며 schema·서비스 설정·코드를 변경하지 않았다.
- 후속: saver 쓰기와 owner 검증을 같은 트랜잭션으로 묶을 수 있는지 기술 검증한 후 구현을 시작한다. 문서 작성은 다중 worker 운영 검증 완료를 뜻하지 않는다.
