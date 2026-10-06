# 1-infra-graph-rag

Neo4j, PostgreSQL과 로그·메트릭 관측 스택(Loki, Alloy, Prometheus, Grafana)을 로컬에서 실행하는 인프라 프로젝트입니다.

## 1. 실행 방법

1. 환경 파일 준비
```bash
cd 1-infra-graph-rag
cp .env.example .env
```

2. 서비스 기동
```bash
pnpm run infra:up
```

3. 상태 확인
```bash
pnpm run infra:ps
pnpm run infra:logs --tail=100 neo4j
pnpm run infra:logs --tail=100 postgres
pnpm run infra:logs --tail=100 alloy
pnpm run infra:logs --tail=100 prometheus
```

4. 주요 접속 주소
- Neo4j Browser: `http://localhost:7474`
- Grafana: `http://localhost:3001`
- Loki Ready: `http://localhost:3100/ready`
- Prometheus: `http://localhost:9090`
- cAdvisor: `http://localhost:8080`

5. 종료
```bash
pnpm run infra:down
```

## INFRA-COMPOSE-003: 역할별 Compose 파일

| 파일 | 서비스 |
| --- | --- |
| `docker-compose.postgres.yml` | PostgreSQL |
| `docker-compose.neo4j.yml` | Neo4j |
| `docker-compose.monitoring.yml` | PostgreSQL/Neo4j exporter, cAdvisor, Prometheus, Loki, Alloy, Grafana |

세 파일은 하나의 Compose 프로젝트로 조합한다. `pnpm run infra:compose`는 항상 세 파일을 `-f`로 전달하며, 기존 프로젝트명·`graph-rag` 네트워크·서비스명·bind mount·포트·healthcheck·의존성을 유지한다. 기존 `docker-compose.yml`은 제거했다. 직접 CLI를 사용할 때도 세 파일을 지정한다. [Docker Compose 파일 병합 규칙](https://docs.docker.com/compose/how-tos/multiple-compose-files/merge/)을 따른다.

```bash
pnpm run infra:config                # 구성 검증
pnpm run infra:up                    # 전체 기동
pnpm run infra:postgres:up           # PostgreSQL 기동
pnpm run infra:neo4j:up              # Neo4j 기동
pnpm run infra:monitoring:up         # 모니터링 및 필요한 DB 의존성 기동
pnpm run infra:monitoring:stop       # 모니터링만 정지
pnpm run infra:postgres:ps           # PostgreSQL 상태
pnpm run infra:logs --tail=100 alloy # 서비스 로그
pnpm run infra:down                  # 전체 컨테이너 및 네트워크 제거, 호스트 데이터 보존
```

각 그룹에 `up`, `stop`, `ps` 스크립트가 있다. 그룹별 `stop`은 컨테이너를 정지하고 공유 네트워크를 유지한다. DB 정지 시 해당 exporter의 수집은 DB가 다시 실행될 때까지 실패한다. 모니터링 파일은 DB를 참조하는 조합용 파일이므로 단독 `-f` 실행 대신 스크립트를 사용한다. `infra:monitoring:up`은 기존 `depends_on`에 따라 PostgreSQL을 기동하고 Neo4j가 healthy가 된 뒤 exporter를 기동한다.

## 2. 핵심 기능들

- Neo4j 그래프 데이터베이스를 로컬에서 즉시 실행할 수 있습니다.
- Alloy가 Docker metadata를 이용해 Neo4j와 PostgreSQL 로그를 Loki로 전달합니다.
- Prometheus가 cAdvisor, PostgreSQL exporter, Neo4j Community exporter의 메트릭을 수집합니다.
- Grafana Explore에서 `{service="neo4j"}` 또는 `{service="postgres"}`로 조회할 수 있습니다.
- Grafana에서 컨테이너 자원과 데이터베이스 상태를 함께 확인할 수 있습니다.
- Docker 볼륨으로 데이터, Loki 로그, Prometheus 시계열, Alloy 수집 상태를 유지합니다.

## 3. 운영 복구

프로젝트 전체 bring-up, 포트 계약, PostgreSQL/Neo4j 복구 절차는
[../docs/05-runbooks/operations.md](../docs/05-runbooks/operations.md)를
기준으로 확인합니다.
