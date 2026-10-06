# INFRA-COMPOSE-003: PostgreSQL / Neo4j / monitoring Compose 분리

- 날짜: 2026-10-06
- 범위: tech-shared / infra/1-infra-graph-rag
- 요청: 단일 Compose 파일을 PostgreSQL, Neo4j, 모니터링 플랫폼 3개 파일로 분리하고 package scripts 갱신.
- 결정: `docker-compose.postgres.yml`, `docker-compose.neo4j.yml`, `docker-compose.monitoring.yml`을 `-f`로 조합한다. exporter는 monitoring에 둔다. 기존 프로젝트와 네트워크를 유지하여 별도 네트워크 생성·볼륨 이전 없이 DB 의존성과 Neo4j healthy 대기를 보존한다.
- 스크립트: 전체 up/down/ps 유지, compose/config/logs와 그룹별 up/stop/ps 추가. monitoring up은 DB 의존성을 기동하며 그룹 stop은 공유 네트워크를 제거하지 않는다.
- 기존 단일 파일은 제거하고 README 및 Grafana 운영 명령을 새 스크립트로 갱신.

## 동기화한 stock

- [공통 시스템 설계](../stock/tech-shared/system-design.md): 파일 구성과 공통 실행 경계.
- [인프라 setup](../stock/tech-shared/infra/1-infra-graph-rag/1-infra-l1-setup.md): 현재 명령과 파일 구성.
- [패키지 설계](../../infra/1-infra-graph-rag/docs/design.md): 서비스 배치, 의존성, 운영 명령.

## 검증

- PASS: 변경 전 단일 파일과 변경 후 세 파일을 각각 `docker compose config --format json`으로 정규화한 전체 객체가 동일함. 9개 서비스, 프로젝트명, 네트워크, mount 경로, 환경 변수, 포트, healthcheck, depends_on 모두 보존. 실제 환경 값은 출력하거나 저장하지 않음.
- PASS: `pnpm run infra:config`.
- PASS: `pnpm run infra:ps`; 기존 프로젝트의 실행 중 컨테이너를 새 파일 조합으로 조회함. 6개 실행 컨테이너가 확인됐으며 이 결과를 전체 9개 서비스 정상 기동 증거로 해석하지 않음.
- PASS: `git diff --check`.
- VAL-API-001 / VAL-VIEW-001 / VAL-BROWSER-001: API, View, 비즈니스 로직 변경이 없는 Compose 구성 분리이므로 적용 대상 아님.
- 라이브 up/down과 모니터링 수집 E2E는 실행하지 않음. 이번 검증은 구성 동등성과 명령 해석 검증임.
- VAL-CLEANUP-001: 검증 과정에서 서버·컨테이너·브라우저·볼륨·임시 파일을 생성하지 않음. 기존 서비스와 사용자 작업은 유지함.
