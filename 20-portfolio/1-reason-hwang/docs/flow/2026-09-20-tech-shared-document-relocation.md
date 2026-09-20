# Tech-shared 문서 재배치

- Date: 2026-09-20
- Domain: shared / tech-shared documentation
- Decision: DOC-SCOPE-002
- Context: 공통 비즈니스·기술 결정과 패키지별 구체 기술 문서를 두 범위로 분리하고, master-docs 내용을 변경 없이 docs 안으로 통합해 달라는 요청.
- Change:
  - `docs/stock/shared/`를 `docs/stock/tech-shared/`로 변경.
  - 공용 문서는 tech-shared 루트, 구체 기술 문서는 패키지별 하위 디렉터리에 배치.
  - master-docs의 Markdown 5개와 PNG 1개를 파일명 및 bytes 변경 없이 이동.
  - 기존 Storybook stock을 `tech-shared/1-fe-host/storybook.md`로 옮기고 상대 링크 깊이만 보정.
  - 현재 문서 지도·workspace 정책·도메인 안내·검증 안내의 shared 경로를 새 경로로 갱신.
- Rationale: 공통 결정과 구체 구현 설명의 읽기 범위를 구분하고 기술 문서의 위치를 한 곳에서 탐색하도록 함.
- Affected stock:
  - [Tech-shared 지도 및 DOC-SCOPE-002](../stock/tech-shared/README.md)
  - [Workspace 문서 탐색 정책](../stock/tech-shared/workspace.md)
  - [공통 시스템 설계](../stock/tech-shared/system-design.md)
  - [Host Storybook](../stock/tech-shared/1-fe-host/storybook.md)
  - [SEC 도메인 안내](../stock/us-corporate-filings/README.md)
  - [DCF 도메인 안내](../stock/index-dcf-visualizer/README.md)

## 경로 및 원문 무결성

| 이전 경로 | 현재 경로 | 이동 전 SHA-256 |
| --- | --- | --- |
| `master-docs/1-infra-l1-setup.md` | [`docs/stock/tech-shared/infra/1-infra-graph-rag/1-infra-l1-setup.md`](../stock/tech-shared/infra/1-infra-graph-rag/1-infra-l1-setup.md) | `49df1b547511ed0fa23af3844b7e76c85a24c750b3f9b6be9f08fcbf82296f1e` |
| `master-docs/1-infra-l2-codex-proxy.md` | [`docs/stock/tech-shared/infra/2-codex-oauth-proxy/1-infra-l2-codex-proxy.md`](../stock/tech-shared/infra/2-codex-oauth-proxy/1-infra-l2-codex-proxy.md) | `138bcc353f84a22577080d83b970220589722da761dde34fc026a66f4f76759f` |
| `master-docs/2-frontend-side-architecture.md` | [`docs/stock/tech-shared/1-fe-host/2-frontend-side-architecture.md`](../stock/tech-shared/1-fe-host/2-frontend-side-architecture.md) | `983e4af9f7816035cee1e8136dc5f6d8d9185b8ce67e11ae978ab49e11eb7d74` |
| `master-docs/2-bff-apps/swagger-module.md` | [`docs/stock/tech-shared/2-bff-apps/swagger-module.md`](../stock/tech-shared/2-bff-apps/swagger-module.md) | `f86d62e554c3c9045aca4c046808a056e99b6f99cc8834ecc5dee70266cdba5a` |
| `master-docs/3-langgraph-db-saver.md` | [`docs/stock/tech-shared/3-langgraph-fast/3-langgraph-db-saver.md`](../stock/tech-shared/3-langgraph-fast/3-langgraph-db-saver.md) | `8db5fe73c9d5e245bbb3a5688811d1fd298a75ecfaae3fb6c4e88c25782e4bb4` |
| `master-docs/overall-architecture.excalidraw.png` | [`docs/stock/tech-shared/overall-architecture.excalidraw.png`](../stock/tech-shared/overall-architecture.excalidraw.png) | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |

공통 stock의 `design-principles.md`, `system-design.md`, `test-design.md`, `workspace.md`는 `shared/`에서 `tech-shared/`로 같은 이름으로 이동했다. `shared/storybook.md`는 `tech-shared/1-fe-host/storybook.md`로 이동했다.

## 보존 정책과 검증

- PASS: master-docs 6개 파일의 이동 전후 SHA-256이 모두 일치한다. PNG는 이동 전부터 0 bytes였으며 복구/재생성하지 않았다.
- 기존 flow 문서는 append-only 규칙에 따라 수정하지 않는다. 따라서 역사적 shared/master-docs 경로와 이전 stock 링크는 이 기록의 대응표로 해석한다.
- 원본 보존 대상인 infra setup의 `docs/stock/shared/system-design.md` 문자열도 그대로 둔다. 현재 대상은 [tech-shared 시스템 설계](../stock/tech-shared/system-design.md)이다.
- PASS: 현재 안내·stock·새 flow에서 상대 파일 링크 84개가 모두 존재한다.
- PASS: 이전 경로는 원본 보존 문서와 역사적 경로를 설명하는 안내에만 남아 있다. 기존 flow의 tracked diff는 없다.
- PASS: 이동 파일 목록과 `git diff --check` 확인. 비워진 `master-docs/`와 이전 `docs/stock/shared/` 디렉터리는 더 이상 존재하지 않는다.
- 문서 재배치만 수행하므로 API/Storybook/브라우저 런타임 검증은 적용 대상이 아니다.
- 내용 변경 없이 이동한 원문과 기존 flow를 제외한 현재 안내 문서에는 새로운 경로를 사용한다.
