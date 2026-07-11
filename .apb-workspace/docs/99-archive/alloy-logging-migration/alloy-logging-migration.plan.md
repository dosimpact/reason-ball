# alloy-logging-migration Plan

## Goal

`20-portfolio/1-reason-hwang/infra/1-infra-graph-rag`의 로그 수집기를
지원 종료된 Promtail 2.9.8에서 Grafana Alloy로 이전한다. Neo4j와 PostgreSQL의
Docker 로그를 서비스별 라벨로 Loki에 전달하고, Loki와 수집 위치 상태를
컨테이너 재생성 후에도 유지하며, 실제 구성과 인프라 문서를 일치시킨다.

## Scope

- In scope:
  - `docker-compose.yml`에서 `promtail` 서비스를 제거하고 버전이 고정된
    Grafana Alloy 서비스를 추가한다.
  - Docker socket 기반 서비스 탐색으로 Compose 프로젝트와 서비스 메타데이터를
    Loki 라벨로 제공한다.
  - Neo4j와 PostgreSQL의 `stdout`/`stderr` 컨테이너 로그를 수집한다.
  - 필요성이 확인된 경우에만 Neo4j `/logs/*.log` 파일 수집을 추가하고,
    컨테이너 로그와의 중복 수집을 방지한다.
  - Loki 저장 경로와 Alloy 수집 상태에 영속 볼륨을 적용한다.
  - PostgreSQL을 `graph-rag` 네트워크에 포함해 서비스 구성을 일관되게 만든다.
  - `package.json`의 실행, 종료, 상태 확인 스크립트를 Alloy 서비스 기준으로 갱신한다.
  - Promtail 설정을 Alloy 설정으로 대체하고 사용하지 않는 설정 파일을 정리한다.
  - `20-portfolio/1-reason-hwang/docs/1-infra-l1-setup.md`의 서비스 표,
    로그 흐름, 실행법, 검증법, 영속화 설명을 실제 구성에 맞게 갱신한다.
  - 관련 `README.md`와 Grafana 대시보드 쿼리에서 Promtail 또는 기존 라벨에
    의존하는 부분을 찾아 필요한 범위에서 갱신한다.
- Out of scope:
  - Grafana Cloud 또는 외부 Loki 서비스 연동
  - 운영 환경용 고가용성 Loki 클러스터 구성
  - PostgreSQL 전체 SQL 문장 로깅 활성화
  - Neo4j query log의 무조건적인 활성화
  - 애플리케이션 코드의 로깅 프레임워크 변경

## Verification

- Implementation scope:
  - Compose 서비스, Alloy River 설정, Loki 저장 설정, pnpm 스크립트,
    Grafana 쿼리 및 인프라 문서를 하나의 변경 단위로 맞춘다.
  - 기존 Neo4j, PostgreSQL, Grafana의 포트와 데이터 볼륨은 호환성을 유지한다.
- Public interfaces:
  - `pnpm run infra:up`, `pnpm run infra:down`, `pnpm run infra:ps`
  - Loki HTTP readiness endpoint `http://localhost:${LOKI_HTTP_PORT:-3100}/ready`
  - Grafana Explore LogQL: `{service="neo4j"}`, `{service="postgres"}`
  - Compose 서비스 이름 `alloy`
- External dependencies:
  - 고정 버전의 `grafana/alloy`, `grafana/loki`, `grafana/grafana` 이미지
  - Docker Engine socket과 Docker Compose metadata
- Internal dependencies:
  - `monitoring/loki/loki-config.yaml`
  - 신규 `monitoring/alloy/config.alloy`
  - Grafana datasource 및 Neo4j 로그 대시보드
  - `.env.example`, `README.md`, `docs/1-infra-l1-setup.md`
- Risky areas:
  - Loki 2.9에서 최신 호환 버전으로 올릴 때 스키마와 설정 형식이 달라질 수 있다.
  - Docker socket 마운트는 호스트 메타데이터 접근 권한을 부여한다.
  - macOS Docker Desktop에서는 `/var/lib/docker/containers` 호스트 마운트와
    Docker socket 기반 수집의 동작 차이를 확인해야 한다.
  - stdout과 Neo4j 파일 로그를 동시에 수집하면 로그가 중복될 수 있다.
  - 라벨 이름 변경 시 기존 Grafana 대시보드 쿼리가 결과를 반환하지 않을 수 있다.
  - 영속 볼륨으로 변경할 때 기존 임시 Loki 로그의 자동 마이그레이션은 보장하지 않는다.

## Validation

- 모든 Compose 서비스가 정상 기동하고 health/readiness 확인을 통과한다.
- Alloy가 Neo4j와 PostgreSQL 로그를 Loki로 전송한다.
- Loki에서 `service="neo4j"`와 `service="postgres"`로 로그를 분리 조회할 수 있다.
- Loki와 Alloy 컨테이너 재생성 후에도 로그 및 수집 위치 상태가 유지된다.
- Promtail 컨테이너, 실행 스크립트 및 활성 설정 참조가 남아 있지 않다.
- Grafana datasource와 관련 대시보드가 변경된 라벨로 정상 조회된다.
- `1-infra-l1-setup.md`와 프로젝트 README가 실제 서비스 및 명령과 일치한다.

### E2E 시나리오

- Given 마이그레이션된 구성이 설치되어 있고, When `pnpm run infra:up`을 실행하면,
  Then Neo4j, PostgreSQL, Loki, Alloy, Grafana가 실행되고 Promtail은 존재하지 않는다.
- Given Neo4j와 PostgreSQL이 실행 중일 때, When 각 서비스에서 로그를 발생시키면,
  Then Loki에서 서비스별 LogQL selector로 해당 로그만 조회할 수 있다.
- Given 로그가 Loki에 적재됐을 때, When Loki와 Alloy 컨테이너를 재생성하면,
  Then 기존 Loki 로그가 조회되고 Alloy는 저장된 수집 위치를 사용해 불필요한 재수집을 하지 않는다.
- Given Grafana가 실행 중일 때, When 프로비저닝된 datasource와 Neo4j 로그
  대시보드를 열면, Then datasource 연결과 변경된 라벨 기반 쿼리가 정상 동작한다.
- Given 구현이 완료됐을 때, When Compose, package scripts, README 및
  `1-infra-l1-setup.md`를 비교하면, Then 서비스명, 명령, 포트, 로그 흐름 및
  영속화 설명이 서로 일치한다.

## Skills

### Gradate 단계

- 별도 `apb-*` 구현 스킬 없음: 이 기능은 React/API/테스트 코드가 아닌 Docker
  Compose와 Grafana 설정 마이그레이션이며, `apb-pgv`의 Gradate 설계 및 구현
  절차를 직접 적용한다.

### Validate 단계

- apb-static-analysis
- apb-gap-analysis
- apb-validation-report
