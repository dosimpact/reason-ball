# 실행 중인 MCP 서버 검증

날짜: 2026-09-15 (KST)
상태: 실서버 검증 FAIL. 재시작 후 재검증 필요.

## 요청·변경 이유

- 사용자 요청: 선택한 Planner MCP 연결을 바탕으로 MCP 수준 테스트까지 완료.
- 이 에이전트 세션에는 Planner 도구가 노출되지 않아 선택형 연결 직접 호출은 실행하지 못했다.
- 대신 실제 실행 중인 `http://127.0.0.1:3100/mcp`에 SDK Streamable HTTP 클라이언트로 연결했다. 선택형 연결 테스트를 대신 완료했다고 주장하지 않는다.
- 기존 기록 0012의 자동 테스트와 실제 장시간 실행 중인 서버 결과를 구분하고, 현재 운영 기준 09와 README에 저장소 코드 변경 후 재시작 안내를 추가했다. 제품 코드 변경은 없다.

## 실제 서버 결과

전용 프로젝트: `MCP live verification 2026-09-15`, ID `bcfd254c-e204-4ff8-8e4d-ba90c01d6283`.
프로젝트와 문서 7개를 사용자 확인용으로 보존했다. 기존 프로젝트·문서는 변경하지 않았다.

| 검사 | 결과 | 근거 |
| --- | --- | --- |
| initialize / tools/list | PASS | 실제 서버에서 도구 15개 반환 |
| get_catalog / list_projects | PASS | isError 없음, structuredContent.result 반환 |
| create_project와 동일 요청 재시도 | PASS | 같은 requestId의 결과 deepEqual 확인 |
| 카탈로그 7종 validate/save/get | PASS | 모든 예시 저장 revision=1, 조회 결과와 저장 결과 deepEqual 확인 |
| get_document_index / get_project / 역사 조회 | PASS | 문서 7개 인덱스, problems=[], 프로젝트와 Flow revision 1 읽기 성공 |
| edit_flow_node 정상 rename | FAIL | INTERNAL_ERROR; 정상 완료하지 못함 |
| get_document_relations | FAIL | INTERNAL_ERROR; 다음 턴의 읽기 재확인에서도 동일 |
| import_figma 잘못된 URL | FAIL | 정상적인 입력 오류 대신 INTERNAL_ERROR |
| 위 실패 이후 비교·충돌·인계 연속 검증 | SKIP | 선행 편집 실패로 해당 실행 중단 |
| 선택형 Planner MCP 연결 | SKIP | 현재 세션의 사용 가능 도구에 없음 |
| 실제 Figma 계정 | SKIP | 실제 토큰·대상 파일을 사용한 호출 없음 |

## 원인 가설과 안전한 확인

- [runtime.ts](../../src/app/server/runtime.ts)는 `globalThis.plannerStore` Promise를 재사용한다.
- [현재 MCP 등록](../../src/app/server/mcp.ts)은 새 메서드를 호출하고 [현재 저장소](../../src/app/server/store.ts)에는 해당 구현이 있다.
- 기존 도구 성공과 새 저장소 메서드 세 가지 실패가 함께 나타났다. HMR 이전 저장소 인스턴스 잔류가 유력한 가설이지만 내부 예외 스택이나 재시작 후 결과로 확정하지 못했다.
- 3100 포트 프로세스 PID 28660은 재확인 시에도 같았다. 사용자 서버는 종료·교체하지 않았다. 잠금 파일이나 사용자 데이터도 삭제하지 않았다.

## 자동 검증 재확인

- `pnpm --filter planner-mcp test`: 9개 파일, 87개 PASS.
- `pnpm --filter planner-mcp lint`: PASS.
- `pnpm --filter planner-mcp typecheck`: PASS.
- `pnpm --filter planner-mcp test:e2e`: 생산 빌드 PASS, 10개 시나리오 PASS (24.2초). 소유한 `127.0.0.1:55038` 서버와 임시 데이터를 사용하고 종료 시 정리했다. HTML 결과는 `playwright-report/index.html`에 생성된다.
- 위 E2E에는 Flow 편집/충돌, 참조/비교, 승인 후 별도 MCP 클라이언트 인계가 포함된다. 외부 Figma만 모의 응답이며 사용자 실행 서버 또는 선택형 MCP 연결의 통과 근거가 아니다.

## 스킬·판정·후속 작업

- apb-playwright-e2e: 기존 스펙과 소유 서버/임시 데이터 실행 절차를 사용했다. 이번에는 새 선택자를 작성하지 않았다.
- apb-validation-report: PGV 리포트가 없어 이 변경 기록에 실제 PASS/FAIL/SKIP와 후속 작업을 적용했다. 새 전체 설계 일치율을 계산하거나 PGV 승인을 주장하지 않는다.
- 판정: FAIL. 자동 검증과 별개로 실제 실행 중인 서버의 추가 기능 호출이 실패했다.
- 사용자 터미널에서 기존 서버를 종료하고 저장소 루트에서 `PLANNER_ALLOWED_HOSTS=192.168.0.45 pnpm --filter planner-mcp dev:lan`으로 재시작한다.
- 동일 테스트 프로젝트에서 Flow 편집·중복 방지·revision 충돌·역사 보존·관계·비교·승인 인계를 재검증한다. 재시작 후에도 실패하면 서버 예외 원인을 조사한다.
- 선택형 MCP 도구 노출 후 그 연결의 직접 호출 결과를 별도로 기록한다. 실제 Figma 검증에는 서버 환경의 토큰과 접근 가능한 파일 링크가 필요하며 토큰을 대화에 붙여 넣지 않는다.
