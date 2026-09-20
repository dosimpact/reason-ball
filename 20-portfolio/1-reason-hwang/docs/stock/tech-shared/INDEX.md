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
│   └── 3-langgraph-db-saver.md
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
| `1-fe-host` | [Storybook](1-fe-host/storybook.md) | UI 예제, 구성, 검증 |
| `2-bff-apps` | [BFF 문서 지도](2-bff-apps/INDEX.md) | 디렉터리 정책·SSE·API·Swagger 안내 |
| `3-langgraph-fast` | [DB saver](3-langgraph-fast/3-langgraph-db-saver.md) | PostgreSQL saver와 체크포인트 설계 |
| `infra/1-infra-graph-rag` | [Infra setup](infra/1-infra-graph-rag/1-infra-l1-setup.md) | Graph RAG 데이터베이스와 관측 환경 |
| `infra/2-codex-oauth-proxy` | [OAuth proxy](infra/2-codex-oauth-proxy/1-infra-l2-codex-proxy.md) | OAuth 인증 프록시 구조와 사용법 |

## 원본 보존 및 과거 경로 해석

기존 `master-docs/`의 5개 Markdown과 이미지 1개는 내용·파일명 변경 없이 위 위치로 이동했다. 디렉터리 재배치는 내용의 최신성 검증이나 기술 결정 변경을 의미하지 않는다. 원문 안의 과거 경로, 명령, 이력 설명도 그대로 보존한다.

- 과거 `docs/stock/shared/<file>`은 `docs/stock/tech-shared/<file>`로 해석한다. 단, `storybook.md`는 `tech-shared/1-fe-host/storybook.md`에 있다.
- 인프라 setup 원문에 남아 있는 `docs/stock/shared/system-design.md`는 현재 [공통 시스템 설계](system-design.md)를 가리킨다.
- 원문에 들어 있는 실행 명령과 코드 경로는 문서의 새 디렉터리가 아니라 원래 해당 패키지/워크스페이스 기준으로 읽는다.
- 기존 flow는 당시 경로와 본문을 보존한다. 이전 경로와 현재 경로는 [이동 기록](../../flow/2026-09-20-tech-shared-document-relocation.md)에서 대응시킨다.
- 구현과 원문이 다르면 현재 공용/도메인 설계와 코드를 확인한다. 원문을 수정해야 하는 후속 작업은 별도 변경으로 기록한다.
