# CodeWeave 문서 확장 연결

- 요청: 이미 구현된 독립 core를 문서·템플릿 extension list와 UI·MCP에 연결.
- 결정: type=codeweave, schemaVersion=1, data.source 원문 저장. React Flow와 혼합하여 최대 10개, CodeWeave 원문 최대 50,000자. 파싱 오류는 UI에서 라인별 표시하고 저장 시 거부.
- UI: 원문 편집, Tree View 전체/가지 접기·펼치기, diff 색상/기호, 주석 포함 라인 선택·상세. 템플릿 복사와 미리보기 재사용.
- MCP: get_codeweave로 컴파일·검색·라인 정보 조회, update_codeweave_node로 속성·주석 수정. expectedRevision과 expectedSource로 stale line ID 방어. 구조 변경·여러 확장 관리는 기존 create_document/update_document 사용.
- REST: GET/PATCH documents/:id/codeweave/:extensionId. 동일 서버 어댑터·저장소를 사용하며 SSE/reopen/템플릿 snapshot 정책 유지.
- 검증 예정: 혼합 확장 복사·보존, 파싱 오류·revision/source 충돌, MCP 수정→UI SSE, Tree/diff/주석·미리보기, API Bruno 및 Storybook.
- core 파일은 변경하지 않음. 그래프 MCP 미가용으로 공개 API와 실제 소비 소스를 읽어 확인.

## 구현 중 확인

- core의 `.js` ESM import를 Turbopack이 TS 원본으로 해석하지 못해 Next에서 독립 build:codeweave 산출물을 사용하도록 연결. core 소스는 유지하고 dev/build 스크립트에 선행 빌드를 추가.
- 원본 요구사항에 CodeWeave 제목이 확장 목록에도 등장하면서 기존 core 테스트가 잘못된 구간을 읽던 문제를 섹션 제목의 줄 경계로 수정.
- 실제 브라우저에서 주석 행→원래 로직 선택, 전체 접기→레이어/가지 부분 펼치기를 확인. 공통 버튼 CSS보다 CodeWeave diff 행 스타일이 우선하도록 보정.
- 공유 lockfile은 다른 프로젝트 변경이 섞여 있어 현재 프로젝트 importer와 필요한 누락 package/snapshot만 HEAD에 추가한 버전을 커밋 대상으로 구성. 기존 importer/package/snapshot 불변을 검사하고 임시 workspace의 offline frozen-lockfile 검사 PASS. 작업 트리의 다른 프로젝트 lock 변경은 유지.

- 기존 React Flow 노드 수정 회귀에서 간헐적 비표시가 재현됨. 매번 새 controlled node 객체를 전달하면서 dimensions 이벤트를 무시하여 `measured`가 초기화되는 원인을 설치된 React Flow 소스로 확인. 공용 useFlowMeasurements로 단계·하위 문서·첨부 다이어그램의 측정 크기를 보존하여 수정함. DB에는 표시용 크기를 저장하지 않음.

## 최종 검증·배포·커밋 범위

- 단위 테스트 34/34 PASS, core standalone ESM 검증 PASS, lint·typecheck·Next 생산 빌드·Storybook 빌드 PASS.
- Bruno 실제 HTTP 41/41 PASS. CodeWeave 혼합 생성·탐색·라인 수정·revision/source 충돌·문법 오류 거부·다른 확장 보존 포함.
- Playwright Chromium 전체 37/37 PASS. CW-05/06, VIEW-09와 기존 Markdown·다이어그램·MCP 명세·인스턴스 독립성·SSE·재시작·노드 수정 회귀 포함. 브라우저 MCP 미가용으로 기존 Chromium 자동화를 사용.
- 4000번 프로젝트 소유 서비스를 재시작. 외부 dodonet.iptime.org:14000 에서 UI로 CodeWeave 추가·저장, 12개 노드 표시, 주석 행 조회 및 REST 파싱 결과를 확인. 임시 배포 확인 프로젝트는 삭제함.
- 사용자 요청에 따라 planner-mcp-2 전체 소스·설계·검증 파일과 해당 importer/필요 의존성을 커밋. .env.local·SQLite·빌드/테스트 출력은 제외하고, 다른 프로젝트 변경은 유지.
