# CodeWeave core

상태: 독립 core와 Planner 문서·템플릿 extension adapter 구현. 컴파일·Tree View·라인 조회·MCP 탐색/수정을 지원한다.

## CW-01 — 제품 규칙

코드의 큰 흐름을 텍스트로 정리한다. indent는 계층, `->`/`<-`는 진행/반환, 자유로운 `Prefix:`는 로직 종류다. `[Layer]`로 책임 영역을 구분한다. `(+)`/`(-)`는 추가/삭제 예정이며 GitHub diff 스타일의 표시 데이터로 변환한다. 구현 완료 여부나 버전 간 자동 비교를 관리하지 않는다. 주석은 한 줄과 여러 줄을 지원한다. 원본은 master-requirement.md의 CodeWeave 요구사항이다.

## CW-02 — 독립 패키지 경계

`src/modules/codeweave/core/index.ts`가 유일한 공개 진입점이다. `types.ts`는 직렬화 가능한 AST·진단, `compiler.ts`는 파싱, `query.ts`는 조회·검색, `tree.ts`는 접힘 상태/표시 행, `edit.ts`는 revision 기반 원문 수정을 담당한다. 내부는 상대 경로 `.js` import만 사용한다. 런타임 외부 의존성, React/Next.js, DOM, Node.js API, DB, MCP SDK가 없다.

Next.js와 향후 MCP adapter는 소비자다. 파일/DB 저장, 문서 목록, 인증, 전송, CSS/HTML 렌더링은 소비자의 책임이다. core는 문서 하나의 컴파일과 탐색·수정 규칙을 공유한다. `core` 디렉터리와 전용 tsconfig를 이동해 ESM JS 및 `.d.ts`를 npm 패키지로 배포할 수 있다. 패키지명/배포는 아직 확정하지 않는다.

## CW-03 — 문법 및 오류 계약 (구현 기본값)

- 공백 2칸 단위. 탭·홀수 들여쓰기·부모 없는 깊이 건너뛰기는 오류다. 레이어는 깊이 0, 로직은 레이어 없이 깊이 0에서도 시작 가능하다. 레이어 내부 첫 로직은 깊이 1이며 다음 레이어까지 적용된다.
- `-> [변경표시] Prefix: 본문`, `<- [변경표시] Prefix: 본문`. Prefix는 공백 없는 임의 문자열이며 콜론으로 본문과 나눈다. 타입 이름의 allowlist/의미 검사는 하지 않는다. 본문은 비어 있을 수 없다.
- `//`는 앞에 공백이 있을 때 한 줄 주석의 시작이다. `https://...`는 본문으로 유지한다.
- `/*` 블록은 바로 앞 로직 또는 그 로직의 마지막 주석 다음 줄에서 같은 깊이로 시작한다. `*/` 뒤에는 공백만 허용한다. 중첩 블록은 오류다. 주석 내부 기호를 문법으로 해석하지 않는다. 줄바꿈·원문 라인 범위를 보존한다.
- 컴파일은 `source`, 소스 순서의 평탄한 노드 배열과 parent/children ID, root ID, line→node 대응, 진단을 반환한다. 오류가 있으면 `ok=false`; 부분 트리는 미리보기만 가능하며 수정 API는 거부한다.
- 라인·열은 1부터 시작한다. ID는 해당 컴파일 snapshot의 `line:N`이다. 안정적인 영구 ID라고 가정하지 않는다. 편집은 `expectedSource`와 ID를 함께 사용해 오래된 참조를 거부하고 수정 후 새 ID를 반환한다. 저장소의 revision 검사는 adapter가 추가한다.

## CW-04 — 공개 API와 범위

- `compileCodeWeave(source)`: 파싱·진단. 빈 문서도 허용한다.
- `getNode`, `getNodeAtLine`, `searchNodes`: ID/주석 라인 조회, 본문·Prefix·레이어·주석 검색.
- `collapseAll`, `expandAll`, `setNodeExpanded`, `getVisibleRows`: 불변 접힘 상태, 레이어와 로직의 평탄한 Tree View 행. 각 행은 depth, expandable, expanded, diff tone(added/removed/neutral), marker를 제공한다. source는 변하지 않는다.
- `updateNode(document, id, patch, expectedSource)`: 로직 본문·Prefix·방향·변경표시·한 줄/블록 주석 수정. 레이어는 이름 수정. 지정하지 않은 필드는 보존하며 null로 주석을 지운다. 관련 원문만 바꾸고 전체를 재검증한다.
- `replaceSource(document, source, expectedSource)`: 구조 추가·삭제·이동은 새 원문으로 전달한다. invalid/stale 수정은 오류를 반환하며 기존 문서는 변하지 않는다.

## 검증

CW-01~04: 공개 API 단위 테스트, 원문 예시 컴파일, 오류/주석/CRLF/한글/사용자 Prefix, 접기/부분 펼치기, 수정 충돌·주석 보존, standalone TypeScript 빌드 및 Node ESM import. CW-05 adapter는 Bruno HTTP·실제 MCP 클라이언트·Playwright 브라우저·Storybook으로 혼합 확장, 트리/주석, 충돌과 SSE를 검증한다.

## 소비자 사용 예시

```ts
import {
  compileCodeWeave,
  getNodeAtLine,
  collapseAll,
  setNodeExpanded,
  getVisibleRows,
  updateNode,
} from "@/modules/codeweave/core";

const source = "[App]\n  -> (+) Custom: 새 처리 // 추가 예정";
const document = compileCodeWeave(source);
if (document.ok) {
  const state = setNodeExpanded(collapseAll(document), document.roots[0], true);
  const rows = getVisibleRows(document, state); // React가 텍스트로 렌더링
  const selected = getNodeAtLine(document, 2);
  if (selected) {
    const result = updateNode(
      document,
      selected.id,
      { text: "수정한 처리" },
      source,
    );
    // result.ok인 경우 adapter가 revision 확인 후 source 저장; 접힘 ID는 재조회
  }
}
```

core는 HTML을 생성하거나 사용자 텍스트를 실행하지 않는다. 소비자는 텍스트를 escape해서 표시한다. ID는 재컴파일 후 다시 조회하며, 레이어/주석 수정도 파싱 결과를 통해 검증한다. `replaceSource`는 오류 문서도 새 올바른 원문으로 복구할 수 있다. `updateNode`는 오류 문서의 부분 트리를 수정하지 않는다. 블록 주석 patch를 지정하면 해당 노드의 블록 주석들을 하나로 교체하고, 생략하면 기존 바이트를 보존한다.

## CW-05 — Planner extension adapter (구현)

- 문서·템플릿 확장에 `{id,type:"codeweave",title,schemaVersion:1,data:{source}}`를 저장합니다. React Flow와 혼합하여 최대 10개, 각 source는 최대 50,000자. AST는 저장하지 않고 공개 core로 컴파일합니다. 잘못된 문법은 저장 거부, 작성 중에는 진단과 부분 트리를 표시합니다.
- 화면: CodeWeave 추가·제거·제목/원문 편집, 전체/가지 접기·펼치기, (+)/(-) 색상·기호, 로직 및 주석 라인 선택과 상세 속성. 템플릿 미리보기와 인스턴스 복사에도 동일 렌더러를 사용합니다.
- `get_codeweave(documentId,extensionId,line?,query?)`: source·revision·nodes·roots·diagnostics와 selected/matches. 주석 라인도 귀속 노드를 반환합니다.
- `update_codeweave_node(documentId,extensionId,nodeId,patch,expectedSource,expectedRevision)`: core의 속성/주석 수정 후 기존 문서 저장 경로를 호출합니다. 다른 확장과 templateSnapshot은 보존하고 SSE/reopen 정책을 따릅니다. nodeId는 source snapshot 단위이므로 매번 조회 후 수정합니다.
- REST `GET /api/documents/:id/codeweave/:extensionId?line=&query=`, `PATCH` 동일 경로. 구조 추가·삭제·이동이나 확장 목록 변경은 기존 문서 PATCH/update_document의 extensions로 처리합니다.
- Next Turbopack은 ESM `.js` import를 가진 core의 독립 빌드 산출물 `.codeweave-build/index.js`를 사용합니다. `dev`/`build`는 먼저 `build:codeweave`를 실행합니다. core를 수정한 개발 세션은 dev를 재시작합니다. 원본 core 내부에는 프레임워크 의존성을 추가하지 않습니다.
