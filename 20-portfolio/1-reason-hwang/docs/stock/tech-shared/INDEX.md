# Tech-shared 문서 지도

## DOC-SCOPE-002: 공용과 구체의 두 가지 범위

`tech-shared/`는 여러 도메인이 공유하는 비즈니스·기술 결정과 패키지별 상세 기술 문서를 관리한다. 상위 문서는 공통 원칙과 계약을, 하위 문서는 해당 패키지의 구현 방식과 운영 방법을 설명한다.

- **공용**: 이 디렉터리 바로 아래에 워크스페이스, 시스템 전체 구조, 공통 설계·검증 원칙을 둔다. 여러 패키지에 영향을 주는 결정을 여기에 기록한다.
- **구체**: `1-fe-host/`, `2-bff-apps/`, `3-langgraph-fast/`, `infra/<package>/`에 각 패키지의 기술 설명을 둔다. 공통 원칙을 복사하지 않고 필요한 상위 문서를 참조한다.

SEC 공시나 DCF처럼 특정 도메인의 비즈니스 규칙은 기존 `../us-corporate-filings/`, `../index-dcf-visualizer/`가 소유한다. `tech-shared`는 이 도메인 경계를 대체하지 않는다.

```text
tech-shared/
├── INDEX.md
├── workspace.md
├── system-design.md
├── design-principles.md
├── test-design.md
├── overall-architecture.excalidraw.png
├── 1-fe-host/
│   ├── 2-frontend-side-architecture.md
│   └── storybook.md
├── 2-bff-apps/
│   └── swagger-module.md
├── 3-langgraph-fast/
│   ├── INDEX.md
│   ├── 3-langgraph-db-saver.md
│   └── 4-graph-db.md
└── infra/
    ├── 1-infra-graph-rag/
    │   └── 1-infra-l1-setup.md
    └── 2-codex-oauth-proxy/
        └── 1-infra-l2-codex-proxy.md
```

## 공용 문서

| 문서 | 책임 |
| --- | --- |
| [Workspace](workspace.md) | 패키지 구성, 명령, 기본 포트, 문서 탐색 정책 |
| [System design](system-design.md) | 전체 런타임 구조와 패키지 간 계약 |
| [Design principles](design-principles.md) | 공통 구현 원칙과 SLAP |
| [Test design](test-design.md) | 공통 검증 정책과 패키지별 검증 안내 |
| [전체 구조 이미지 원본](overall-architecture.excalidraw.png) | 기존 파일 보존. 이동 전부터 0-byte 파일이므로 표시 가능한 이미지가 아님 |

## 패키지별 구체 문서

| 소유 범위 | 문서 | 설명 |
| --- | --- | --- |
| `1-fe-host` | [Frontend architecture](1-fe-host/2-frontend-side-architecture.md) | Host·Remote·BFF 프런트 전달 구조. 관련 BFF도 같은 문서를 참조 |
| `1-fe-host` | [OpenUI 사용 사례·코드 안내](1-fe-host/sec-intelligent-ui.md#openui-doc-001-사용-사례와-코드-안내) | SEC Chat의 Renderer와 관리자 AgentInterface 비교, 코드 경로와 생성물 동기화 |
| `1-fe-host` | [Storybook](1-fe-host/storybook.md) | UI 예제, 구성, 검증 |
| `1-fe-host` | [Generative UI Host](1-fe-host/open-ui.md) | 공유 카탈로그, OpenUI 렌더링과 검증 |
| `2-bff-apps` | [BFF 문서 지도](2-bff-apps/INDEX.md) | 디렉터리 정책·SSE·API·Swagger 안내 |
| `3-langgraph-fast` | [문서 지도](3-langgraph-fast/INDEX.md) | PostgreSQL saver와 Neo4j Graph DB 설계·운영 |
| `infra/1-infra-graph-rag` | [Infra setup](infra/1-infra-graph-rag/1-infra-l1-setup.md) | Graph RAG 데이터베이스와 관측 환경 |
| `infra/2-codex-oauth-proxy` | [OAuth proxy](infra/2-codex-oauth-proxy/1-infra-l2-codex-proxy.md) | OAuth 인증 프록시 구조와 사용법 |

## 현재 문서와 과거 이력

현재 계약은 위 공통·패키지 문서와 도메인 stock을 따른다. 과거 master-docs, stock/shared, 이전 UI 프로토콜 명칭은 Git 이력의 문맥으로만 해석한다. 현재 계약을 확인하려고 역사 문서의 상충하는 설명을 조합하지 않는다.

[문서 관리 기준](../../INDEX.md#doc-stock-001-현재-상태-중심-문서)에 따라 현재 제약·검증 범위는 stock에 유지하고 과거 변경 과정은 Git으로 조회한다.

- [OpenUI 공통 설계](openui-migration.md)
- [SEC 도메인 지도](../us-corporate-filings/INDEX.md)
- [기술적 분석 지도](../technical-analysis/INDEX.md)
