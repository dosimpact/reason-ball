# 단계별 하위 문서 트리

- 요청: 설계·구현·검증 각 노드의 하위 문서를 React Flow subtree로 표시.
- 구현: 단계의 가로 배치를 유지하고 parentId 기반 문서 트리를 아래로 배치. index 중복 표시 없음. 문서 클릭으로 상세 이동, 단계 이동에 트리 동행, 구조 변경 시 fitView.
- 문서 노드는 자동 배치, 단계 좌표만 기존 계약으로 저장. 사용자 데이터 마이그레이션 없음.
- stock: 프로젝트 관리.
- 검증: 진행 중.

## 완료

- 중첩 트리 연결·클릭·추가/삭제 갱신·단계 드래그 회귀 통과. `test-results/document-subtrees.png` 시각 확인.
- 통합 검증: Next/Storybook 빌드, lint, 단위 6/6, Bruno 25/25, Playwright 29/29 통과.
- 4000번 서비스 반영. 실행 로그 `/tmp/planner-subtrees-templates-e2e.log`.
