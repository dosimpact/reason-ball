# Documentation Map

이 프로젝트의 현재 상태는 `docs/stock/`에서 확인한다. 문서는 공용 결정 → 패키지 기술 → 도메인 규칙 순서로 읽는다. 과거 변경 기록은 Git 이력으로 조회하며 현재 설계를 재구성하기 위해 날짜별 기록을 읽을 필요가 없다.

## 읽기 순서

1. [공통 문서 지도](stock/tech-shared/INDEX.md)와 [설계 원칙](stock/tech-shared/design-principles.md).
2. 대상 패키지의 기술 문서와 관련 도메인 설계.
3. [검증 원칙](validation/INDEX.md) 및 문서의 현재 제약·검증 범위.
4. 불명확한 계약은 해당 구현·테스트와 대조한다.

## 공용·패키지 문서

| 범위 | 진입점 |
| --- | --- |
| 워크스페이스·명령·포트·기본 서비스 | [Workspace](stock/tech-shared/workspace.md) |
| 전체 서비스·저장소 경계 | [System design](stock/tech-shared/system-design.md) |
| 코드 작성 원칙 | [Design principles](stock/tech-shared/design-principles.md) |
| 검증 범위·증거·자원 정리 | [Test design](stock/tech-shared/test-design.md), [검증 절차](validation/INDEX.md) |
| 프런트엔드 | [Host architecture](stock/tech-shared/1-fe-host/2-frontend-side-architecture.md) |
| OpenUI 공통 계약 | [OpenUI](stock/tech-shared/openui-migration.md) |
| BFF | [BFF INDEX](stock/tech-shared/2-bff-apps/INDEX.md) |
| FastAPI·LangGraph | [LangGraph INDEX](stock/tech-shared/3-langgraph-fast/INDEX.md) |
| DB·모니터링 | [Infrastructure](stock/tech-shared/infra/1-infra-graph-rag/1-infra-l1-setup.md) |
| OAuth proxy | [OAuth proxy](stock/tech-shared/infra/2-codex-oauth-proxy/1-infra-l2-codex-proxy.md) |

## 도메인 문서

| 기능 | 진입점 |
| --- | --- |
| SEC 수집·모델링·분석 | [US corporate filings INDEX](stock/us-corporate-filings/INDEX.md) |
| 기술적 분석·Canvas·TA-Lib | [Technical analysis INDEX](stock/technical-analysis/INDEX.md) |
| DART 수동 API 검사 | [DART INDEX](stock/dart-api-testing/INDEX.md) |
| Index DCF | [Index DCF INDEX](stock/index-dcf-visualizer/INDEX.md) |
| 신규 설계 문서 | [Business template](stock/template/business-design.template.md), [System template](stock/template/system-design.template.md) |

## 문서 관리

### DOC-STOCK-001: 현재 상태 중심 문서

현재 구현·계약·운영 명령·제약·미해결 사항은 관련 stock에 직접 동기화한다. 중간 시도·재시작 PID·과거 커밋별 테스트 개수·폐기된 계획을 현재 설계에 누적하지 않는다. 검증 결과는 재현 명령과 실제 범위·남은 제한을 간결하게 유지한다. 변경 이유와 이전 내용은 Git commit/diff에서 확인한다.

`docs/flow/`의 과거 문서·일시적 증거 파일은 최신 stock 반영 후 정리했다. 스쿼시는 Git commit 하나로 삭제·통합하는 작업이며 브랜치 과거 이력을 rewrite하지 않는다. 이전 문서가 필요하면 현재 정리 커밋의 부모에서 `git show <commit>^:20-portfolio/1-reason-hwang/docs/flow/<파일>`로 읽는다. 보호된 human-docs의 과거 링크는 원문을 유지하므로 Git 이력을 통해 확인한다.

공통 결정은 `stock/tech-shared/` 상위에, 구현은 패키지 아래에, 업무 규칙은 도메인 아래에 둔다. INDEX는 탐색만 담당하고 상세 계약을 복제하지 않는다. `master-docs/`, `stock/shared/`는 현재 진입점이 아니다. 실제 INDEX 경로로 링크한다. human-docs는 별도 사용자 원문이므로 최신 canonical 계약은 stock에서 확인한다.

## 참고 자료

- [Canvas A–Z 온보딩 HTML](human-docs/3.dynamic-canvas-openui/canvas-system-onboarding-runbook.html): 사용자 실습·코드 지도·운영 설명. 계약 원본은 기술적 분석 stock이다.
- [프로젝트 README](../README.md): 설치 및 도구 연결.
