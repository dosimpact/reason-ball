# MCP-only 전 과정 데모 검증

- 사용자 요청: master-requirement.md 전체 요구를 테스트 케이스로 정리하고 MCP만으로 프로젝트 설계·구현·검증 문서와 데모를 작성/실행. 외부 UI에서 데모를 보존.
- 범위: 제품 데이터 읽기/쓰기는 실제 Streamable HTTP /mcp의 SDK tools/call만 사용. REST·SQLite·UI를 통한 데이터 변경이나 사람 확인 위조는 하지 않음. 기존 사용자 프로젝트는 보존하며 이번 실행의 임시 프로젝트만 정리.
- 전체 요구를 27개 추적 항목에 연결. MCP 41개 + 사람 확인 14개 = 55개 케이스. MCP만으로 관찰 불가능한 화면·Storybook·Bruno·사람 확인·원본 템플릿 변경은 MANUAL로 남김. 테스트케이스 존재와 요구사항 통과를 구분.
- 데모 주제: Planner MCP 2 자체의 설계/현재 구현/검증. 새 별도 서비스를 구현했다고 주장하지 않음.
- 증거: scripts/mcp-demo의 재현 스크립트·케이스 정의, docs/validation/mcp-demo의 요구사항 매핑·호출 기록·요약, MCP로 작성한 프로젝트 검증 문서.
- 실행 결과: 진행 중.

## 실행 완료

- 외부 MCP endpoint에 실제 SDK로 연결, 등록 도구 24개 모두 호출. tools/list 포함 582회 기록.
- MCP 41/41 PASS, FAIL 0, HUMAN 14 MANUAL. 사람 확인은 전체 false로 재조회 확인.
- 데모: http://dodonet.iptime.org:14000/projects/2a60a9e7-71ce-4d8d-9913-ea971497c2d2
- 설계·구현·검증 문서 28개 보존. 임시 프로젝트 삭제 및 기존 프로젝트 메타데이터 보존 확인.
- 원문 요구사항 SHA-256: d68bacd617c63f6d7a277266fab4cb9a80e6a1b85ebc031197099ba7b7ca6302 (파일 수정 없음).
- 호출 로그: test-results/mcp-demo/2026-09-21T16-13-05-908Z/calls.jsonl (Git 제외), SHA-256 c7f73680d96dd522722d27b89b1e19a4b455f0d7efcbf011fedbf8707b73158b.
- M02/M41은 신규 호출 없이 사전 tools/list/누적 증거를 검사했다. 최초 보고의 역전된 호출 범위를 실제 참조 범위로 바로잡고 MCP record_verification으로 동일 결과 자식을 갱신했다. 판정 변화 없음.
- 실행기 구문 검사와 ESLint 확인. 원본 애플리케이션 소스와 사용자 작업 중인 workspace-panels.tsx는 수정하지 않음.
- 영향 stock: ai-workflow/INDEX.md, tech-shared/planner-mcp-2/implementation.md. 검증 문서 지도에 케이스/결과/재실행 안내 연결.
- 최종 한계: 전체 요구사항의 최종 통과는 미판정. UI·Storybook·Bruno·원본 템플릿 변경·사람 체크·재시작/SSE는 H01~H14 확인이 필요하다. 과거 통합 테스트 결과를 이번 MCP-only 실행 결과로 재사용하지 않았다.
