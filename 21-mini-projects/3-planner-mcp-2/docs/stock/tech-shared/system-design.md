# 시스템 설계

상태: 핵심 구현 기준. 기술 스택의 초기 기준은 [원본 요구사항](../../../master-requirement.md)의 기본 기술 스택을 참조합니다.

## 실행 구성과 모듈 경계

DEC-001 — 다음 5개 도메인 기능으로 구분합니다. 이는 기능별 책임 구분이며 별도 서버나 패키지 분리를 의미하지 않습니다.

| 도메인 기능 | 식별자 | 책임 |
| --- | --- | --- |
| 프로젝트 관리 | `project-management` | 프로젝트 CRUD, 설계·구현·검증 흐름과 노드 관리 |
| 템플릿 관리 | `template-management` | 문서 양식, 기본 체크리스트, 예시, AI 작성 지침 관리·조회 |
| 문서 관리 | `document-management` | 템플릿 인스턴스 생성, 본문 편집, index·부모·자식 관계, Overview 관리 |
| 진행·검증 관리 | `progress-verification` | 정형 체크리스트, AI 검증 결과, 사람 확인 상태, 선택적 reopen 관리 |
| AI 작업 안내 | `ai-workflow` | 작업 규칙, 문서 탐색 방법, 구현·검증 절차 제공 |

- [프로젝트 관리](../project-management/INDEX.md)
- [템플릿 관리](../template-management/INDEX.md)
- [문서 관리](../document-management/INDEX.md)
- [진행·검증 관리](../progress-verification/INDEX.md)
- [AI 작업 안내](../ai-workflow/INDEX.md)

문서 관리는 내용과 문서 관계를, 진행·검증 관리는 공용부의 상태와 체크리스트를 담당합니다. 검증 결과 자식 문서의 생성·본문 갱신은 문서 관리에 속합니다. 템플릿별 작성 지침은 템플릿 관리, 전체 작업 절차는 AI 작업 안내에서 관리합니다.

AI 작업 안내는 MCP로 규칙을 제공하며 AI 실행은 연결된 Codex CLI에서 수행합니다.

## 데이터 모델과 저장

현재 구현: Node.js 24 내장 SQLite, 단일 Next.js 서버. 프로젝트, 템플릿, 문서, 체크리스트, 노드를 저장합니다. 외래키·트랜잭션으로 소속 관계를 보장합니다. 문서 revision으로 오래된 수정은 409를 반환합니다. 템플릿은 생성 시 복사하며 후속 변경은 인스턴스에 전파하지 않습니다.

체크리스트는 고유 ID, 설명, AI 결과, 사람 확인을 별도 필드로 저장합니다. MCP는 사람 확인을 완료할 수 없으며, reopen은 지정 항목의 AI 결과와 사람 확인을 초기화합니다. 검증 결과는 부모별 하나의 자식 문서를 갱신합니다.

## REST API·MCP 계약

현재 구현: 공통 서비스에 REST `/api/projects`, `/api/templates`, `/api/documents`, 문서별 체크리스트·reopen·verification, 프로젝트별 nodes를 연결합니다. MCP `/mcp`는 stateless Streamable HTTP이며 같은 검증·저장 함수를 사용합니다. `/api/events` SSE로 UI에 변경을 알립니다. 입력은 Zod strict 스키마로 검증하며 오류는 400/403/404/409로 구분합니다.

도구 그룹: 프로젝트 CRUD, 템플릿 조회, 문서 CRUD·탐색, 체크리스트 관리·AI 결과·reopen, 흐름 노드 CRUD, 작업 규칙 조회. 사람 확인은 REST/UI 전용입니다.

## 화면 구성과 데이터 흐름

현재 구현: 왼쪽 프로젝트 목록, 가운데 단계 흐름, 오른쪽 문서·정형 체크리스트. 템플릿 관리 화면은 양식·예시·AI 지침·기본 체크리스트를 편집합니다. Markdown/Mermaid를 렌더링하고 Overview는 들여쓰기 트리에서 What·How 및 검증 문서 연결을 표시합니다.

## 상세 계약과 구현 기본값

- [MCP·REST 계약](interfaces.md)
- [실행 기준](planner-mcp-2/implementation.md)
- 검증 단계는 설계-검증 문서의 동일 인스턴스를 조회합니다. 검증 결과는 연결된 자식 문서입니다.
- React Flow는 요구사항의 라이브러리 계열인 공식 `@xyflow/react` 패키지를 사용합니다. 참조 저장소는 xyflow의 이전 포크이며 원본 요구사항은 변경하지 않았습니다. [공식 설치 안내](https://reactflow.dev/learn), [참조 저장소](https://github.com/evidenceprime/react-flow).

## 접속 주소

기본 실행은 0.0.0.0:4000이며 외부 주소 http://dodonet.iptime.org:14000 을 PLANNER_ALLOWED_ORIGINS로 허용합니다. 동일 출처 검사는 유지합니다.

## 작업 공간 UI 피드백 반영

- canvas-panel과 detail-panel은 shadcn/ui Resizable의 공용 wrapper로 구성합니다. react-resizable-panels 4 기반이며 기존 CSS 테마에 맞춰 수동 설치했습니다. 데스크톱 기본 비율은 42.5:57.5, 최소 너비는 300px/340px이며 드래그와 방향키로 조절합니다.
- 1000px 이하에서는 기존 세로 배치로 표시하고 크기 조절 핸들을 숨깁니다. 화면 전환 시 편집 중인 문서 컴포넌트를 유지합니다.
- app은 100dvh이며 상단 바를 제외한 shell 높이를 채웁니다. sidebar-content와 main은 각자 스크롤합니다. 600px 이하에서는 sidebar를 상단 26dvh 영역에 배치합니다.
- React Flow 노드는 border-radius 22px의 둥근 카드이며 선택 시 강조 색을 적용합니다.
- 템플릿 미리보기는 버튼으로 여는 shadcn/Radix Dialog입니다. 본문과 작성 예시를 표시하며 닫기·Esc·배경 클릭으로 닫고 열기 버튼에 포커스를 돌려줍니다.
- 공용 컴포넌트: src/shared/ui/resizable.tsx. shadcn 원본의 MIT 라이선스를 함께 보존합니다. [공식 컴포넌트](https://ui.shadcn.com/docs/components/base/resizable).

## MCP 도구 자동 안내 (REQ-010)

- `/mcp-guide`는 동적 서버 페이지이며 `getMcpCatalog`가 실제 `createMcpServer`에 SDK InMemoryTransport로 연결하여 모든 `tools/list` 페이지를 수집합니다. 도구를 실행하지 않으며 연결은 조회 후 닫습니다. 서버 등록 코드가 단일 원본입니다.
- 화면에는 도구 검색·설명·파라미터 필수 여부·전체 입력 JSON Schema를 표시합니다. 출력 스키마가 등록된 경우 함께 표시합니다. 새 배포의 정의는 페이지 재조회 시 반영됩니다.
- sidebar는 스크롤되는 sidebar-content와 고정 sidebar-footer로 나누어 하단 안내 링크를 유지합니다. 기존 프로젝트 목록과 main의 스크롤은 독립적입니다.

## 가로 흐름과 노드 좌표

- 저장 좌표가 없는 노드는 순서대로 `(30 + index * 240, 80)`에 배치합니다. 좌측 입력·우측 출력 핸들과 화살표로 흐름을 표시합니다.
- 드래그 중 로컬 coordinates를 우선하고 드롭 시 기존 노드 PATCH로 저장합니다. 저장 중 재드래그는 막고, 실패 시 오류 표시 후 서버 좌표로 복원합니다.
- 노드 JSON의 선택 필드 coordinates `{x,y}`는 유한 숫자입니다. 기존 position은 정렬 순서이며 좌표와 독립적입니다. 기존 데이터는 마이그레이션 없이 가로 배치됩니다.

## 상세 패널 표시 제어

- WorkspacePanels 내부 표시 상태로 상세 패널·핸들을 숨기고 캔버스를 전체 너비로 확장합니다. 상세 컴포넌트를 유지하여 편집 초안과 기존 패널 비율을 보존합니다.
- 닫기 후 열기 버튼, 다시 열기 후 닫기 버튼으로 포커스를 이동합니다. 모바일 세로 배치에서도 닫기·열기를 제공합니다. 새로고침 시 기본값은 상세 패널 표시입니다.

- index 진행 체크리스트는 이름 있는 section에 목록·추가/편집을 포함하며 index-progress-section 스타일로 강조합니다. 문서 본문·미리보기와 하위 문서 카탈로그는 섹션 밖에 배치합니다.

## Frontend UX와 공용 UI

- [디자인 시스템](design-system.md)의 CSS 토큰으로 GitHub light 계열 테마를 정의합니다. shadcn 공식 수동 설치 기반 Button/Input/Textarea/Badge/Card/Dialog/Tabs/DropdownMenu와 기존 Resizable을 사용합니다. Radix가 모달 포커스·키보드·메뉴를 담당합니다.
- `create-document-dialog.tsx`는 parentId/phase를 현재 문서에서 가져와 REST 생성 후 새 문서로 이동합니다. 별도 서버 계약 변경은 없습니다.
- Workspace는 프로젝트/문서 검색, 단계 탭, 계층 카탈로그, 미저장 이동 확인을 조합합니다. index 하위 문서 목록을 편집 영역보다 먼저 표시합니다.
- WorkspacePanels의 revealKey로 다른 문서 선택 시 닫힌 상세 패널을 다시 표시합니다. 기존 초안·패널 비율 보존 동작을 유지합니다.

## 화면 URL

- 작업 공간 `/`, 템플릿 관리 `/templates`, AI 작업 안내 `/ai-workflow`, MCP 도구 안내 `/mcp-guide`.
- 공통 root layout에 Workspace shell을 두고 `usePathname`으로 화면·메뉴 활성 상태를 결정합니다. 페이지 이동 중 프로젝트 선택은 유지하며 `/projects/:projectId`에서 새로고침하면 URL의 프로젝트를 복원합니다.
- 메뉴는 Next Link를 사용합니다. 직접 접속·새로고침·뒤로/앞으로 가기를 지원하며 메뉴/로고 이동 시 미저장 변경 확인을 유지합니다.

## 단계별 문서 트리

- `document-flow.ts`가 단계 노드와 문서 parentId를 React Flow 문서 노드·연결선으로 투영합니다. index는 별도 문서 노드로 중복 표시하지 않습니다.
- 문서 배치는 단계 좌표 기준으로 계산하고 읽기·선택용으로 제공합니다. 단계 드래그 저장 계약은 유지합니다.
- `FitDocumentFlow`는 노드 측정 완료 및 연결 구조 변경 시 화면 범위를 맞춥니다. 문서 편집이나 선택만으로 배치를 다시 초기화하지 않습니다.

## 전용 검증 양식 초기화

- `verification-templates.ts`에 View/API/E2E 전용 양식 3개를 정의합니다. 저장소의 버전 키로 1회 추가하며 동일 이름은 INSERT OR IGNORE로 보존합니다.
- 기존 공통 양식과 문서 templateSnapshot은 수정하지 않습니다. 이후 수정·삭제는 일반 템플릿 관리와 동일하게 영속 유지합니다.

## 문서·템플릿 확장 (REQ-012)

- `entities/planner/extensions.ts`가 React Flow 다이어그램의 정형 데이터·상한·참조 검증을 정의합니다. JSON 본문 필드로 저장해 테이블 마이그레이션은 필요하지 않습니다.
- `document-extensions.tsx`는 템플릿/문서 편집과 읽기 전용 미리보기에 공용으로 사용합니다. 노드·연결 폼, 드래그 및 연결점 편집을 제공하며 문서/템플릿 저장으로 확정합니다.
- 기존 문서 생성·수정 MCP/REST 계약에 선택 extensions를 추가합니다. 템플릿 초기값 복사, 기존 문서 snapshot 불변, revision 충돌 및 reopen 규칙을 적용합니다.

## 프로젝트 선택 URL

- `/projects/[projectId]` 경로를 추가하고 pathname의 ID로 Workspace 선택을 동기화합니다. 기존 stale-response guard와 index 자동 선택을 재사용합니다.
- 템플릿·안내 화면으로 이동 중 선택은 유지하며 작업 공간 링크는 선택 프로젝트 URL로 돌아갑니다. 로고는 `/`로 이동해 선택을 해제합니다.
- 프로젝트 생성은 새 프로젝트 URL로 이동, 삭제·존재하지 않는 ID는 루트로 복귀. 개별 문서 permalink는 범위 밖입니다.

## Notion 스타일 Markdown 편집

- Tiptap 3의 StarterKit·Markdown·TableKit·TaskList·Image·Placeholder를 사용한 공용 `MarkdownEditor`를 문서/템플릿 편집에 적용합니다. 서버 렌더링에서는 `immediatelyRender: false`로 편집기 생성을 지연합니다.
- UI만 서식 편집으로 바꾸고 기존 Markdown 문자열 API/SQLite/MCP 계약은 유지합니다. 원문/미리보기 모드 전환만으로는 값을 직렬화하거나 dirty로 만들지 않습니다.
- 외부 SSE/새 문서 로딩은 emitUpdate:false로 반영하며 자체 변경의 되먹임을 피합니다. 상위 문서 편집기의 revision 충돌·초안 보존 정책을 재사용합니다.
- HTML·각주·참조 정의·front matter 등 서식 변환 대상 밖의 Markdown은 원문 편집으로 보존합니다. 코드 펜스 내부 JSX/HTML은 이 감지에서 제외합니다.
- `/` 메뉴는 필터·방향키·Enter/Esc, 목록은 →/Tab 들여쓰기 및 ←/Shift+Tab 내어쓰기를 지원합니다. 들여쓰기 불가능한 위치의 버튼은 비활성화합니다.

- 편집기 번들: `config/editor-modules.ts`의 ProseMirror model/view 경로를 Next Turbopack과 Storybook Vite에서 공유하여 클래스 중복 로딩을 방지합니다.

## CodeWeave core (CW-02)

`src/modules/codeweave/core`는 framework-free TypeScript 라이브러리다. Next.js는 공개 API 소비자가 되며 향후 npm 패키지로 이동한다. 파싱·진단, Tree View 표시 데이터, 라인 조회·검색, 충돌 검출 수정만 core에서 담당한다. UI·저장·MCP 전송은 아직 연결하지 않았다. [문법·공개 API·범위](../codeweave/INDEX.md).

## CodeWeave 확장 통합

공개 core API를 `entities/planner/extensions.ts`의 저장 검증, `widgets/workspace/codeweave-extension.tsx`의 트리/원문 UI, `app/server/codeweave.ts`의 REST/MCP 어댑터에서 공유합니다. source만 저장하고 AST는 컴파일합니다. 기존 JSON 확장 저장을 재사용하여 SQLite 스키마 변경은 없습니다. Next는 build:codeweave 산출물을 사용하며 상세 계약은 [CodeWeave](../codeweave/INDEX.md)에 있습니다.

- React Flow의 controlled node 객체는 공용 `useFlowMeasurements`가 수집한 measured 값을 유지합니다. 단계/문서/첨부 노드의 재렌더링 시 크기 초기화로 비표시되는 문제를 방지하며, 측정치는 UI 메모리에만 둡니다.
