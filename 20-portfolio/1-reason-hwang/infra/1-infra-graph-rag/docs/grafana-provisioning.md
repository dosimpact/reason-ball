# Grafana 대시보드 프로비저닝 가이드

## 목적

이 프로젝트는 Grafana 화면에서 datasource와 dashboard를 수동으로 생성하지 않는다. Git에 저장된 YAML과 JSON을 Grafana 컨테이너에 읽기 전용으로 마운트하고, Grafana provisioning 기능으로 시작 시 자동 등록한다.

이 방식의 목적은 다음과 같다.

- 개발 환경을 새로 만들어도 동일한 datasource와 dashboard를 재현한다.
- 대시보드 변경 내용을 코드 리뷰와 버전 관리 대상으로 만든다.
- Grafana 영속 볼륨을 초기화해도 기본 관측 화면을 복구한다.
- 로그와 메트릭 대시보드가 사용하는 datasource UID를 고정한다.

## 디렉터리 구조

```text
monitoring/grafana/
├── dashboards/
│   ├── metrics-overview.json
│   ├── neo4j-logs-dashboard.json
│   ├── observability-logs-dashboard.json
│   ├── postgres-logs-dashboard.json
│   └── services-logs-overview.json
└── provisioning/
    ├── dashboards/
    │   └── dashboards.yaml
    └── datasources/
        └── loki.yaml
```

`provisioning/`은 Grafana가 무엇을 등록할지 정의하고, `dashboards/`는 실제 대시보드 모델을 담는다.

## 컨테이너 마운트

`docker-compose.yml`의 Grafana 서비스는 다음 세 경로를 읽기 전용으로 마운트한다.

| 호스트 경로 | 컨테이너 경로 | 용도 |
| --- | --- | --- |
| `monitoring/grafana/provisioning/datasources` | `/etc/grafana/provisioning/datasources` | datasource 자동 등록 |
| `monitoring/grafana/provisioning/dashboards` | `/etc/grafana/provisioning/dashboards` | dashboard provider 등록 |
| `monitoring/grafana/dashboards` | `/var/lib/grafana/dashboards` | dashboard JSON 원본 |

Grafana의 사용자, 조직, UI 설정 등 런타임 데이터는 `${VOLUME_PREFIX}/grafana/data`에 별도로 영속화된다. 프로비저닝 파일은 Git이 원본이고 Grafana 데이터 볼륨은 런타임 상태다.

## Datasource 프로비저닝

`monitoring/grafana/provisioning/datasources/loki.yaml`은 다음 datasource를 만든다.

| 이름 | UID | 내부 URL | 기본 datasource |
| --- | --- | --- | --- |
| Loki | `loki` | `http://loki:3100` | 예 |
| Prometheus | `prometheus` | `http://prometheus:9090` | 아니요 |

대시보드는 표시 이름보다 고정 UID를 참조해야 한다.

```json
{
  "datasource": {
    "type": "prometheus",
    "uid": "prometheus"
  }
}
```

로그 패널은 `loki`, 메트릭 패널은 `prometheus` UID를 사용한다. `editable: false`는 UI에서 datasource 설정이 임의로 변경되는 것을 막는다.

## Dashboard provider

`monitoring/grafana/provisioning/dashboards/dashboards.yaml`은 `/var/lib/grafana/dashboards`의 JSON 파일을 읽어 `Graph-RAG` 폴더에 등록한다.

```yaml
providers:
  - name: Graph RAG Dashboards
    orgId: 1
    folder: Graph-RAG
    type: file
    disableDeletion: false
    allowUiUpdates: true
    options:
      path: /var/lib/grafana/dashboards
```

설정 의미는 다음과 같다.

- `folder: Graph-RAG`: 프로비저닝 대시보드를 Grafana의 `Graph-RAG` 폴더에 배치한다.
- `type: file`: JSON 파일을 대시보드 원본으로 사용한다.
- `disableDeletion: false`: 원본 JSON이 제거되면 프로비저닝된 대시보드도 제거될 수 있다.
- `allowUiUpdates: true`: UI 편집과 저장을 허용한다.
- `path`: 컨테이너에서 JSON 파일을 읽는 위치다.

UI에서 저장한 변경은 Git의 JSON 파일을 수정하지 않는다. Grafana 데이터베이스에만 저장되므로, 유지할 변경은 반드시 JSON을 export하여 `monitoring/grafana/dashboards/`에 반영해야 한다. 이후 원본 파일이 다시 프로비저닝되면 UI 변경이 덮어써질 수 있다.

## 제공 대시보드

| 파일 | 제목 | UID | 패널 수 | datasource |
| --- | --- | --- | ---: | --- |
| `metrics-overview.json` | Graph RAG Metrics Overview | `graph-rag-metrics` | 9 | Prometheus |
| `services-logs-overview.json` | Graph RAG Services Logs | `graph-rag-services-logs` | 3 | Loki |
| `neo4j-logs-dashboard.json` | Neo4j Logs Overview | `neo4j-logs-overview` | 1 | Loki |
| `postgres-logs-dashboard.json` | PostgreSQL Logs Overview | `postgres-logs-overview` | 3 | Loki |
| `observability-logs-dashboard.json` | Observability Stack Logs | `observability-stack-logs` | 2 | Loki |

`uid`는 Grafana URL, API 및 대시보드 간 링크의 안정적인 식별자다. 파일명이나 제목을 변경해도 같은 대시보드로 갱신하려면 UID를 유지한다. 새 대시보드를 만들 때는 기존 UID와 겹치지 않는 고유 값을 지정한다.

## 대시보드 변경 절차

### JSON을 직접 수정하는 경우

1. `monitoring/grafana/dashboards/*.json`을 수정한다.
2. JSON 문법을 검사한다.
3. Grafana가 파일을 다시 읽을 때까지 기다리거나 컨테이너를 재시작한다.
4. Grafana UI와 API에서 반영 결과를 확인한다.

```bash
jq empty monitoring/grafana/dashboards/*.json
docker-compose restart grafana
```

### Grafana UI에서 수정하는 경우

1. Grafana의 `Graph-RAG` 폴더에서 대시보드를 편집한다.
2. 패널과 쿼리가 정상인지 확인한다.
3. 대시보드 JSON을 export한다.
4. export 결과에서 환경별 임시 값이 없는지 검토한다.
5. 해당 JSON 파일을 교체하고 `uid`를 유지한다.
6. 컨테이너 재시작 후 다시 검증한다.

UI 저장만으로 작업을 완료하지 않는다. Git에 반영되지 않은 변경은 Grafana 데이터 볼륨을 초기화하면 사라진다.

## 새 대시보드 추가 절차

1. 고유한 파일명과 dashboard UID를 정한다.
2. datasource UID를 `loki` 또는 `prometheus`로 지정한다.
3. JSON을 `monitoring/grafana/dashboards/`에 추가한다.
4. JSON 문법과 Grafana 로딩을 검증한다.

provider가 디렉터리 전체를 읽으므로 `dashboards.yaml`에 파일명을 추가할 필요는 없다.

```bash
jq empty monitoring/grafana/dashboards/new-dashboard.json
docker-compose restart grafana
```

## 검증

Grafana 상태와 프로비저닝 결과는 API로 확인할 수 있다.

```bash
curl -u "$GRAFANA_ADMIN_USER:$GRAFANA_ADMIN_PASSWORD" \
  http://localhost:3001/api/health

curl -u "$GRAFANA_ADMIN_USER:$GRAFANA_ADMIN_PASSWORD" \
  http://localhost:3001/api/datasources/uid/prometheus

curl -u "$GRAFANA_ADMIN_USER:$GRAFANA_ADMIN_PASSWORD" \
  http://localhost:3001/api/dashboards/uid/graph-rag-metrics
```

`.env`는 셸에 자동 export되지 않으므로 필요하면 먼저 안전한 방식으로 환경변수를 로드하거나 실제 계정으로 대체한다. 명령 기록에 운영 비밀번호를 직접 작성하지 않는다.

Grafana 로그에서 provisioning 오류를 확인할 수도 있다.

```bash
docker-compose logs --tail=100 grafana
```

확인할 대표 오류는 datasource UID 불일치, 잘못된 JSON, 중복 dashboard UID, 파일 권한 및 datasource 연결 실패다.

## 운영 규칙

- 프로비저닝 JSON과 YAML을 source of truth로 취급한다.
- datasource와 dashboard UID는 한번 사용한 뒤 불필요하게 변경하지 않는다.
- 비밀번호나 토큰을 dashboard JSON에 넣지 않는다.
- 쿼리에 고카디널리티 라벨이나 원문 쿼리 문자열을 무제한으로 노출하지 않는다.
- Grafana UI에서 실험한 변경은 검증 후 JSON으로 export하여 Git에 반영한다.
- 파일 삭제는 프로비저닝된 대시보드 삭제로 이어질 수 있으므로 변경 이력을 남긴다.
