# Graph RAG Infra Design

## Goal

LangGraph Agent와 Graph RAG 개발에 필요한 데이터베이스와 로그 관측 환경을 Docker Compose로 구성한다.
- Neo4j와 PostgreSQL을 로컬 데이터 저장소로 사용
- Alloy, Loki, Grafana로 컨테이너 로그를 수집하고 조회
- 서비스 데이터와 로그 수집 상태를 호스트 디렉터리에 영속화

## Infra Overview

```text
Neo4j / PostgreSQL / Loki / Grafana
                │
                │ stdout · stderr
                ▼
         Docker logging driver
                │
                │ Docker socket API
                ▼
          Grafana Alloy
                │
                │ Loki Push API
                ▼
              Loki
                │
                ▼
             Grafana
```

| 서비스 | 역할 | 포트 |
| --- | --- | --- |
| Neo4j | Graph RAG 그래프 데이터베이스 | `7474`, `7687` |
| PostgreSQL | 수집 데이터 저장소 | `${POSTGRES_PORT} -> 5432` |
| Loki | 로그 저장 및 LogQL 조회 | `3100` |
| Alloy | Docker 로그 수집 및 Loki 전달 | 외부 공개 없음 |
| Grafana | 로그 대시보드와 Explore UI | `3001 -> 3000` |

서비스 간 통신은 `graph-rag` 브리지 네트워크와 Compose 서비스명을 사용한다. Alloy는 `http://loki:3100`으로 로그를 전달하므로 실제 `container_name` 변경에는 영향을 받지 않는다.

## Data Persistence

모든 영속 데이터는 `.env`의 `VOLUME_PREFIX` 아래에 서비스별로 저장한다.

```text
Volume/
├── neo4j/{data,logs,import,plugins}
├── postgres/data
├── loki/data
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

Grafana에는 전체 서비스, Neo4j, PostgreSQL, 관측 스택 로그 대시보드를 provisioning한다. 현재 datasource는 Loki만 사용하므로 CPU, 메모리, DB connection 같은 metric은 수집 대상이 아니다.

## Verification

```bash
pnpm run infra:ps
docker-compose logs --tail=100 alloy
curl http://localhost:3100/ready
```

Loki가 `ready`를 반환하고 Grafana에서 `service="neo4j"`, `service="postgres"` 로그가 조회되면 수집 경로가 정상이다.
