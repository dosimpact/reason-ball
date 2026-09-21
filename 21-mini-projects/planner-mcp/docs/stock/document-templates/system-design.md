# 문서 템플릿 시스템 설계

상태: 구현·검증됨. [비즈니스 설계](business-design.md)의 요구사항을 구체화한다.

## 데이터와 저장

- Template: name, title, description, format=`markdown`, body, example, prompt, revision, createdAt, updatedAt.
- 템플릿은 `<data-dir>/templates/<name>.json`에 저장한다. 삭제는 deleted=true tombstone으로 보존하고 목록·상세에서는 제외한다. 이름 재사용 시 revision은 증가한다.
- 기존 PlannerStore의 단일 writer·직렬화·pending/done 저널·requestId 재시도 계약을 재사용한다. 갱신과 삭제에는 expectedRevision이 필수다.
- templates 변경은 별도 SSE `templates` 이벤트로 알린다. 외부 파일 변경도 검사하며 손상된 템플릿은 오류로 드러낸다.
- 본문·예시 최대 각 200,000자, 프롬프트 50,000자. HTTP 공통 2MB 제한 적용.

## 인터페이스

| REST                         | 역할                                                |
| ---------------------------- | --------------------------------------------------- |
| GET /api/templates           | 활성 템플릿 목록                                    |
| GET /api/templates/{name}    | 본문·예시·프롬프트 포함 상세                        |
| POST /api/templates          | `{requestId, template}` 생성, 201                   |
| PUT /api/templates/{name}    | `{requestId, expectedRevision, template}` 수정, 200 |
| DELETE /api/templates/{name} | `{requestId, expectedRevision}` 삭제, 200           |

성공은 `{result}`, 오류는 `{error:{code,message}}`. 미존재 404, 이름/revision/requestId 충돌 409, 입력 오류 400. Host/Origin 검사와 no-store를 적용한다.

MCP `list_templates`, `get_template({name})`는 같은 저장소를 조회한다. `create_template`, `update_template`, `delete_template`는 같은 쓰기 계약을 사용한다. 기존 15개 도구와 get_catalog는 호환 유지한다.

## UI와 표시 확장

- `/templates`는 목록·편집·템플릿 viewer·예시 viewer·프롬프트 관리를 제공한다. 프로젝트 홈에서 연결하며 프로젝트 생성 없이 사용할 수 있다.
- Markdown renderer는 raw HTML을 실행하지 않는다. GFM 표·목록·코드·링크와 fenced `mermaid`를 지원한다. Mermaid는 strict 보안으로 렌더링하고 문법 오류를 표시한다.
- format과 viewer registry를 분리한다. 미래 renderer를 등록할 수 있지만 현재 미지원 format 저장은 거부한다.
- 폼의 미저장 변경은 SSE에 덮어쓰지 않는다. 저장 응답 유실 시 원래 requestId와 payload로 재시도한다.
- entities/template는 모델·viewer, widgets/template-manager는 사용자 흐름, app/server와 route는 IO 조합을 담당한다.

검증은 [공통 기준](../../validation/INDEX.md)을 따른다.

실행 결과는 [2026-09-21 flow](../../flow/2026-09-21-document-templates.md)에 기록한다.
