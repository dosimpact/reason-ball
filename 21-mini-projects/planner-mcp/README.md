# Planner MCP

pnpm workspace에 포함된 Next.js + TypeScript 애플리케이션입니다.

비즈니스 요구사항과 Figma 정보를 바탕으로 AI가 MCP를 통해 frontend/BFF 설계 문서를
작성·관리합니다. 문서는 프로젝트별로 관리하며 등록된 카탈로그 타입을 선택해 생성합니다.
사용자는 UI에서 프로젝트 문서 인덱스와 타입별 시각화를 보고 변경 사항을 실시간으로 확인합니다.
원본 요구사항과 참고 자료를 프로젝트에 보존하고, 사용자가 검토·승인한 설계는 별도의 구현 에이전트가 MCP로 가져가 개발에 사용합니다.

## 문서

- [설계 목차 및 작성 규칙](docs/design/README.md)
- [현재 요구사항](docs/design/01-requirements.md)
- [현재 아키텍처](docs/design/02-architecture.md)
- [문서 카탈로그와 프로젝트 문서](docs/design/03-document-catalog.md)
- [설계 입력·검토·구현 에이전트 인계](docs/design/06-design-lifecycle.md)
- [현재 설계 원칙](docs/design/00-principles.md)
- [변경 이력](docs/changes/README.md): 변경 사항과 결정 이유 보존

## Workspace 사용

저장소 루트에서 실행합니다.

```sh
pnpm --filter planner-mcp dev
```

의존성 설치는 저장소 루트의 `pnpm install`을 사용합니다. 상위
`pnpm-workspace.yaml`과 `pnpm-lock.yaml`을 공유합니다.

기술 스택은 Next.js + TypeScript입니다. 별도 DB 없이 JSON 파일 저장으로 시작하며,
데이터 디렉터리의 변경을 SSE로 UI에 알립니다. 파일·디렉터리는 FSD 기반으로 구성하고,
코드는 SLAP과 저수준 순수함수를 지향합니다.

UI는 `http://127.0.0.1:3100`, MCP Streamable HTTP 엔드포인트는
`http://127.0.0.1:3100/mcp`입니다. 개인 로컬 단일 서버를 기본으로 하며 원격 공유용 인증은 포함하지 않습니다.

### Codex CLI에 로컬 MCP 추가

Planner 서버와 Codex CLI를 같은 머신에서 실행하는 경우입니다. Codex CLI가 설치되어 있어야 합니다.

1. 저장소 루트에서 서버를 실행하고 이 터미널을 켜둡니다.

   ```sh
   pnpm --filter planner-mcp dev
   ```

2. 다른 터미널에서 로컬 MCP 서버를 `planner`라는 이름으로 등록합니다.

   ```sh
   codex mcp add planner --url http://127.0.0.1:3100/mcp
   ```

3. 등록 목록을 확인합니다.

   ```sh
   codex mcp list
   ```

4. Codex CLI를 새로 실행한 뒤 `/mcp`에서 `planner` 연결 상태를 확인합니다.

주소에는 `http://`와 `/mcp`를 모두 포함해야 합니다. `http://127.0.0.1:3100/`는 UI 주소입니다.
`codex mcp add`는 연결 설정만 등록하며 Planner 서버를 실행하지 않습니다.
로컬 연결에는 `dev:lan`, `0.0.0.0`, `PLANNER_ALLOWED_HOSTS` 설정이 필요 없습니다.
등록 목록에 표시되는 것과 실제 도구 호출 성공은 별개이므로 연결 후 `get_catalog` 호출도 확인하세요.

### LAN 접속

신뢰하는 내부망에서 다른 기기로 접속하려면 기존 서버를 종료한 뒤 실행합니다.

```sh
PLANNER_ALLOWED_HOSTS=192.168.0.45 pnpm --filter planner-mcp dev:lan
```

UI: `http://192.168.0.45:3100/`, MCP: `http://192.168.0.45:3100/mcp`.
서버 IP가 바뀌면 환경변수도 변경하세요. 여러 서버 이름은 쉼표로 구분하며 프로토콜·포트·와일드카드는 넣지 않습니다.
`dev:lan`은 모든 IPv4 인터페이스에 바인딩하지만 API는 로컬 주소와 지정한 Host만 허용하고 동일 Origin 검사를 유지합니다.
Host 검사는 사용자 인증이나 접속 기기 IP 제한이 아닙니다. 접근 가능한 내부망 사용자는 문서 조회·작성·승인을 할 수 있으므로 인터넷에 포트 포워딩하지 마세요.
HTTP LAN 환경에서는 자동 클립보드 복사가 제한될 수 있으며 이 경우 화면의 인계 내용을 직접 선택해 복사합니다.

## 시작 흐름

첫 화면의 **프로젝트 목록**에서 이름·설명을 확인하고 `프로젝트 열기`를 선택합니다.
프로젝트 안에서는 사이드바의 `전체 프로젝트`로 목록에 돌아갈 수 있습니다.
프로젝트가 없을 때만 시작 안내가 표시됩니다.

프로젝트를 열면 **프로젝트 홈**에 미해결 질문·검토할 초안·승인 대기·기준 변경·최근 수정 문서가 표시됩니다.
**검토함**에서 질문에 답변하거나 해당 설계로 이동할 수 있습니다. 답변 기록은 설계 반영·질문 해결·승인과 별개입니다.
홈의 **설계 AI 작업 지시**를 복사해 연결된 Codex에 전달하세요. 앱이 AI를 자동 실행하지는 않습니다.
사용자 검토·승인 후 **개발 인계**에서 고정 버전을 전달합니다. 승인 상태는 구현 완료를 의미하지 않습니다.
문서를 체크한 순간의 승인 버전이 고정되므로, 이후 AI가 새 초안을 작성해도 선택한 버전은 바뀌지 않습니다.
문서의 **설계 맥락 → 근거 원문**을 펼치면 입력 원문과 수집 시각을 바로 확인할 수 있습니다.

1. UI에서 프로젝트를 만들고 입력 자료 탭에 원본 요구사항·Figma 링크를 보존합니다.
2. MCP 클라이언트에서 `get_catalog`로 타입별 스키마·작성 예시를 조회합니다.
3. `validate_document` 후 `save_document`로 문서를 작성합니다. UI에 실시간으로 반영됩니다.
4. UI에서 검토 의견을 남기고 `검토 완료` → `개발용 승인`을 수행합니다.
5. 개발 인계 탭에서 승인 문서를 선택해 고정 revision의 `get_handoff` 호출과 묶음을 복사합니다.

MCP 도구: `list_projects`, `create_project`, `get_project`, `add_source`,
`get_catalog`, `get_document_index`, `get_document`, `validate_document`,
`save_document`, `get_handoff`, `parse_flow_spec`.

Flow 노드 추가·변경·이동·삭제는 UI에서도 제공합니다. 나머지 본문 작성은 MCP를 사용합니다. 승인 도구는 MCP에 노출하지 않으며 UI의 로컬 사용자 작업으로 분리합니다.

추가 MCP 도구: `import_figma`, `edit_flow_node`, `get_document_relations`, `compare_documents` (전체 15개).
문서 관계 화면에서 참조 버전 이동·변경 재검토 안내·API 기준 버전 비교를 확인할 수 있습니다.
Flow 접힘 상태는 문서·탭 이동에도 유지되며 브라우저 새로고침 시 초기화됩니다.

### Figma 연동

이 패키지의 `.env.example`을 참고해 `.env.local`에 `FIGMA_ACCESS_TOKEN`을 설정하고 서버를 재시작합니다.
토큰에는 `file_content:read` 권한과 해당 Figma 파일 접근 권한이 필요합니다. [Figma 공식 파일 API](https://developers.figma.com/docs/rest-api/file-endpoints/)를 사용합니다.

UI의 **입력 자료 → Figma에서 가져오기**에 파일 또는 노드 링크를 입력합니다. MCP 예시:

```json
{
  "tool": "import_figma",
  "arguments": {
    "requestId": "unique-request-id",
    "projectId": "project-id",
    "url": "https://www.figma.com/design/FILE_KEY/Example?node-id=1-2",
    "depth": 2
  }
}
```

파일·노드 원문과 Figma version·lastModified·조회 깊이를 입력 자료에 보존합니다. 여러 화면은 각각 가져올 수 있습니다.
이 자료를 설계 AI가 해석해 Figma Requirements의 widgets를 작성합니다. 요구사항을 자동 추측하거나 Figma 파일에 쓰지 않습니다.
조회 깊이는 1~10, 응답은 180KB, 대기는 10초로 제한합니다. 큰 파일은 노드 링크나 낮은 깊이를 사용하세요.
토큰은 브라우저·MCP 인자·저장 자료에 포함하지 않습니다. 사용자 로그인 기능은 포함하지 않습니다.

## 데이터와 복구

개발 중 저장소·런타임 코드 변경 후에는 실행 중인 서버를 완전히 종료하고 다시 시작하세요.
전역 저장소 인스턴스가 HMR 후에도 유지될 수 있으므로 도구 목록에 새 도구가 보이는 것만으로
갱신 완료를 판단하지 않습니다. [운영 기준](docs/design/09-implementation.md)과
[실서버 검증 기록](docs/changes/0013-live-mcp-verification.md)을 참고하세요.

- 기본 위치는 이 패키지의 `.data/`이며 `PLANNER_DATA_DIR`로 변경할 수 있습니다.
- 프로젝트 메타데이터·문서 JSON·불변 revision 기록·요청 저널을 분리합니다.
- 같은 디렉터리에 서버 두 개를 실행하면 쓰기 잠금 오류로 거부합니다.
- 요청 재시도 시 동일한 `requestId`와 내용을 유지하세요. 갱신에는 읽은 `expectedRevision`이 필요합니다.
- UI에 **저장 결과 미확인**이 뜨면 이미 저장되었을 수 있습니다. 새로고침하거나 다시 생성하지 말고 **같은 요청으로 재시도**를 누르세요. 확인 전 추가 저장은 제한됩니다.
- 데이터 백업은 서버를 종료한 뒤 데이터 디렉터리 전체를 복사합니다. 복구할 때도 전체 디렉터리를 사용합니다.
- 파일 변경은 1초 주기로 하위 디렉터리까지 감지합니다. 손상 파일은 오류로 표시하고 마지막 정상 UI를 유지합니다.
- 직접 파일 편집과 MCP 쓰기를 동시에 수행하지 마세요. 외부 변경은 새 revision의 draft로 조회할 수 있지만, 신뢰된 이력과 불일치하면 MCP 갱신·승인이 거부됩니다. 일반 수정은 MCP로 진행하세요.
- 변경된 문서만을 복사해 과거 revision 기록을 덮어쓰지 마세요. 외부 JSON의 승인 상태는 신뢰하지 않습니다.

## 검증

```sh
pnpm --filter planner-mcp test
pnpm --filter planner-mcp lint
pnpm --filter planner-mcp typecheck
pnpm --filter planner-mcp test:e2e
```

브라우저가 없으면 먼저 `pnpm --filter planner-mcp exec playwright install chromium`을 실행합니다.
E2E는 `build`를 포함하며 임의의 빈 포트와 임시 데이터 디렉터리를 사용합니다. 기존 서버를 재사용하지 않습니다.
HTML 결과는 `playwright-report/index.html`에 생성됩니다.
단위·저장 테스트는 `tests/*.test.ts`, 실제 MCP 클라이언트·UI 통합 검증은 `tests/e2e/*.spec.ts`에 있습니다.
E2E의 외부 Figma API는 전용 서버에만 preload한 fixture로 대체합니다. 실제 Figma 계정 연동 확인 여부와 요구사항별 근거는 [최종 설계 대조 기록](docs/changes/0019-usability-design-audit.md)에 구분해 기록합니다.

현재 구현의 결정과 제한은 [구현 기본값](docs/design/09-implementation.md)을 참조합니다.


```
• 로컬 서버를 실행한 상태에서 다음 명령으로 추가하세요.

  codex mcp add planner --url http://127.0.0.1:3100/mcp

  등록 확인:

  codex mcp list
```
