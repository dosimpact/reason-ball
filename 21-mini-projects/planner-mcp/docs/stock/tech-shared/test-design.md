# 검증 범위와 근거

실행 규칙은 [검증 원칙](../../validation/INDEX.md), 명령은 [패키지 실행](planner-mcp/implementation.md)을 따릅니다. 이 문서는 검증 책임을 정하며 실행별 결과는 flow에 보존합니다.

| 범위 | 검증 책임 |
| --- | --- |
| Flow 문법·트리·편집 | `tests/flow.test.ts`, `tests/flow-edit.test.ts` |
| 고정 7종 문서·스키마 | `tests/catalog.test.ts` |
| 저장·승인·고정 인계·충돌·중복 방지·복구 | `tests/store.test.ts`, `tests/completion-store.test.ts` |
| 관계·비교·Figma 외부 경계 | `tests/compare.test.ts`, `tests/figma.test.ts` |
| Host/Origin·클라이언트 복구·요청 ID | `tests/http.test.ts`, `tests/client.test.ts`, `tests/request-id.test.ts` |
| 템플릿 저장·REST 계약 | `tests/templates.test.ts`, `e2e/bruno-api-tests` |
| 실제 UI·MCP·SSE 회귀 | `tests/e2e/` |
| Markdown/Mermaid viewer | Storybook과 [템플릿 수용 시나리오](../document-templates/test-design.md) |

## 최근 실행 증거와 한계

- [2026-09-21 템플릿 구현 검증](../../flow/2026-09-21-document-templates.md): 11파일 101테스트, Bruno 10요청/테스트, Playwright 24개, lint·typecheck·생산 빌드·Storybook 빌드 통과. 브라우저 관찰과 경고는 해당 기록을 따릅니다.
- [프로젝트 요구사항 대조](../../changes/2026-09-15-project-design-summary.md#change-0019): REQ-001~030의 당시 설계 대조. 이는 코드 커버리지나 모든 운영 환경의 보장을 뜻하지 않습니다.
- Figma 자동 검증은 모의 외부 API입니다. 실제 계정 검증은 미실행이며 별도 환경·토큰을 갖춘 검증이 남아 있습니다.
- [과거 실서버 MCP 실패](../../changes/2026-09-15-project-design-summary.md#change-0013)는 당시 실패로 보존합니다. 이후 읽기 성공이나 소유 테스트 서버 성공이 그 실행 서버의 모든 실패를 해소했다는 증거는 아닙니다.

문서 정리 시 위 테스트를 새로 실행한 것으로 기록하지 않습니다.
