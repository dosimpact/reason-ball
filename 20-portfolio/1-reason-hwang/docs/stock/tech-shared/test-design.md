# Test and Validation Design

## 변경 유형과 완료 기준

검증 절차의 원본은 [validation INDEX](../../validation/INDEX.md)다. 서버 API 변경은 Bruno(VAL-API-001), 순수 View 변경은 Storybook(VAL-VIEW-001), 업무 동작 변경은 MCP 사용자 브라우저 검증(VAL-BROWSER-001)을 적용한다. 타입·lint·단위·CLI E2E가 이를 대체하지 않는다. 문서만 변경하면 구조·링크·diff를 확인한다.

현재 stock의 검증 절에는 재현 명령, 실제 검증 범위와 미해결 제한을 유지한다. fixture·실모델·실서비스·브라우저 결과를 구별한다. 실행하지 못한 검증을 통과로 표현하지 않는다. 과거 실행 과정과 일시적 PID·포트 목록은 Git 이력에 둔다.

## 자원과 데이터

[VAL-CLEANUP-001](../../validation/INDEX.md#val-cleanup-001): 작업이 생성한 서버·브라우저·CDP 연결·임시 데이터만 소유권을 확인해 종료한다. 사용자 브라우저·공유 MCP·DB 볼륨은 보존한다. 정상 종료 뒤 자식 프로세스와 포트를 확인하고 미정리 자원이 있으면 기능 성공과 별도로 보고한다.

PostgreSQL·Neo4j 통합 테스트는 문서화된 opt-in과 격리 데이터베이스를 사용한다. 실제 사용자 DB 초기화나 장애 실험은 일반 검증에 포함하지 않는다. 자격 증명과 OAuth 토큰을 로그·문서에 저장하지 않는다.

## 커밋된 명령

프로젝트 루트에서 실행한다. 각 package.json이 실제 script 존재 여부의 기준이다.

| 범위 | 명령 / 방법 |
| --- | --- |
| Host 타입·규칙 | `pnpm -C 1-fe-host typecheck`, `pnpm -C 1-fe-host lint` (ESLint+Steiger) |
| Host UI 예제·순수 로직 | `pnpm -C 1-fe-host exec vitest run --project=generative-ui` |
| Host View | `pnpm -C 1-fe-host exec vitest run --project=storybook <대상 story>` |
| Host E2E | `pnpm -C 1-fe-host test:e2e <대상 spec>` 및 Playwright MCP |
| OpenUI 생성물 | `pnpm -C 1-fe-host sec-ui:generate`, `pnpm -C 1-fe-host openui:check` |
| BFF 단위·API | `pnpm -C 2-bff-apps test`, `test:modeling:e2e`, 커밋된 Bruno collection |
| Python | `pnpm -C 3-langgraph-fast test`, `test:technical-analysis`, `test:sec-modeling`, `test:talib-agent` |
| API collection | 각 패키지의 `pnpm bruno` 또는 `pnpm exec bru run ...` |
| Proxy | `pnpm -C infra/2-codex-oauth-proxy test:unit`, `test:api` |
| Infra | `pnpm -C infra/1-infra-graph-rag infra:config`, `infra:ps` |

구버전 문서의 Host `test:chat`, `test:generative-ui`, `test:sec-modeling:views` 같은 별칭을 script 존재 확인 없이 실행하지 않는다. 현재 Host는 Vitest project와 Playwright runner로 필요한 파일을 선택한다. Bruno environment의 과거 포트를 그대로 사용하지 말고 소유한 서버 주소를 명시적으로 전달한다.

## 서버·저장소 검증 범위

FastAPI는 [runtime 계약](3-langgraph-fast/fastapi-runtime.md)과 [multiworker 검증](3-langgraph-fast/multiworker-validation.md)을 따른다. 실제 그래프/checkpointer와 SDK 메시지·상태 복원을 검증해야 영속성 검증으로 인정한다. DB multiworker는 실제 PostgreSQL 및 독립 OS 프로세스2개를 사용하고 lease·fencing·전역 순서·취소·장애·복구를 확인한다. 메모리 saver·동일 프로세스 task만으로 대신하지 않는다.

SEC 모델링은 [도메인 인수 기준](../us-corporate-filings/sec-modeling.md)을 따른다. 작업 제어 HTTP와 실제 공시 품질·검색 성능을 구분한다. subset의 검색 성공이나 세 fixture 공시를 전체 모집단 품질로 확대 해석하지 않는다. 실제 LLM/embedding/Neo4j를 사용하는 검증 스크립트는 비용·쓰기 범위를 확인해 실행한다.

## 관측과 도구

MCP 연결은 [README](../../../README.md#검증용-mcp-설치-및-연결)에 안내한다. 도구 등록·설치 smoke는 기능 검증이 아니다. Storybook MCP는 소유한 Storybook 서버가 필요하다. 도구 호스트가 관리하는 공유 브라우저를 이름 기반으로 일괄 종료하지 않는다.

Infra 변경은 Compose config/서비스 상태 후 Loki ready, Prometheus targets, DB exporter, Grafana datasource를 확인한다. 실제 포트는 [workspace](workspace.md)의 로컬 프로필을 따른다. Proxy 인증 재로드 회귀는 `PYTHONPATH=. uv run python api-test/check-auth-reload.py`로 격리 인증 파일과 소유 서버만 사용하며 live 모델·사용자 토큰 검증과 구분한다.
