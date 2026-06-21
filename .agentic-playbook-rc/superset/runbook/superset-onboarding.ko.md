# Apache Superset 기본 온보딩

이 문서는 로컬 Docker Compose 환경에서 Apache Superset을 실행하고, Superset으로 무엇을 할 수 있는지 빠르게 파악하기 위한 runbook입니다.

## 1. Superset 개요

Apache Superset은 웹 기반 오픈소스 BI 및 데이터 탐색 플랫폼입니다. 공식 문서 기준으로 Superset은 차트 작성, 대시보드 구성, SQL Lab, 데이터베이스 연결, 시맨틱 레이어, 보안/RBAC, API 기반 확장을 지원합니다.

대표 사용 시나리오는 다음과 같습니다.

- 여러 SQL 데이터베이스 또는 데이터 엔진을 연결해 탐색합니다.
- SQL Lab에서 쿼리를 작성하고 저장합니다.
- Dataset을 만들어 컬럼, 계산 지표, 가상 컬럼을 표준화합니다.
- No-code Chart Builder로 테이블, 시계열, 지리공간 등 다양한 시각화를 만듭니다.
- 대시보드에서 필터, cross-filter, drill-to-detail, drill-by로 상호작용형 분석 화면을 구성합니다.
- Redis 기반 캐시와 Celery worker로 느린 쿼리, 캐시 워밍, 비동기 작업을 분리할 수 있습니다.
- 역할과 권한으로 데이터베이스, dataset, dashboard 접근을 제어합니다.
- SMTP/Slack/headless browser를 추가하면 alert/report 자동 발송을 구성할 수 있습니다.
- REST API와 커스텀 시각화 플러그인으로 내부 플랫폼에 통합할 수 있습니다.

## 2. 로컬 인프라 구성

이 저장소의 `docker-compose.yml`은 학습용 Superset 스택입니다.

- `superset-db`: Superset 메타데이터를 저장하는 PostgreSQL입니다. 분석 대상 원천 DB가 아니라 Superset 내부 설정 저장소입니다.
- `superset-cache`: Redis 캐시, Celery broker, Celery result backend입니다.
- `superset-init`: DB migration, admin 계정 생성, 예제 데이터 적재, 권한 동기화를 수행하는 1회성 초기화 작업입니다.
- `superset-app`: Superset 웹 UI/API입니다. 호스트의 `http://localhost:8088`로 노출됩니다.
- `superset-worker`: SQL Lab 비동기 작업, 캐시 작업, 추후 alert/report 작업을 처리하는 Celery worker입니다.
- `superset-worker-beat`: 예약 작업을 트리거하는 단일 Celery beat입니다.

이 구성은 프로덕션용이 아닙니다. 공식 문서도 Docker Compose를 로컬 샌드박스 또는 개발 용도로 권장하며, 프로덕션은 별도 이미지 하드닝, 메타DB 백업, 외부 secret 관리, Kubernetes/Helm 등을 검토해야 합니다.

## 3. 실행

Docker Compose 플러그인이 있으면 다음을 사용합니다.

```bash
docker compose up -d
```

이 환경처럼 Docker CLI 플러그인이 없고 standalone Compose만 있으면 다음을 사용합니다.

```bash
docker-compose up -d
```

초기 실행은 이미지 다운로드와 예제 데이터 적재 때문에 몇 분 걸릴 수 있습니다. 예제 데이터가 필요 없으면 다음처럼 실행합니다.

```bash
SUPERSET_LOAD_EXAMPLES=no docker-compose up -d
```

## 4. 접속과 확인

브라우저에서 `http://localhost:8088`에 접속합니다.

기본 계정은 다음과 같습니다.

```text
username: admin
password: admin
```

상태 확인 명령은 다음과 같습니다.

```bash
docker-compose ps
curl -f http://localhost:8088/health
```

로그 확인은 다음과 같습니다.

```bash
docker-compose logs -f superset-app
docker-compose logs -f superset-init
```

중지는 다음과 같습니다.

```bash
docker-compose down
```

메타데이터까지 삭제하고 완전히 초기화하려면 named volume을 함께 삭제합니다.

```bash
docker-compose down -v
```

## 5. 운영 시 주의점

- `SUPERSET_SECRET_KEY`는 로컬 기본값을 그대로 쓰지 말고 환경 변수로 교체합니다.
- PostgreSQL volume은 Superset의 핵심 메타데이터입니다. 보존해야 하는 대시보드가 있으면 백업 대상입니다.
- 공식 `apache/superset:6.0.0-dev` 이미지는 로컬 온보딩 편의를 위한 선택입니다. 프로덕션은 필요한 DB driver를 포함한 별도 이미지를 빌드하는 편이 맞습니다.
- alert/report 기능은 기본 비활성화되어 있습니다. 사용하려면 SMTP 또는 Slack 설정, headless browser, feature flag를 추가해야 합니다.
- 하나의 환경에는 Celery beat를 하나만 둡니다. 여러 개를 실행하면 예약 작업이 중복 발송될 수 있습니다.

## 6. 참고 링크

- Apache Superset Quickstart: https://superset.apache.org/user-docs/quickstart/
- Docker Compose 설치 문서: https://superset.apache.org/admin-docs/installation/docker-compose/
- Installation Methods: https://superset.apache.org/admin-docs/installation/installation-methods/
- Superset 소개와 기능: https://superset.apache.org/user-docs/intro/
- Async Queries via Celery: https://superset.apache.org/admin-docs/configuration/async-queries-celery/
- Alerts and Reports: https://superset.apache.org/admin-docs/configuration/alerts-reports/
