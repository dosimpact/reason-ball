# alloy-logging-migration Gradate

## Design

Promtail의 호스트 파일 glob 수집을 Alloy의 Docker API 기반 discovery로 교체한다.
Compose metadata를 안정적인 Loki 라벨로 변환하고, Loki는 TSDB v13과 filesystem
object store를 명명된 볼륨에서 사용한다. 애플리케이션 데이터와 외부 포트 계약은
유지하며 문서와 Grafana 쿼리를 새 라벨 계약에 맞춘다.

## Implementation Draft

### Architecture Overview

`neo4j/postgres → Docker logging driver → Alloy discovery/relabel/process/write →
Loki TSDB/filesystem → Grafana datasource/dashboard`의 단일 로그 경로를 사용한다.
Alloy는 Docker socket을 읽기 전용으로 사용하고 Loki와 Alloy 상태는 각각
`loki_data`, `alloy_data` 볼륨에 저장한다.

### Modules

| Module | Responsibility | Public Interface |
| --- | --- | --- |
| `docker-compose.yml` | 서비스, 네트워크, 볼륨 및 이미지 버전 조합 | `alloy`, `loki`, `infra:*`가 참조하는 서비스 |
| `monitoring/alloy/config.alloy` | Docker discovery, metadata relabel, Loki 전송 | `service`, `project`, `container`, `source` labels |
| `monitoring/loki/loki-config.yaml` | 단일 노드 TSDB와 filesystem 저장 | HTTP `:3100`, `/ready`, Loki push/query API |
| Grafana provisioning/dashboard | Loki datasource와 Neo4j 로그 패널 | `{service="neo4j"}` |
| `package.json` | 호환되는 Compose lifecycle 명령 | `infra:up/down/ps` |
| README 및 `docs/1-infra-l1-setup.md` | 사용자 실행·검증 계약 | 명령, URL, LogQL 예시 |

### Interfaces

- `pnpm run infra:up`: Neo4j, PostgreSQL, Loki, Alloy, Grafana 기동
- `pnpm run infra:down`: Compose 프로젝트 서비스 종료 및 제거
- `pnpm run infra:ps`: 서비스 상태 출력
- Loki selectors: `{service="neo4j"}`, `{service="postgres"}`
- Loki readiness: `GET http://localhost:3100/ready`

### Dependencies

- Docker Engine socket `/var/run/docker.sock`
- `grafana/alloy:v1.17.0`, `grafana/loki:3.7.3`
- Grafana datasource `http://loki:3100`
- Docker named volumes `alloy_data`, `loki_data`

### Data Flow

1. Neo4j와 PostgreSQL이 stdout/stderr를 Docker logging driver에 기록한다.
2. Alloy가 Docker socket에서 실행 컨테이너와 Compose metadata를 발견한다.
3. relabel 단계가 metadata를 `container`, `service`, `project` 라벨로 변환한다.
4. process 단계가 `source="docker"` 정적 라벨을 추가한다.
5. Alloy가 로그를 `http://loki:3100/loki/api/v1/push`로 전송한다.
6. Loki가 TSDB 인덱스와 chunk를 `loki_data`에 저장한다.
7. Grafana가 Loki datasource와 서비스별 LogQL로 로그를 조회한다.

## Gap Analysis (Pre-Validate)

| Design Item | Implementation Evidence | Status |
| --- | --- | --- |
| Promtail → Alloy | `docker-compose.yml`, `monitoring/alloy/config.alloy` | Matched |
| Docker metadata labels | Alloy `discovery.relabel` rules | Matched |
| Neo4j/PostgreSQL collection | Loki API queries returned both service streams | Matched |
| Loki persistence | `loki_data:/var/lib/loki`, TSDB v13 config | Matched |
| Alloy persistence | `alloy_data:/var/lib/alloy/data` | Matched |
| Dashboard label migration | `neo4j-logs-dashboard.json` | Matched |
| Lifecycle scripts | infra package `package.json` | Matched |
| Documentation | README, `docs/1-infra-l1-setup.md` | Matched |

## Implementation Notes

- `docker compose`가 설치되지 않은 현재 환경과의 호환성을 위해 package scripts는
  기존 `docker-compose` 실행 파일을 유지했다.
- Loki named volume은 이미지의 비-root 사용자로 생성 경로에 쓸 수 없어 로컬 개발
  구성에서 Loki만 `user: "0:0"`으로 실행한다.
- 기존 Promtail orphan 컨테이너는 실제 기동 검증 중 제거했다.
- Neo4j `/logs` 파일은 Docker stream과 중복 가능성이 있어 수집하지 않았다.
- Pre-Validate design match rate: 100%.
