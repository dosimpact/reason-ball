# 실행 기본값과 코드 연결

개인 로컬·Node.js 단일 서버 운영이 기본입니다. 업무 계약은 [프로젝트 설계](../../project-design/INDEX.md)와 [템플릿 설계](../../document-templates/INDEX.md)가 소유합니다.

## 명령과 환경

저장소 루트에서 `pnpm --filter planner-mcp <command>`로 실행합니다.

| command | 동작 |
| --- | --- |
| `dev`, `dev:lan` | 개발 서버 `0.0.0.0:4000` |
| `build`, `start` | 생산 빌드, 생산 서버 `127.0.0.1:3100` |
| `test` | Vitest 단위·통합 검증 |
| `lint`, `typecheck` | ESLint, Next 타입 생성과 TypeScript 검사 |
| `test:api` | 생산 빌드 후 소유 서버·임시 데이터로 Bruno HTTP E2E |
| `test:e2e` | 생산 빌드·Bruno API 검증 후 Playwright 회귀, 서버·데이터 정리 |
| `storybook`, `build-storybook` | `127.0.0.1:6006`의 viewer story, 정적 Storybook 생성 |

- `PLANNER_DATA_DIR`: 저장 경로. 생략하면 패키지 실행 디렉터리의 `.data/`.
- `PLANNER_ALLOWED_HOSTS`: LAN 서버 Host 허용 목록. Host·동일 Origin 검사는 인증이 아닙니다. 신뢰하는 내부망에서 사용합니다.
- `FIGMA_ACCESS_TOKEN`: 서버 전용 환경변수. 패키지 `.env.local`에 설정 후 재시작하며 응답·프로젝트 파일에 저장하지 않습니다.
- 저장소 인스턴스는 전역 Promise에 캐시됩니다. 저장소 클래스·런타임 변경 후 서버를 완전히 재시작하고 실제 도구 호출까지 확인합니다.
- HTTP LAN의 요청 ID는 `crypto.getRandomValues`를 사용하며 클립보드 권한이 없으면 수동 복사를 안내합니다.
- 수동 검증은 패키지에서 생산 빌드 후 `node scripts/e2e.mjs inspect`로 소유 서버를 실행합니다. SIGINT/SIGTERM으로 정리합니다.
- E2E의 Figma 응답은 전용 서버 preload fixture로 대체합니다. 실제 Figma 계정 검증과 구분합니다.

## 파일 배치

```text
<data-dir>/
  .writer-lock
  journal/<request-hash>.pending.json 또는 .done.json
  templates/<name>.json
  projects/<project-id>/
    project.json
    documents/<document-id>.json
    history/<document-id>/<revision>.json
```

프로젝트 문서는 불변 revision 이력을 보존합니다. 템플릿은 현재 레코드와 삭제 표식을 저장하며 동일 이름 재생성 시 revision을 이어갑니다. 템플릿의 별도 버전 조회 API는 없습니다. 트랜잭션·오류 계약은 [프로젝트 저장 계약](../../project-design/08-mcp-storage-sse.md)과 [템플릿 계약](../../document-templates/system-design.md)을 따릅니다.

## 코드와 인터페이스

| 위치 | 책임 |
| --- | --- |
| `src/app/server/store.ts` | 저장·복구·프로젝트 문서 이력·파일 감지 |
| `src/app/server/templates.ts` | 공용 템플릿 저장·수정·삭제 |
| `src/app/server/collaboration.ts`, `figma.ts` | 협업 조회 조합, 외부 Figma 경계 |
| `src/app/lib/catalog.ts` | 고정 7종 타입 스키마·예시·검증 |
| `src/widgets/planner-workspace` | 프로젝트·문서·관계·검토·인계 UI |
| `src/widgets/template-manager` | 템플릿·예시·프롬프트 관리 UI |
| `src/features/flow-spec-syntax` | 순수 파서·검증·탐색·편집과 viewer |
| `src/entities/document`, `src/entities/template` | 도메인 스키마·타입별 보기 |
| `src/shared` | HTTP·오류·JSON·요청 ID 공통 경계 |

| 인터페이스 | 계약 |
| --- | --- |
| `/`, `/templates` | 프로젝트 작업 공간, 공용 템플릿 관리 |
| `POST /api/planner` | 프로젝트 조회·작성·검토·승인·인계 action API |
| `/api/templates`, `/api/templates/[name]` | 템플릿 목록·생성·이름 조회·수정·삭제 REST |
| `POST /mcp` | stateless Streamable HTTP. GET/DELETE는 405 |
| `GET /api/events` | ready·프로젝트 change·공용 templates 알림, heartbeat 15초·파일 재검사 1초 |

MCP 도구는 20개입니다. 성공은 `structuredContent.result`, 오류는 `isError: true`와 JSON text로 반환합니다.

- 프로젝트: `list_projects`, `create_project`, `get_project`, `add_source`.
- 문서: `get_catalog`, `get_document_index`, `get_document`, `validate_document`, `save_document`, `get_handoff`.
- 확장: `parse_flow_spec`, `import_figma`, `edit_flow_node`, `get_document_relations`, `compare_documents`.
- 템플릿: `list_templates`, `get_template`, `create_template`, `update_template`, `delete_template`.

승인은 사용자 UI/API가 수행합니다. 검증 기준·실행 근거는 [검증 설계](../test-design.md)를 따릅니다.
