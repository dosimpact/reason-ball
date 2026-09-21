# MCP-only 데모 실행 결과

실행: 2026-09-21T16-13-05-908Z

**PASS 41 / FAIL 0 / 사람 확인 대기 14**

- 등록된 MCP 도구 24개 실제 호출
- 요구사항 27개 추적 그룹, 케이스 55개
- 데이터 작성·수정·삭제·조회는 MCP만 사용
- 원본 요구사항과 기존 사용자 프로젝트 보존
- 임시 테스트 프로젝트 삭제, 이 데모 프로젝트 유지
- 사람 확인은 모두 미확인. 전체 요구사항의 최종 충족 판정은 보류

## 보는 순서

1. 설계 → 비즈니스 Overview → 5개 도메인 및 View/API/E2E 설계
2. 문서 관리 하위의 확장 예시 → React Flow와 CodeWeave
3. 구현 → 기존 구현 구조 → 저장 경로와 테스트 실행기
4. 검증 → 전체 케이스 → 4개 그룹별 체크리스트 → AI 결과 자식
5. 사람은 H01~H14의 실제 화면/Storybook/Bruno 검증 후 확인 체크

## 실행 증거

test-results/mcp-demo/2026-09-21T16-13-05-908Z/calls.jsonl

프로젝트: http://dodonet.iptime.org:14000/projects/2a60a9e7-71ce-4d8d-9913-ea971497c2d2

MCP로 시각적 렌더링, 사람 체크, 템플릿 원본 관리, 서버 재시작을 시험할 수는 없습니다. 대응 HUMAN 케이스에 절차와 기대 결과를 기록했습니다.

최종 호출 수: 582 · 보존 문서 수: 28

## MCP 호출 증거

원문 SHA-256: c7f73680d96dd522722d27b89b1e19a4b455f0d7efcbf011fedbf8707b73158b

| 도구 | 호출 수 | 예상 오류 응답 |
| --- | ---: | ---: |
| add_checklist_item | 57 | 0 |
| create_document | 29 | 3 |
| create_flow_node | 2 | 1 |
| create_project | 3 | 1 |
| delete_checklist_item | 5 | 0 |
| delete_document | 3 | 2 |
| delete_flow_node | 1 | 0 |
| delete_project | 1 | 0 |
| get_codeweave | 33 | 2 |
| get_document | 302 | 9 |
| get_project | 3 | 1 |
| get_template | 6 | 1 |
| get_workflow_rules | 2 | 0 |
| list_documents | 4 | 0 |
| list_flow_nodes | 3 | 0 |
| list_projects | 3 | 0 |
| list_templates | 1 | 0 |
| record_verification | 7 | 0 |
| reopen_document | 1 | 0 |
| tools/list | 1 | NaN |
| update_checklist_item | 64 | 2 |
| update_codeweave_node | 12 | 7 |
| update_document | 36 | 19 |
| update_flow_node | 2 | 0 |
| update_project | 1 | 0 |

예상 오류 응답은 오류 거부 시험에 포함되며 테스트 실패 수와 다릅니다. tools/list 1회를 포함한 전체 호출 기록은 582개입니다.
