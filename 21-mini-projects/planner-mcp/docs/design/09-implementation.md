# 구현 기본값과 코드 연결

상태: 구현됨. 사용자 요구사항을 실행하기 위한 기본값이며 별도 요청 시 변경할 수 있습니다.

개인 로컬 운영·인계 묶음 선택·외부 쓰기 제한은 구현 기본값이며 사용자 정책 확정을 의미하지 않습니다.

## 운영과 작성 계약

- 개인 로컬, Node.js 단일 서버이며 개발 서버는 기본적으로 `0.0.0.0:4000`에 바인딩합니다. `/mcp`는 stateless Streamable HTTP POST를 사용합니다.
- 개발 중 저장소 클래스·런타임 코드를 변경한 경우 서버를 완전히 재시작한 뒤 검증합니다. `getStore()`는 전역 Promise에 저장소 인스턴스를 보존하므로 HMR만으로 새 저장소 메서드가 반영된다고 가정하지 않습니다. 도구 목록 조회와 실제 도구 실행을 별도로 확인합니다.
- 원격 팀 인증은 제공하지 않습니다. 개발 서버는 모든 네트워크 인터페이스에서 수신하지만, LAN에서 API·MCP·SSE를 사용하려면 `PLANNER_ALLOWED_HOSTS=<서버 IP>`를 설정합니다. `dev:lan`은 기존 실행 진입점과의 호환을 위해 `dev`와 같은 `0.0.0.0:4000` 설정을 사용합니다. Host 허용 목록과 동일 Origin 검사는 유지합니다. Host 검사는 인증이나 접속 기기 제한이 아니므로 신뢰하는 내부망에서만 사용합니다.
- HTTP LAN 페이지의 요청 ID는 `crypto.getRandomValues`로 생성합니다. 클립보드 권한이 없으면 수동 복사를 안내합니다. Next 개발 자산도 동일 환경변수의 Host를 허용합니다.
- 원본 입력은 Project.sources에 추가만 하며 UUID와 수집 시각을 부여합니다. 원문·URL과 AI 작성 내용은 분리합니다.
- scope는 비어 있지 않은 문자열이며 동일 타입·동일 scope의 복수 문서도 허용합니다.
- API 공통 구조는 기존·변경을 모두 지원합니다. 신규 API 변경안은 기준 문서 없이 changeReason을 지정할 수 있습니다.
- Figma는 widgets 배열, Weblogging은 이벤트·발생 조건·필드 설명, DB Entity는 Mermaid erDiagram으로 저장합니다.
- DB Entity 저장 시 Mermaid 문법도 검사합니다. 잘못된 외부 파일의 화면 표현은 오류로 알립니다.
- Flow는 두 타입이 공통 JSON 트리를 사용합니다. 최대 5,000 노드, 깊이 40, 텍스트 1,000,000자, label 2,000자이며 HTTP 본문은 2MB로 제한합니다.
- 실제 JSON 스키마와 예시는 MCP `get_catalog`에서 조회합니다. 저장 전 검증과 저장 시 검증을 모두 수행합니다.

## 저장·승인·인계

- 프로젝트와 문서는 UUID 파일명으로 분리하고 index는 메모리에서 도출합니다.
- 원자적 파일 교체와 요청 저널을 사용합니다. 준비된 요청은 pending 저널 → 이력·현재 파일 → done 영수증 순으로 기록합니다.
- 재시작 시 pending을 재실행합니다. 같은 requestId의 재시도는 기록한 결과를 반환하고 다른 내용이면 거부합니다.
- requestId는 데이터 디렉터리 전체에서 고유하며 기록은 초기 버전에서 자동 삭제하지 않습니다.
- 본문·검토 의견·검토 상태 변경은 revision을 증가시킵니다. 기존 이력 파일을 덮어쓰는 갱신은 거부합니다.
- 승인 상태는 draft → reviewed → approved입니다. 사용자 UI에서 진행하며 blocking=true이고 미해결인 질문은 승인을 막습니다.
- 본문 변경은 새 draft를 만들고 기존 승인 이력을 유지합니다. 의견 추가는 본문 승인 상태를 바꾸지 않으며 승인 대상 revision을 보존합니다.
- 개발 인계는 사용자가 선택한 documentId/revision 목록과 해당 승인 본문을 반환합니다. 별도 구현 에이전트가 동일 목록으로 다시 조회합니다.
- 전체 프로젝트 자동 완료 판정이나 모든 카탈로그 타입 생성은 강제하지 않습니다.

```text
<data-dir>/
  .writer-lock
  journal/<request-hash>.pending.json 또는 .done.json
  projects/<project-id>/
    project.json
    documents/<document-id>.json
    history/<document-id>/<revision>.json
```

## 외부 변경과 실시간 UI

- 1초 재검사로 프로젝트 입력과 하위 문서 파일의 생성·변경·삭제를 감지합니다.
- 이벤트에는 projectId, documentId(문서 이벤트), 종류와 revision을 담습니다. 손상 알림은 별도 오류로 표시합니다.
- UI는 연결·재연결·변경 시 최신 정보를 읽고 요청 세대로 오래된 응답을 무시합니다.
- 손상 문서는 마지막 정상 상태와 경고를 표시합니다. 외부 파일의 승인은 이력과 일치할 때만 신뢰합니다.
- 외부 동시 쓰기는 무손실 보장 대상이 아닙니다. 신뢰 이력과 다른 외부 문서는 조회·오류 확인용이며 갱신·승인은 MCP의 정상 저장 이력을 요구합니다.
- SSE는 일시적 알림 채널이며 재연결 시 최신 조회로 복구합니다. 영구 이벤트 재생 로그는 제공하지 않습니다.

## 코드 책임

- 협업 요약은 `src/app/server/collaboration.ts`에서 기존 저장소 조회를 조합하고 UI API `collaboration`으로 제공한다. `collaboration-hub.tsx`는 프로젝트 홈과 검토함을 담당한다. 저장소 스키마 변경은 검토 의견의 선택적 `questionId` 추가뿐이며 기존 데이터는 그대로 읽는다. 계약은 [11](11-collaboration-ux.md)을 따른다.

| 위치 | 책임 |
| --- | --- |
| `src/app/server` | 저장·복구·MCP·HTTP 경계와 서비스 조합 |
| `src/app/lib/catalog.ts` | 타입별 스키마·예시와 feature 검증 조합 |
| `src/widgets/planner-workspace` | 프로젝트·문서·입력·검토·인계 화면 조합 |
| `src/features/flow-spec-syntax` | 순수 파서·검증·DFS·인덱스·접힘 상태 및 viewer |
| `src/entities/document` | 문서 스키마와 타입별 시각화 |
| `src/shared` | 공통 HTTP 클라이언트·오류·JSON 함수 |

## 검증 근거

사용성 개선 이후 최초 27개·추가 3개 요구사항의 최종 대조와 현재 검증 범위는 [0019](../changes/0019-usability-design-audit.md)를 참조합니다. 실계정 Figma 확인은 모의 API 테스트와 구분합니다.

구현 검증 범위는 [기능 완성 기록](../changes/0012-completion.md), 이후 실서버 MCP 확인 결과는 [실연결 검증 기록](../changes/0013-live-mcp-verification.md)을 참조합니다. 과거 시점의 검증 결과는 0010에 보존합니다.

- `tests/flow.test.ts`: 문법·트리·순서·ID·접힘·진단.
- `tests/catalog.test.ts`: 일곱 타입 예시·스키마·생성 제약·API 공통 형식.
- `tests/store.test.ts`: 파일 저장·복수 문서·근거·승인·불변 인계·동시 충돌·중복 방지·재시작 복구·손상 파일.
- `tests/http.test.ts`: 로컬 Origin/Host 경계.
- `tests/e2e/workspace.spec.ts`: 실제 MCP 작성, SSE UI 반영, 일곱 시각화, 검토·승인·별도 구현 연결, 외부 파일 변경·삭제·손상, 재연결·모바일.

Figma 수집·문서 관계·버전 비교·Flow 노드 편집을 추가했습니다. 계약 원본은 [10](10-completion.md)입니다. 사용자 인증은 사용자 요청으로 제외합니다.

## 추가 코드와 도구

- `src/app/server/figma.ts`: Figma URL·외부 요청·원문 수집 경계.
- `src/entities/document/lib`: 참조 추출과 JSON 경로 비교 순수 함수.
- `src/features/flow-spec-syntax/lib/edit-tree.ts`: 순수 노드 편집과 잘못된 이동 거부.
- `src/widgets/planner-workspace/ui/document-relations.tsx`: 관계 이동·역사 버전·비교 UI.
- 추가 MCP 도구: `import_figma`, `edit_flow_node`, `get_document_relations`, `compare_documents`. 전체 15개.
- 추가 테스트: `tests/flow-edit.test.ts`, `compare.test.ts`, `figma.test.ts`, `completion-store.test.ts`, `tests/e2e/completion.spec.ts`.
- Figma 설정: 패키지 `.env.local`에 `FIGMA_ACCESS_TOKEN`을 설정하고 재시작합니다. 토큰은 응답·프로젝트 파일에 기록하지 않습니다.
- E2E는 전용 서버에만 `scripts/e2e-figma.cjs`를 preload해 외부 Figma 응답을 모의 처리합니다. 실제 운영 서버에는 모의 응답 설정이 없습니다.
