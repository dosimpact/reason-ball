# alloy-logging-migration Validate

## Scope

- Promtail 서비스를 Grafana Alloy로 교체
- Docker metadata 기반 Neo4j/PostgreSQL 로그 수집 및 서비스 라벨 제공
- Loki TSDB와 Alloy 수집 상태 영속화
- Grafana 대시보드, package scripts, README, 인프라 L1 문서 동기화
- 실제 Docker Compose 기동, Loki API 조회, 컨테이너 재생성 검증

## Validation Checklist

| Check | Result | Evidence |
| --- | --- | --- |
| Compose 서비스 정상 기동 및 readiness | PASS | `docker-compose config --quiet`, `docker-compose ps`, Loki `/ready` = `ready` |
| Alloy의 Neo4j/PostgreSQL 로그 전송 | PASS | Loki query API에서 두 `service` stream 반환 |
| 서비스 라벨별 로그 분리 조회 | PASS | `{service="neo4j"}`, `{service="postgres"}` 쿼리 성공 |
| Loki/Alloy 컨테이너 재생성 후 상태 유지 | PASS | `--force-recreate loki alloy` 후 기존 Neo4j 로그 조회 성공 |
| Promtail 활성 참조 및 컨테이너 제거 | PASS | 대상 파일 `rg` 결과 없음, orphan Promtail 제거 확인 |
| Grafana datasource/dashboard 라벨 호환 | PASS | datasource URL 유지, dashboard JSON 파싱 및 `{service="neo4j"}` 적용 |
| 문서와 실제 구성 일치 | PASS | README와 `1-infra-l1-setup.md`에 Alloy, 서비스 LogQL, 영속화 반영 |
| Static analysis | PASS | Compose config 및 JSON syntax PASS; lint/typecheck는 인프라 전용 package라 SKIP, gitleaks 미설치로 SKIP |
| Design implementation gap reviewed | PASS | 아래 Gap Table 8/8 Matched, 100% |

## Gap Table

| Plan/Design Item | Implementation Evidence | Result |
| --- | --- | --- |
| Promtail → Alloy | `infra/1-infra-graph-rag/docker-compose.yml`, `monitoring/alloy/config.alloy` | Matched |
| Docker metadata labels | `config.alloy`의 discovery/relabel/process pipeline | Matched |
| Neo4j/PostgreSQL 수집 | Loki API의 `service=neo4j`, `service=postgres` 응답 | Matched |
| Loki persistence | `loki_data` volume 및 TSDB v13 filesystem config | Matched |
| Alloy persistence | `alloy_data:/var/lib/alloy/data` | Matched |
| Dashboard migration | `neo4j-logs-dashboard.json`의 서비스 selector | Matched |
| Lifecycle scripts | infra `package.json`의 Alloy 기반 scripts | Matched |
| Documentation | infra README 및 `docs/1-infra-l1-setup.md` | Matched |

Overall Match Rate: 100% (8 / 8)

## E2E Results

| Scenario | Tool | Result | Evidence |
| --- | --- | --- | --- |
| 전체 스택 기동, Promtail 부재 | Docker Compose CLI | PASS | `docker-compose ps`; Alloy/Loki/DB/Grafana Up, Promtail 없음 |
| Neo4j/PostgreSQL 서비스별 로그 조회 | Loki HTTP API | PASS | 두 LogQL query가 각각 stream 반환 |
| Loki/Alloy 재생성 후 영속성 | Docker Compose CLI + Loki API | PASS | force recreate 이후 기존 Neo4j timestamp 로그 반환 |
| Grafana provisioning/대시보드 구성 | JSON parser + config inspection | PASS | JSON PASS, datasource URL 및 selector 일치 |
| 구현과 문서 계약 일치 | `rg` + manual comparison | PASS | 활성 Promtail 참조 없음, 명령/서비스/흐름 일치 |

## Skill Usage Log

- `apb-pgv`: Plan → Gradate → Validate 상태 및 산출물 생성
- `apb-static-analysis`: Compose/JSON 정적 검사와 도구 탐지 수행
- `apb-gap-analysis`: 설계 항목 8개와 구현 비교, match rate 100%
- `apb-validation-report`: 체크리스트, E2E 결과, 갭 및 verdict 작성

## Action Items

- 없음

## Verdict

PASS — 9개 Validation 항목과 5개 E2E 시나리오가 모두 통과했고 설계-구현 일치율은 100%다.
