# Graph RAG Infra Design

## Goal

LangGraph Agent와 Graph RAG 개발에 필요한 데이터베이스와 로그·메트릭 관측 환경을 Docker Compose로 구성한다.
- Neo4j와 PostgreSQL을 로컬 데이터 저장소로 사용
- Alloy, Loki, Grafana로 컨테이너 로그를 수집하고 조회
- Prometheus와 exporter로 컨테이너 및 데이터베이스 메트릭을 수집하고 조회
- 서비스 데이터와 관측 데이터를 호스트 디렉터리에 영속화

## Infra Overview

```text
Neo4j / PostgreSQL / observability services
             │ stdout · stderr
             ▼
      Docker logging driver ── Alloy ── Loki ──┐
                                               │
Neo4j ── Bolt/APOC ── neo4j-exporter ──────────┤
PostgreSQL ── SQL ── postgres-exporter ─────────┤
Docker runtime ── cAdvisor ─────────────────────┤
                                               ▼
                                          Prometheus
                                               │
                         Loki + Prometheus ─────┴── Grafana
```

| 서비스 | 역할 | 포트 |
| --- | --- | --- |
| Neo4j | Graph RAG 그래프 데이터베이스 | `7474`, `7687` |
| PostgreSQL | 수집 데이터 저장소 | `${POSTGRES_PORT} -> 5432` |
| Loki | 로그 저장 및 LogQL 조회 | `3100` |
| Alloy | Docker 로그 수집 및 Loki 전달 | 외부 공개 없음 |
| cAdvisor | 컨테이너 CPU, 메모리, 네트워크, 파일시스템 메트릭 | `${CADVISOR_HTTP_PORT} -> 8080` |
| PostgreSQL exporter | PostgreSQL 통계 뷰를 Prometheus 포맷으로 변환 | 외부 공개 없음 (`9187` 내부) |
| Neo4j exporter | Bolt, Cypher, APOC 기반 Community Edition 메트릭 | 외부 공개 없음 (`9412` 내부) |
| Prometheus | 메트릭 scrape, 시계열 저장 및 PromQL 조회 | `${PROMETHEUS_HTTP_PORT} -> 9090` |
| Grafana | 로그·메트릭 대시보드와 Explore UI | `3001 -> 3000` |

서비스 간 통신은 `graph-rag` 브리지 네트워크와 Compose 서비스명을 사용한다. Alloy는 `http://loki:3100`으로 로그를 전달하고 Prometheus는 각 exporter의 내부 주소를 scrape한다.

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

## Data Persistence

모든 영속 데이터는 `.env`의 `VOLUME_PREFIX` 아래에 서비스별로 저장한다.

```text
Volume/
├── neo4j/{data,logs,import,plugins}
├── postgres/data
├── loki/data
├── prometheus/data
├── alloy/data
└── grafana/data
```

컨테이너를 재생성해도 데이터는 유지된다. 데이터베이스 계정은 빈 데이터 디렉터리에서 처음 실행할 때 `.env` 값으로 초기화되므로, 기존 데이터가 있는 상태에서 비밀번호만 변경해도 DB 내부 계정에는 자동 반영되지 않는다.

## Alloy Log Collection

Alloy는 Neo4j나 PostgreSQL에 직접 접속하지 않는다. 읽기 전용으로 마운트한 `/var/run/docker.sock`을 통해 실행 중인 컨테이너와 stdout/stderr 로그를 발견한다.

`discovery.docker`가 컨테이너를 찾고 `discovery.relabel`이 Docker metadata를 다음 Loki 라벨로 변환한다.

| 라벨 | 예시 | 의미 |
| --- | --- | --- |
| `container` | `reason-postgres` | 실제 Docker 컨테이너 이름 |
| `service` | `postgres` | Compose 서비스명 |
| `project` | `1-infra-graph-rag` | Compose 프로젝트명 |
| `source` | `docker` | 로그 수집 원천 |

`loki.source.docker`가 로그를 읽고 `loki.process`가 공통 라벨을 추가한 뒤, `loki.write`가 `http://loki:3100/loki/api/v1/push`로 전달한다. Neo4j `/logs` 파일은 stdout 로그와 중복될 수 있어 별도로 수집하지 않는다.

## Log Query

Grafana Explore 또는 프리셋 대시보드에서 서비스 라벨로 로그를 조회한다.

```logql
{service="neo4j"}
{service="postgres"}
{service=~"loki|alloy|grafana"}
{project="1-infra-graph-rag"}
```

Grafana에는 전체 서비스, Neo4j, PostgreSQL, 관측 스택 로그 대시보드를 provisioning한다.

## Metrics Collection

Prometheus는 `monitoring/prometheus/prometheus.yml`에 정의된 대상을 15초 간격으로 pull한다.

| job | endpoint | 관측 범위 |
| --- | --- | --- |
| `cadvisor` | `cadvisor:8080/metrics` | 컨테이너 CPU, 메모리, 네트워크, 파일시스템 |
| `postgres` | `postgres-exporter:9187/metrics` | 연결, 트랜잭션, 락, DB 크기 등 PostgreSQL 내부 상태 |
| `neo4j` | `neo4j-exporter:9412/probe` | Bolt 응답, DB 상태, 활성 트랜잭션, 인덱스, APOC store/transaction |
| `neo4j-exporter` | `neo4j-exporter:9412/metrics` | exporter 자체 상태와 scrape 통계 |
| `prometheus` | `prometheus:9090/metrics` | Prometheus 자체 상태 |

Neo4j Community Edition에는 공식 Prometheus endpoint가 없으므로 고정 버전 `ghcr.io/i-harsha-reddy/neo4j-exporter:0.1.0`을 사용한다. 이 exporter는 신생 커뮤니티 프로젝트이므로 Enterprise 메트릭과 동일한 보장을 제공하지 않는다. 현재 범위에서는 APOC/Cypher 메트릭만 사용하고 Jolokia 기반 JVM 메트릭은 비활성화한다. 컨테이너 CPU와 메모리는 cAdvisor가 담당한다.

PostgreSQL exporter는 기존 DB 계정으로 읽기 전용 통계 조회를 수행한다. 운영 환경에서는 `pg_monitor` 권한만 부여한 전용 계정으로 분리해야 한다.

cAdvisor는 macOS 호스트 자체가 아니라 Docker Desktop Linux VM 내부 컨테이너를 관측한다. Linux 운영 환경과 비교하면 일부 filesystem/device 라벨이 제한되거나 다를 수 있다.

Prometheus의 로컬 보존 기간은 15일이다. Grafana에는 UID `prometheus` datasource와 `Graph RAG Metrics Overview` 대시보드를 provisioning한다.

Grafana datasource와 dashboard preset의 디렉터리 구조, UID 규칙, 변경 및 검증 절차는 [Grafana 대시보드 프로비저닝 가이드](./grafana-provisioning.md)를 따른다.

## Verification

```bash
pnpm run infra:ps
pnpm run infra:logs --tail=100 alloy
curl http://localhost:3100/ready
curl http://localhost:9090/-/ready
curl http://localhost:9090/api/v1/targets
curl http://localhost:8080/healthz
```

Loki와 Prometheus가 `ready`를 반환하고, Prometheus targets에서 `cadvisor`, `postgres`, `neo4j`가 `UP`이며, Grafana에서 로그와 메트릭이 조회되면 관측 경로가 정상이다.
