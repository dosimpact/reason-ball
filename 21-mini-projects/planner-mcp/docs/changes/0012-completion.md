# 로컬 기능 완성·Figma 연동·검증 보강

날짜: 2026-09-15
상태: 구현·자동 검증 완료. 실계정 Figma 연결은 토큰 미설정으로 별도 확인 필요.

후속: [0013 실서버 MCP 검증](0013-live-mcp-verification.md)에서 기존 개발 프로세스의 추가 도구 호출 실패를 확인했다. 이 문서의 자동 테스트 통과를 실행 중인 모든 서버의 정상 동작으로 확대 해석하지 않는다.

## 요청·범위·변경 이유

- 사용자 요청: 문서의 미완성 기능과 테스트 완성. Figma 연동 포함, 사용자 인증 제외.
- 기존에는 Flow 접힘이 문서/탭 전환 시 초기화되었고, Overview 참조는 필드 저장만 가능했으며 API 기준 버전은 텍스트로만 표시했다.
- 변경 후 문서별 접힘 보존, 참조 무결성 검사·고정 버전·이동·재검토 안내, API/문서 버전 비교, Flow 노드 편집, Figma 원문 수집을 제공한다.
- 세부 기본값과 비목표를 [현재 추가 계약](../design/10-completion.md)에 먼저 기록했다. 기존 미채택 아이디어 전체를 제품 요구사항으로 승격하지 않는다.

## 구현 변경

- 서버·클라이언트 경계의 카탈로그 JSON Schema를 plain JSON으로 정규화했다(앞선 실행 오류 수정 포함).
- Flow는 UI와 MCP가 같은 순수 편집 함수·저장 큐를 사용한다. 이동 시 ID 유지, 잘못된 부모/자손 이동 거부, 삭제 ID 재사용 거부, revision·requestId 검사와 승인 이력 보존을 검증한다.
- Overview 참조는 revision을 고정하고 노드 존재를 검사한다. API 기준 문서는 같은 프로젝트·타입의 실제 역사 버전이어야 한다.
- 관계 조회는 incoming/outgoing과 현재 기준 변경·손상 안내를 제공한다. 자동 승인 취소는 하지 않는다.
- UI는 역사 버전을 읽기 전용으로 열고 JSON 경로별 추가/삭제/변경 비교와 질문 해결·답변 정보를 표시한다.
- Figma는 서버 토큰으로 고정 REST API를 읽고 원문·version·lastModified·depth·수집 시각을 보존한다. API 오류·시간·크기 제한·재시도를 처리한다. 문서 자동 작성이나 Figma 원본 쓰기는 하지 않는다.
- 추가 MCP 도구 4개: import_figma, edit_flow_node, get_document_relations, compare_documents. 전체 15개.

## Gap Table

이번 작업의 8개 구현 항목 기준으로 비교한다. 전체 문서의 모든 아이디어 또는 코드 커버리지 백분율을 뜻하지 않는다.

| 항목 | 상태 | 근거 |
| --- | --- | --- |
| 문서·탭 전환 접힘 보존과 SSE 정리 | Matched | [workspace](../../src/widgets/planner-workspace/ui/workspace.tsx), [브라우저 테스트](../../tests/e2e/completion.spec.ts) |
| 참조 프로젝트·타입·버전·노드 검증 | Matched | [저장소](../../src/app/server/store.ts), [저장 테스트](../../tests/completion-store.test.ts) |
| 관계 이동·변경 안내·역사 읽기 전용 | Matched | [관계 UI](../../src/widgets/planner-workspace/ui/document-relations.tsx), [브라우저 테스트](../../tests/e2e/completion.spec.ts) |
| API·문서 버전 비교 | Matched | [비교 함수](../../src/entities/document/lib/compare.ts), [단위 테스트](../../tests/compare.test.ts) |
| Flow 노드 UI/MCP 편집·충돌·이력 | Matched | [순수 편집](../../src/features/flow-spec-syntax/lib/edit-tree.ts), [편집 테스트](../../tests/flow-edit.test.ts), [저장 테스트](../../tests/completion-store.test.ts) |
| Figma 파일·노드 원문 수집 | Matched | [Figma 경계](../../src/app/server/figma.ts), [Figma 테스트](../../tests/figma.test.ts) |
| Figma 오류·제한·중복 방지 | Matched | [Figma 테스트](../../tests/figma.test.ts), [저장 테스트](../../tests/completion-store.test.ts) |
| 현재 설계·실행 안내 정합성 | Matched | [설계 목차](../design/README.md), [README](../../README.md), 로컬 링크 검사 |

Overall Match Rate: 100% (위 8개 구현 항목: matched 8 / missing 0 / partial 0). 실제 외부 계정 검증 여부는 아래에서 별도 판정한다.

## 검증 결과

| 검사 | 결과 | 범위 |
| --- | --- | --- |
| test | PASS: 9개 파일, 87개 테스트 | 기존 저장·Flow·HTTP·카탈로그와 추가 비교·편집·Figma·참조 |
| lint | PASS | 전체 패키지 |
| typecheck | PASS | Next typegen + TypeScript |
| test:e2e | PASS: 10개 시나리오 | 생산 빌드 + Chromium, 전용 서버 127.0.0.1:54807 |
| 문서 로컬 링크 | PASS: 26개 문서, 150개 링크, 깨진 링크 0 | README, docs 전체 |
| Figma 실계정 API | SKIP | FIGMA_ACCESS_TOKEN 미설정; 실제 대상 파일 미지정 |

E2E는 소유한 임시 데이터 디렉터리와 임의의 빈 포트를 사용하고 종료 시 정리한다. 외부 Figma만 [전용 preload](../../scripts/e2e-figma.cjs)로 모의 처리하며 UI·HTTP·MCP·저장·SSE는 실제 코드로 실행한다. 테스트용 토큰은 가짜 값이며 기존 환경의 토큰을 사용하지 않는다.

브라우저 결과는 `playwright-report/index.html`에 생성된다(Git 제외). 첫 8개 시나리오가 통과한 뒤 편집 전체 동작과 HTTP/MCP 오류 검증을 추가했다. 추가 시나리오의 select 라벨 선택자가 옵션 텍스트까지 포함해 실패한 것을 실제 combobox 접근성 이름으로 수정하고 재실행했다.

## 영향 문서·스킬

- 현재 설계 01~10, 설계 목차, README, AGENTS, 변경 목차를 갱신했다. 0010에는 후속 링크만 추가하고 당시 결과를 보존했다.
- codebase-memory: 그래프 세대·경로·호출 경계를 확인하고 제외된 문서/테스트 및 변경된 소스는 직접 읽었다.
- apb-gap-analysis: 현재 설계 10을 기준으로 Matched/Partial/Missing을 비교했다. PGV gradate 문서는 사용하지 않았다.
- apb-unit-test-write: 정상·경계·실패·부수효과 보존을 단위/저장 테스트로 작성했다.
- apb-playwright-e2e: 브라우저 MCP가 없어 전용 Playwright에서 접근성 트리를 확인한 뒤 실제 UI/MCP 테스트를 실행했다.
- apb-validation-report: PGV 템플릿이 없는 저장소이므로 검증 항목·근거·SKIP·후속 작업 구조를 이 변경 기록에 적용했다. PGV 승인 상태를 주장하지 않는다.

## 후속 작업

- 실제 사용자는 패키지 `.env.local`에 file_content:read와 파일 접근 권한을 가진 FIGMA_ACCESS_TOKEN을 설정하고 재시작한다.
- 실제 Figma 파일/노드 링크로 UI 가져오기를 실행해 응답 버전·원문을 확인한다. 모의 응답 통과를 실계정 권한·네트워크 검증으로 간주하지 않는다.
- 사용자 인증은 요청에 따라 제외했다.

## 판정

CONDITIONAL PASS: 구현·단위/저장·브라우저·정적 검사는 모두 통과했다. 실제 Figma 계정의 토큰 권한과 대상 파일 접근 검증만 외부 설정이 없어 SKIP이며 위 후속 작업으로 남긴다. 자동 검증 실패는 없다.
