# 2026-09-20 Metrics Observability

## Context

기존 인프라는 Alloy, Loki, Grafana를 통한 컨테이너 로그 관측만 제공했다. Neo4j와 PostgreSQL의 실시간 상태 및 컨테이너 자원 사용량을 시계열로 확인할 수 없었다.

## Change

- Prometheus를 메트릭 저장소 및 scrape 엔진으로 추가했다.
- cAdvisor를 컨테이너 CPU, 메모리, 네트워크, 파일시스템 관측에 추가했다.
- `prometheus-community/postgres_exporter`를 PostgreSQL 내부 상태 수집에 추가했다.
- Neo4j Community Edition용 Bolt/APOC exporter를 고정 버전으로 추가했다.
- Grafana에 Prometheus datasource와 메트릭 대시보드를 provisioning했다.
- Prometheus 로컬 보존 기간을 15일로 설정했다.

## Rationale

로그만으로는 자원 포화, 연결 증가, 트랜잭션 정체와 같은 상태 변화를 연속적으로 판단하기 어렵다. 컨테이너 계층과 DB 내부 계층을 분리 수집하여 원인 분석 범위를 넓힌다.

Neo4j Community Edition에는 공식 Prometheus endpoint가 없어 커뮤니티 exporter를 사용한다. 신생 exporter의 위험을 제한하기 위해 `0.1.0`으로 고정하고 Jolokia 연동은 제외했다.

## Affected Stock Sections

- `docs/design.md`: Infra Overview, Data Persistence, Metrics Collection, Verification
- `README.md`: 실행 상태 확인, 접속 주소, 핵심 기능

## Validation Status

- `docker-compose config --quiet`: PASS
- 전체 9개 컨테이너 기동: PASS
- Prometheus targets `cadvisor`, `neo4j`, `neo4j-exporter`, `postgres`, `prometheus`: 모두 UP
- `neo4j_up=1`, `pg_up=1`: PASS
- cAdvisor Docker factory 등록 및 Compose 컨테이너 이름 라벨: PASS
- Grafana Prometheus datasource UID `prometheus`: PASS
- Grafana dashboard UID `graph-rag-metrics`, 9 panels: PASS
- Grafana database health: PASS
- `pnpm run infra:ps`: PASS, 9개 서비스 표시
- `pnpm run infra:down`: PASS, 컨테이너·네트워크 제거 및 호스트 볼륨 보존
- `pnpm run infra:up`: PASS, 9개 서비스 복구 후 Prometheus targets 전체 UP

추가로 로컬 `.env`의 `VOLUME_PREFIX`를 `/Users/dodo/workspace/Volume`, `POSTGRES_PORT`를 `5432`로 변경했다. 새 볼륨 루트는 기존 볼륨의 자동 마이그레이션 없이 별도 초기화되었다.
