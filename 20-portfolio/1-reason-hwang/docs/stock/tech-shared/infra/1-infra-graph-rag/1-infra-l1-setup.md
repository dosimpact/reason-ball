# DB·모니터링 인프라

## 구성과 경계

`infra/1-infra-graph-rag`는 하나의 Compose 프로젝트와 graph-rag 네트워크를 사용한다. PostgreSQL은 SEC 원문·애플리케이션·체크포인트, Neo4j는 가공 그래프·벡터 검색을 담당한다. 데이터 스키마는 각 애플리케이션 stock에서 관리한다.

| Compose 파일 | 서비스 |
| --- | --- |
| docker-compose.postgres.yml | PostgreSQL16 |
| docker-compose.neo4j.yml | Neo4j5.26, APOC |
| docker-compose.monitoring.yml | PostgreSQL/Neo4j exporter, cAdvisor, Prometheus, Loki, Alloy, Grafana |

로그는 Docker→Alloy→Loki, 지표는 exporter/cAdvisor→Prometheus→Grafana로 전달한다. 모니터링 그룹 기동 시 DB 의존성도 기동한다. 그룹 stop은 공유 네트워크를 제거하지 않는다.

## 실행

프로젝트 루트에서 커밋된 스크립트를 사용한다.

```sh
pnpm -C infra/1-infra-graph-rag infra:config
pnpm -C infra/1-infra-graph-rag infra:up
pnpm -C infra/1-infra-graph-rag infra:ps
pnpm -C infra/1-infra-graph-rag infra:logs
```

그룹별 `infra:postgres:up/stop/ps`, `infra:neo4j:up/stop/ps`, `infra:monitoring:up/stop/ps`를 제공한다. `infra:down`은 프로젝트를 중지하되 호스트 데이터 디렉터리를 삭제하지 않는다. 스크립트는 docker-compose CLI와 세 -f 파일 조합을 사용한다.

## 설정과 영속성

`.env.example` 기준 호스트 포트는 PostgreSQL55432, Neo4j7474/7687, Loki3100, Prometheus9090, cAdvisor8080, Grafana3001이다. Compose 자체 fallback과 example 값은 다를 수 있으므로 실제 `.env`를 우선한다. Mac Studio 프로필2970~2974와 proxy2890은 [workspace](../../workspace.md#local-env-001-mac-studio-로컬-연결-설정)에 있다.

`POSTGRES_PASSWORD`, `VOLUME_PREFIX` 등 필수 설정을 준비한다. 영속 데이터는 VOLUME_PREFIX 아래 서비스별 bind mount에 있다. 재시작·일반 정리에서 볼륨을 지우지 않는다. 비밀번호·토큰·.env·런타임 데이터는 커밋하지 않는다. 운영 환경의 모니터링 권한은 최소 권한 계정으로 제한한다.

## 확인과 제한

Compose config 검사, 서비스 상태, DB 접속, Loki readiness, Prometheus targets, Grafana datasource를 각각 확인한다. 컨테이너 Up은 수집·대시보드 정상 여부의 보증이 아니다. config 동등성 검사와 live up/down·모니터링 E2E는 별개의 증거다. 현재 실행 상태는 운영 시점에 다시 조회한다.

상세 서비스 설정은 [패키지 설계](../../../../../infra/1-infra-graph-rag/docs/design.md), 애플리케이션 실행·포트는 [workspace](../../workspace.md), 검증 절차는 [test design](../../test-design.md)을 따른다.
