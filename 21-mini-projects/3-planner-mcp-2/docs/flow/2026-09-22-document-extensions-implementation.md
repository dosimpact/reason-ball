# 문서·템플릿 React Flow 확장 구현

- 요청: 앞서 기록한 REQ-012를 실제 구현.
- 범위: 템플릿·문서 확장 목록, React Flow 렌더링/폼·드래그 편집, 저장·삭제, 기존 MCP create/update/get의 extensions 계약.
- 데이터: id/type/title/schemaVersion/data(nodes,edges). 최대 확장 10개, 노드 100개, 연결 200개. ID 중복·없는 연결 대상·비정상 좌표·지원하지 않는 버전 거부.
- 저장: JSON 데이터 필드로 추가, 기존 문서는 빈 확장 목록으로 취급. 템플릿 복사 독립성, 생략 시 보존, 빈 배열로 제거, revision 충돌·verified 변경 시 reopen 유지.
- UX: 문서/템플릿 저장 버튼으로 반영하며 미저장 이탈 보호를 재사용. 템플릿 미리보기에서도 렌더링. 원문 master-requirement.md는 보존.
- 이전 스펙 기록: [문서 확장 스펙](2026-09-22-document-extension-spec.md).
- 병행: 하위 문서 노드 파란 카드·FileText 아이콘, 단계 노드 FolderGit2 아이콘 구분.
- 검증: 진행 중.

## 완료 검증·배포

- 단위 9/9: 입력 검증, 템플릿 독립 복사, omission 보존, revision 충돌, 재시작 저장·제거 유지, verified 변경 시 reopen.
- production/Storybook 빌드, lint, typecheck 통과.
- Bruno HTTP 32/32 통과. 새 확장 생성·조회·수정, 잘못된 연결 거부, 오래된 revision 거부 포함. 초기 Bruno JSON 블록 들여쓰기 오류는 수정 후 전체 재실행했다.
- Playwright 전체 31/31 통과. UI 템플릿 추가/복사, 문서 편집/삭제, MCP 갱신→SSE 렌더링, 잘못된 MCP 입력 거부, 기존 29개 흐름 및 Storybook VIEW-07 포함.
- 추가 targeted 1/1: 템플릿 모달의 다이어그램, 노드 드래그 좌표 저장, 새로고침 유지 확인.
- 4000 서비스에 반영. 외부 HTTP 주소에서 확장 추가·저장·노드 렌더링·390px 가로 넘침 없음 확인. 검증 프로젝트 삭제 완료. 화면 크기 변경 직후 재마운트되는 화면을 기다린 뒤 모바일 확인했다.
- 시각 증거: `test-results/document-extension.png`, `/tmp/planner-extension-external-mobile.png`. 실행 기록: `/tmp/planner-extension-e2e.log`(빌드), `/tmp/planner-extension-bruno.log`, `/tmp/planner-extension-playwright.log`.
- 기존 사용자 문서·템플릿 데이터 일괄 수정 없음. 누락 extensions는 빈 목록으로 취급한다.
