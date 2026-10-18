# 가로 단계 흐름과 노드 이동

- 날짜: 2026-09-21
- 요청: 기본 설계 → 구현 → 검증을 가로 배치하고 노드를 드래그하여 이동.
- 설계: 좌표 미지정 노드는 왼쪽에서 오른쪽으로 배치하고 연결 핸들을 좌/우로 지정. 선택 coordinates {x,y}를 기존 노드 JSON에 저장하여 새로고침 후 이동 위치 유지. position은 기존 순서 의미 유지. 드래그 중 로컬 좌표를 우선 표시하고 드롭 시 저장. 저장 오류 시 오류 표시·서버 위치 복원.
- 호환: 기존 노드는 마이그레이션 없이 가로 기본값 적용. 기존 REST/MCP 호출은 coordinates 생략 가능, 수정 시 저장 좌표 유지.
- 영향 stock: 프로젝트 관리, 시스템 설계, MCP·REST 계약.
- 검증 계획: 가로 기본 배치, 드래그 및 새로고침 유지, HTTP 좌표 저장/입력 거부, 기존 UI/MCP 회귀.
- 상태: 구현·검증·4000번 배포 완료.
- 검증: typecheck·lint PASS. `pnpm test:e2e` production/Storybook build PASS, Bruno HTTP 23/23, Playwright UI·MCP·Storybook 17/17 PASS.
- UI-05: 가로 초기 배치, 드롭 좌표 저장, 재조회 유지, 강제 저장 실패 시 오류와 좌표 복원 확인. 브라우저 CSS 소수점 직렬화는 0.01px 오차 이내로 검증.
- 외부 확인: http://dodonet.iptime.org:14000 에서 임시 프로젝트의 가로 배치와 드래그 저장 PASS, 확인 후 임시 프로젝트 삭제. test-results/horizontal-flow-deployed.png.
- 스킬: apb-playwright-e2e, apb-bruno-api-tests. 기존 브라우저 MCP 연결 불가 상태에서 standalone Playwright로 검증. 원본 요구사항 수정 없음.
- 참고: https://reactflow.dev/api-reference/react-flow, https://reactflow.dev/api-reference/types/node
