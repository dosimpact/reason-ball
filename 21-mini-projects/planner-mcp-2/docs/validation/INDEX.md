# 핵심 구현 검증

- E2E-01: 빈 저장소에서 프로젝트 생성 → 단계 index와 노드 확인 → 이름 변경·삭제.
- E2E-02: 템플릿 생성 → 문서 인스턴스 생성 → 원본 템플릿 수정 후 기존 문서 유지.
- E2E-03: MCP가 설계 조회·체크리스트 작성·AI 결과 기록 → 브라우저에서 결과와 자식 문서 확인.
- E2E-04: 사람 확인 → 두 항목 중 하나 reopen → 영향 없는 항목 유지.
- E2E-05: 재검증 결과 기록 → 동일 자식 문서 갱신, 중복 없음.
- E2E-06: 오래된 revision, 잘못된 입력·참조, 다른 프로젝트 문서 연결, MCP 사람 확인 위조 거부.
- E2E-07: Overview 편집·검증 링크, 노드 변경, SSE 갱신, 재시작 후 SQLite 보존.
- VIEW-01: 공통 체크리스트·문서 viewer를 Storybook에서 상태별 확인.

Bruno 실제 HTTP와 MCP SDK, Playwright Chromium은 소유 서버·임시 DB로 실행합니다. 실행 결과는 docs/flow에 기록합니다.

## 최종 결과

단위·저장·CodeWeave 회귀 34/34, Bruno 실제 HTTP 41/41, MCP·브라우저·Storybook·재시작 통합 37/37 PASS. lint·typecheck·생산 빌드·Storybook 빌드·CodeWeave standalone ESM 검사 PASS. 최신 증거: [CodeWeave 확장 통합](../flow/2026-09-22-codeweave-extension.md).

[구현 및 검증 증거](../flow/2026-09-21-core-implementation.md)에 요구사항별 대응과 브라우저 MCP 연결 한계를 기록했습니다.

## UI 피드백 회귀

- UI-01: 경계 드래그·키보드 조절·최소 너비, 좁은 화면 전환 중 입력 보존.
- UI-02: React Flow 노드의 둥근 카드 스타일.
- UI-03: main 스크롤 시 sidebar 위치 유지, sidebar 스크롤 시 main 위치 유지, 모바일 페이지 가로 넘침 없음.
- UI-04: 버튼 클릭 전 미리보기 비표시, 모달 본문·예시·Mermaid, Esc·닫기·배경 클릭 및 포커스 복귀.
- VIEW-02: Storybook에서 크기 조절 패널과 미리보기 모달 확인.

## MCP 안내 검증

- REQ-010: sidebar 링크 → `/mcp-guide`, 표시된 모든 입력 스키마와 실제 HTTP MCP tools/list 일치, 검색·빈 결과·새로고침·모바일 확인.
- VIEW-03: Storybook 도구 목록·필수 입력·JSON Schema 펼치기·빈 목록.
- UI-03 확장: 프로젝트 목록 스크롤 시 하단 MCP 안내 링크 위치 고정.

- UI-05: 단계 노드의 가로 기본 배치, 드래그 후 저장·새로고침 유지, 저장 실패 시 위치 복원. Bruno에서 좌표 저장·생략 시 보존·잘못된 좌표 거부 확인.

- UI-06: 상세 패널 닫기 → 캔버스 전체 너비·핸들 숨김 → 다시 열기, 미저장 편집 내용·기존 너비·포커스 복원, 모바일 닫기/열기. VIEW-02에서 동일 상태 보존 확인.

- VIEW-04: Storybook index 진행 체크리스트 독립 섹션, 항목 있음/없음, 추가 기능 포함 및 하위 문서 카탈로그 분리.

- HUMAN-01: AI pending에서 사람이 체크·새로고침·해제 가능. failed/skipped/pending/passed와 사람 확인은 독립 유지. 항목 설명 변경/reopen 초기화와 MCP 사람 확인 위조 거부는 유지.

## UX 개편 검증

- UX-01: index → 하위 생성 Dialog의 위치 → 생성 문서 parentId/phase → 부모 이동 → 미저장 취소/버리고 이동.
- VIEW-05/06: GitHub 팔레트와 공용 Tabs/Dialog 키보드·포커스, 하위 카탈로그 CTA 우선 배치.
- UI-06 확장: 닫힌 상세 패널에서 다른 문서를 선택하면 자동 복원. 기존 독립 스크롤·드래그·모달·사람 확인 회귀 유지.

- UX-02: 템플릿 선택/신규 전환과 화면 이동 시 미저장 변경 확인, 취소 시 초안 보존, 버리기 시 전환.

- UX-03: `/mcp-guide`에서 템플릿 편집 후 MCP 안내로 돌아갈 때 미저장 변경 확인과 독립 URL 간 화면 전환.

- VIEW-03 확장: MCP 목차 기본 접힘·펼치기·앵커 이동·검색 결과 연동·빈 목록 숨김.

- URL-01: 주요 메뉴 링크의 href·활성 상태, 화면별 새로고침, 뒤로/앞으로 가기, 로고 홈 복귀.

- FLOW-01: 단계별 문서 및 중첩 parentId 연결, 문서 클릭 상세 이동, SSE 생성·삭제 갱신, 기존 단계 드래그 저장 유지.
- TEMPLATE-01: 전용 View/API/E2E 양식 UI 선택·문서 생성·본문과 snapshot·체크리스트 3개 및 AI pending/사람 미확인 초기 상태. 삭제한 전용 양식의 서버 재시작 후 미복원.

## 문서 확장 검증

- EXT-01 / REQ-012: 템플릿 확장 초기값 복사 → 문서에서 React Flow 다이어그램 표시 → 문서 관리에서 추가 → MCP 수정 → UI 재조회 일치.
- EXT-02: 원본 템플릿 변경 시 기존 문서 확장 불변, 잘못된 노드/연결/좌표 거부, revision 충돌, 검증 완료 문서의 확장 변경/reopen 처리.

- VIEW-07: Storybook 확장 다이어그램 렌더링/빈 상태. 실제 MCP 갱신 → SSE 표시, UI 편집·삭제, 템플릿 독립성, 저장·재조회·재시작 검증.

- URL-02: 프로젝트 클릭·생성의 `/projects/:id` 바인딩, 직접 접속·새로고침·뒤로/앞으로 가기 복원, 다른 메뉴에서 선택 프로젝트 복귀, 삭제·없는 ID의 루트 복귀.

- EDITOR-01: 슬래시 메뉴→제목/목록, →/← 중첩, Markdown 저장·새로고침 유지, 체크 목록·표·Mermaid 서식 편집/미리보기.
- EDITOR-02: HTML/각주 등 원문 모드에서 제목만 수정 시 본문 보존. 기존 revision 충돌·외부 갱신·미저장 이동 보호는 원문 모드와 함께 회귀.
- VIEW-08: Storybook 서식 블록 렌더링·원문 전환·Mermaid 미리보기.

## CodeWeave core (CW-01~04)

프레임워크 독립 core만 변경하는 단계는 공개 API 단위 테스트·기존 회귀·lint·typecheck·standalone 빌드/import로 검증한다. UI·HTTP·MCP adapter는 이번 단계의 변경 대상이 아니므로 브라우저·Storybook·Bruno는 적용하지 않는다. 연결 단계에서 해당 검증을 수행한다. [설계 및 검증 범위](../stock/codeweave/INDEX.md), [실행 기록](../flow/2026-09-22-codeweave-core.md).

편집기 변경의 최신 실행 결과와 일시적 노드 표시 실패·재실행 이력은 [Notion 편집기 검증 기록](../flow/2026-09-22-notion-markdown-editor.md#최종-검증-및-배포)에 있습니다.

- CW-05: 템플릿에서 React Flow+CodeWeave 혼합 생성 → 미리보기 → 독립 문서 인스턴스 → 접기/펼치기·라인/주석 상세 → MCP 조회·수정 → SSE 재렌더링.
- CW-06: 문법 오류 저장 거부, expectedRevision/expectedSource 충돌, 다른 확장 보존, 템플릿 snapshot 독립, 검증 완료 문서 reopen.
- VIEW-09: Storybook CodeWeave diff 색상·기호, 주석 라인 소유권, 전체/가지 접기, 소스 불변.

## MCP만 사용하는 종합 데모

[요구사항 전체 대응 및 실행 결과](mcp-demo/INDEX.md): 실제 MCP 24개 도구로 설계·기존 구현 설명·검증 문서를 작성한 보존 데모입니다. 41개 MCP 검사 PASS, 14개 사람 확인 대기. UI·Storybook·Bruno·원본 템플릿 변경·사람 확인은 MCP 통과 결과에 포함하지 않습니다. 이전 통합 검증 결과와 이번 실행의 증거를 구분합니다.
