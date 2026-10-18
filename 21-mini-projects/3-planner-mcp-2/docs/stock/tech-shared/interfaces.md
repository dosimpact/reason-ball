# 최소 MCP·REST 계약

상태: 핵심 구현 기준. 입력 검증 원본은 `src/entities/planner/model.ts`, MCP 등록은 `src/app/server/mcp.ts`, REST는 `src/app/api/[...path]/route.ts`입니다.

## 공통 규칙

- 문서·체크리스트 변경은 `expectedRevision` 필수. 결과의 최신 `revision`을 다음 요청에 사용합니다. 충돌은 409이며 최신 문서를 다시 읽습니다.
- 오류: 잘못된 입력 400, 출처 거부 403, 없는 대상 404, revision 충돌 409. MCP는 `isError: true`로 전달합니다.
- MCP 응답은 text content에 JSON으로 반환합니다. `/mcp`는 stateless Streamable HTTP POST입니다.
- 체크리스트: `id`, `label`, `position`, `aiResult(pending/passed/failed/skipped)`, `humanConfirmed`.
- 사람 확인은 AI 결과와 독립적으로 체크·해제할 수 있습니다. AI 결과 변경만으로 사람 확인을 해제하지 않으며 항목 설명 변경과 명시적 reopen은 초기화합니다. AI는 MCP로 사람 확인을 완료할 수 없습니다. reopen은 지정 항목의 AI 결과를 pending, 사람 확인을 false로 바꾸며 나머지는 보존합니다.
- 전체 체크가 passed·사람 확인 완료이면 문서는 verified입니다. 검증된 본문·Overview·제목 변경은 reopen 상태로 전환하고, 항목별 초기화는 AI가 영향 범위를 지정합니다.

## 5개 도메인 도구

| 영역 | 도구 | 주요 입력 |
| --- | --- | --- |
| 프로젝트 | list_projects / get_project | 없음 / projectId |
| 프로젝트 | create_project / update_project / delete_project | title / projectId+title / projectId |
| 프로젝트 | list_flow_nodes / create_flow_node / update_flow_node / delete_flow_node | projectId; 변경은 label, phase, documentId(null 허용), position; 수정·삭제는 nodeId |
| 템플릿 | list_templates / get_template | 없음 / name |
| 문서 | list_documents / get_document | projectId+선택 parentId / documentId |
| 문서 | create_document | projectId, title, phase, templateName 또는 kind; 선택 parentId, body |
| 문서 | update_document / delete_document | documentId, expectedRevision; 수정은 title, body, overview 중 변경 필드 |
| 진행·검증 | add_checklist_item | documentId, label, expectedRevision; 선택 position |
| 진행·검증 | update_checklist_item / delete_checklist_item | documentId, itemId, expectedRevision; 수정은 label, aiResult, position |
| 진행·검증 | reopen_document | documentId, affectedItemIds, reason, expectedRevision |
| 진행·검증 | record_verification | documentId, body, expectedRevision |
| AI 작업 안내 | get_workflow_rules | 없음 |

`get_project`는 단계별 index와 노드를 반환합니다. `get_document`는 본문·정형 체크리스트와 하위 문서 카탈로그(id/title/kind/href)를 반환합니다. 검증 index는 설계-검증 문서와 결과 문서도 조회할 수 있도록 연결합니다. 결과 문서는 부모당 하나이며 record_verification으로 갱신합니다.

## REST

| 경로 | 메서드·기능 |
| --- | --- |
| /api/projects | GET 목록, POST 생성 |
| /api/projects/:id | GET 상세, PATCH 이름 변경, DELETE 삭제 |
| /api/projects/:id/nodes | GET 목록, POST 생성 |
| /api/projects/:id/nodes/:nodeId | PATCH 수정, DELETE 삭제 |
| /api/templates | GET 목록, POST 생성 |
| /api/templates/:name | GET 상세, PATCH 수정(expectedRevision), DELETE 삭제 |
| /api/documents?projectId=…&parentId=… | GET 목록(parentId 선택) |
| /api/documents | POST 생성 |
| /api/documents/:id | GET 상세, PATCH 수정, DELETE 삭제(expectedRevision) |
| /api/documents/:id/checklist | POST 항목 추가 |
| /api/documents/:id/checklist/:itemId | PATCH 항목 수정, DELETE 항목 삭제 |
| /api/documents/:id/checklist/:itemId/confirm | POST 사람 확인(confirmed, expectedRevision) |
| /api/documents/:id/reopen | POST 영향 항목 초기화 |
| /api/documents/:id/verification | POST 결과 자식 문서 생성·갱신 |
| /api/workflow | GET AI 작업 규칙 |
| /api/events | GET SSE change 이벤트 |

템플릿 수정 입력: name, title, kind, body, example, prompt, checklist(문자열 배열), expectedRevision. 생성은 revision을 제외합니다. 인스턴스는 템플릿 전체 스냅샷을 보존합니다. 원본 삭제도 기존 문서에 영향을 주지 않습니다.

Overview 항목은 id, parentId(null=최상위), title, what, how, verificationDocumentId(null=미연결)입니다. 중복 ID·순환·없는 부모·타 프로젝트 참조는 거부합니다. UI는 이 데이터를 항목별 폼과 들여쓰기 트리로 표현합니다.

노드 생성·수정은 선택 `coordinates: {x: number, y: number}`를 받습니다. x/y는 유한 숫자이며 음수도 허용합니다. 수정 시 coordinates 생략은 기존 좌표를 유지합니다. position은 기존 정렬 순서를 뜻합니다. REST와 create_flow_node/update_flow_node MCP에 동일 적용됩니다.

## 문서 확장 MCP (REQ-012, 구현)

- `get_template` / `get_document`: 확장 목록과 다이어그램 정형 데이터를 포함합니다.
- `create_document` / `update_document`는 선택 `extensions` 전체 목록을 받습니다. 생성 시 생략하면 템플릿 초기값을 복사하고, 수정 시 생략하면 기존 목록을 보존합니다. 빈 배열은 전체 제거입니다. 개별 변경 시 조회한 나머지 확장을 함께 보존해서 전송합니다.
- 변경은 기존 `expectedRevision` 및 입력 검증·reopen 규칙을 따릅니다. UI와 MCP가 같은 저장·검증 경로를 사용합니다.
- REST 템플릿 생성·수정 및 문서 생성·수정도 같은 필드를 지원합니다. CodeWeave 전용 조회·수정 도구를 포함한 총 24개 도구의 명세가 자동 갱신됩니다.

확장 예시 (`update_document`에 documentId·expectedRevision과 함께 전달):

```json
{
  "extensions": [{
    "id": "order-flow",
    "type": "react-flow-diagram",
    "title": "주문 처리 흐름",
    "schemaVersion": 1,
    "data": {
      "nodes": [
        { "id": "request", "label": "주문 요청", "position": { "x": 0, "y": 0 } },
        { "id": "complete", "label": "주문 완료", "position": { "x": 240, "y": 0 } }
      ],
      "edges": [{ "id": "request-complete", "source": "request", "target": "complete" }]
    }
  }]
}
```

## CodeWeave 확장

`type: "codeweave"`, `schemaVersion: 1`, `data: {source: string}`. React Flow와 혼합 가능하며 목록 한도는 10개, source 한도는 50,000자입니다. 저장 시 core 문법 검사를 수행합니다.

- `get_codeweave`: documentId·extensionId, 선택 line(1부터)·query. 컴파일 결과·revision·selected·matches 반환.
- `update_codeweave_node`: documentId·extensionId·nodeId·expectedRevision·expectedSource·patch. patch는 text/prefix/direction/change/inlineComment/blockComment, 주석 null은 제거입니다.
- REST GET/PATCH `/api/documents/:id/codeweave/:extensionId`는 같은 어댑터를 호출합니다. GET은 line/query 쿼리 사용. stale revision/source는 409, 없는 확장은 404, 잘못된 문법/속성은 400.
- 구조 변경은 기존 update_document의 extensions를 이용하며 나머지 확장을 보존합니다. 생성 시 템플릿 확장은 독립 복사합니다.
