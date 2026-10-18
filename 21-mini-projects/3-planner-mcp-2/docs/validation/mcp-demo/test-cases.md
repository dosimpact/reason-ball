# MCP-only 종합 테스트 케이스

기준: master-requirement.md · SHA-256 d68bacd617c63f6d7a277266fab4cb9a80e6a1b85ebc031197099ba7b7ca6302

27개 요구사항 추적 그룹, MCP 41개 + 사람 확인 14개 = 총 55개. 케이스 연결은 요구 충족 판정과 다릅니다. MCP는 UI 조작·사람 확인·템플릿 원본 변경·서버 재시작을 증명할 수 없습니다.

## 요구사항 대응

| ID | 원본 위치 | 완료 조건 | 테스트 |
| --- | --- | --- | --- |
| R01 | 제품의 전체 흐름 / REQ-004·005 | 설계된 범위만 AI 구현·1차 검증, 사람의 최종 확인 | M01, M11, M12, M37, M41, H01, H13 |
| R02 | 도메인 기능 구분 / DEC-001 | 프로젝트·템플릿·문서·진행검증·AI 안내의 5개 도메인 | M01, M41 |
| R03 | 기본 기술 스택·구현 문서 | 지정 기술 스택, SQLite, FSD·SLAP·순수 규칙 | M37, H12, H14 |
| R04 | Project 주요 기능 Flow | 설계→구현→검증 기본 순서, 단계 index·노드, 좌/중/우 화면 | M04, H02 |
| R05 | Project 주요 기능 Flow | 노드 CRUD, 좌표 변경, 드래그, 하위 문서 subtree | M07, M16, H02 |
| R06 | 프로젝트 리스트 관리 | 프로젝트 CRUD, 설계검증·구현 문서 관리, REST/MCP 두 경로 | M03, M17, M20, M40, H07 |
| R07 | 템플릿 문서관리 / REQ-009 | 공용 메타와 진행 체크리스트를 Markdown과 분리, 항목별 관리 | M10, M12, M15 |
| R08 | 템플릿 문서관리 | 템플릿 조회·관리, 본문·예시·AI 작성 지침, 사람 수정 | M05, M20, H03, H05 |
| R09 | 템플릿 문서관리 / REQ-008 | 인스턴스 snapshot 불변, 원본 변경·삭제와 기존 문서 독립 | M06, H03 |
| R10 | 템플릿 문서관리 | Markdown·Mermaid, Notion 스타일 편집, 템플릿 미리보기 | M08, H04, H05 |
| R11 | extension list | React Flow/CodeWeave 복수 첨부, UI 추가·렌더링, MCP 작성 | M21, M22, M36, H05 |
| R12 | 문서의 도메인 규칙 | 문서 종류, 단계 index, 부모·자식 catalog와 조회 경로 | M04, M06, M07, M17, M19, M37, M38, H02 |
| R13 | 설계-검증 View/API/E2E | React 메타·Storybook, API 계약·Bruno, 브라우저 E2E 설계/사람검증 | M05, M37, H06, H07, H13 |
| R14 | AI 1차 검증 결과 / REQ-007 | AI와 사람 체크 분리, 결과 자식 문서 생성 및 동일 문서 재갱신 | M11, M12, M13, M38, H01 |
| R15 | 설계 변경 / REQ-006 | verified 설계 변경 시 reopen, 영향받은 체크만 초기화 | M14, H08 |
| R16 | overview / REQ-001·002·003 | 자유로운 비즈니스 계층, What/How, 선택 검증 링크, AI/사람 수정 | M09, M17, M18, H09 |
| R17 | AI MCP Interface 안내 | sidebar 안내, 실제 등록 도구 기반 자동 명세와 목차 | M02, M41, H10 |
| R18 | CodeWeave 목적·첫 버전 | 코드 큰 흐름 텍스트, 파싱·컴파일·트리·라인 조회·MCP 탐색수정 | M23, M29, H11 |
| R19 | CodeWeave 작성 규칙 | indent 부모자식, 진행/반환 화살표, 레이어에는 화살표 없음, 반환 깊이 유지 | M23, M24 |
| R20 | CodeWeave Prefix | 화살표→변경표시→자유 Prefix:→본문→주석 순서, 콜론 제외 타입 | M23, M25, M30 |
| R21 | CodeWeave Layer/diff | 레이어 귀속, (+)/(-)/없음, 초록/빨강과 기호, 원문 보존, 자동 비교·완료상태 없음 | M23, M25, M32, H11 |
| R22 | CodeWeave 주석 | inline/block 동시 사용, 줄바꿈·기호 보존, 원문 범위·귀속 노드 조회수정 | M26, M27, M31 |
| R23 | CodeWeave 문법 오류 | 잘못된 들여쓰기·중첩/미종료 주석 등 라인 포함 진단 | M28, M35 |
| R24 | CodeWeave 파싱·시각화 | 전체/가지 접기와 원문 불변, 라인/주석 클릭 상세·없는 속성 구분 | M24, M26, H11 |
| R25 | CodeWeave MCP | 문서 탐색·검색, 라인 내용/속성/주석 수정, 동일 파싱과 화면 반영 | M02, M29, M30, M31, M32, M33, M34, M35, M36, M41, H11 |
| R26 | CodeWeave 세부 계약 | 공백 2칸·주석 귀속·레이어 범위, snapshot line ID와 revision/source 충돌 | M15, M23, M28, M33, M34 |
| R27 | 저장·실시간 반영 | SQLite 보존·SSE 반영 및 REST/MCP 일관성 | M39, H07, H12 |

## MCP 실행

| ID | 요구 | 케이스 | 절차 | 기대 결과 |
| --- | --- | --- | --- | --- |
| M01 | R01, R02 | AI 작업 규칙과 5개 도메인 조회 | get_workflow_rules | 설계 선행·사람 확인 분리 규칙과 5개 도메인 |
| M02 | R17, R25 | 실제 도구 명세 조회 | tools/list | 24개 도구와 revision·CodeWeave 입력 스키마 |
| M03 | R06 | 프로젝트 생성·목록·조회·이름 변경 | create/list/get/update_project | 임시 프로젝트만 변경, 이름과 ID 재조회 일치 |
| M04 | R04, R12 | 단계 index와 기본 흐름 | get_project/list_flow_nodes | 3개 index/노드와 설계·구현·검증 순서 |
| M05 | R08, R13 | 템플릿 카탈로그와 전용 양식 조회 | list_templates/get_template | 본문·예시·prompt 및 View/API/E2E 체크리스트 존재 |
| M06 | R09, R12 | 템플릿 인스턴스와 문서 편집의 독립성 | create_document/update_document/get_template | snapshot 원본 일치, 문서 본문 수정이 템플릿에 영향 없음 |
| M07 | R05, R12 | 중첩 문서 생성·catalog 탐색 | create_document/get_document/list_documents | 부모·자식·손자 관계와 자식 조회 경로 |
| M08 | R10 | Markdown·Mermaid 원문 왕복 | update_document/get_document | 제목·표·체크 목록·Mermaid 문자열 그대로 보존; 렌더링은 H04 |
| M09 | R16 | Overview What/How와 자유 계층·검증 링크 | create/update/get_document | 계층·요약·nullable 검증 링크 저장 및 AI 재수정 |
| M10 | R07 | 정형 체크리스트 CRUD | add/update/delete_checklist_item | ID·순서·레이블 관리, 본문 체크표시와 독립 |
| M11 | R01, R14 | AI 결과 상태와 사람 확인 분리 | update_checklist_item/get_document | pending/passed/failed/skipped와 humanConfirmed=false, AI만으로 verified 금지 |
| M12 | R01, R07, R14 | MCP 사람 확인·verified 위조 거부 | 잘못된 update_checklist_item/update_document | humanConfirmed/status 임의 입력 거부 및 상태 보존 |
| M13 | R14 | AI 결과 자식 생성·재검증 갱신 | record_verification 두 번/get_document | 동일 결과 ID, 자식 1개, 본문 최신화 |
| M14 | R15 | 선택적 reopen 및 재검증 | reopen_document/update_checklist_item | 선택 A만 pending, B passed 유지; 사람 체크 true의 보존은 H08 |
| M15 | R07, R26 | 오래된 문서 revision 거부 | update_document/update_checklist_item/delete_document | 409 또는 MCP 오류, 새 본문/체크 보존 |
| M16 | R05 | 흐름 노드 CRUD·좌표 왕복 | create/update/list/delete_flow_node | 위치·연결 수정, 좌표 생략 보존, 임시 노드 제거 |
| M17 | R06, R12, R16 | 프로젝트 간 잘못된 참조 거부 | create_document/update_document/create_flow_node | 타 프로젝트 부모·검증링크·노드 연결 거부 |
| M18 | R16 | Overview 순환·중복·없는 부모 거부 | update_document | 잘못된 트리 거부, 기존 정상 트리 보존 |
| M19 | R12 | 문서 삭제·하위 cascade와 index 보호 | delete_document/get_document | 소유 임시 문서와 자식 제거, 단계 index 삭제 거부 |
| M20 | R06, R08 | 잘못된 입력·미존재 템플릿 거부 | create_project/create_document/get_template | 빈 이름·잘못된 phase·미존재 양식 오류 |
| M21 | R11 | React Flow와 CodeWeave 혼합 첨부 | create/update/get_document | 3개 확장·정형 그래프·원문 보존, 생략 유지, [] 제거 및 복원 |
| M22 | R11 | 확장 구조 유효성 | update_document | 중복 ID·잘못된 edge·버전·타입·10개 초과 거부 |
| M23 | R18, R19, R20, R21, R26 | 요구사항 CodeWeave 예시 전체 컴파일 | update_document/get_codeweave | 원본 예시의 layer/방향/depth/parent/Prefix/change 파싱 |
| M24 | R19, R24 | 레이어·반환 라인의 속성 | get_codeweave(line) | 레이어 direction/prefix/parent null, <- 라인 깊이 보존 |
| M25 | R20, R21 | 사용자 Prefix·diff와 완료 상태 비관리 | get_codeweave | 자유 Prefix와 (+)/(-) 보존, 구현 완료 필드 없음 |
| M26 | R22, R24 | 한 줄·멀티라인 주석 귀속 조회 | get_codeweave(line) | 주석 내부 모든 라인이 같은 노드, kind/range/newline 보존 |
| M27 | R22 | 주석 안 문법 기호는 텍스트 | update_document/get_codeweave | [Layer]/화살표/Prefix/변경기호가 추가 노드를 만들지 않음 |
| M28 | R23, R26 | CodeWeave 문법 오류 진단 | 잘못된 source update_document | 탭·홀수·깊이 건너뛰기·화살표/콜론 누락·변경중복·중첩/미종료 주석 오류 |
| M29 | R18, R25 | CodeWeave 본문·Prefix·레이어·주석 검색 | get_codeweave(query) | 한글 및 각 속성 검색 결과 |
| M30 | R20, R25 | CodeWeave 라인 속성 수정 | update_codeweave_node | text/prefix/direction/change 수정, 다른 확장 불변 |
| M31 | R22, R25 | 주석 수정·삭제 | update_codeweave_node | inline/block 수정과 줄바꿈 보존, null 제거 |
| M32 | R21, R25 | 레이어 이름 수정 | update_codeweave_node | 레이어 아래 노드 귀속도 새 이름 반영 |
| M33 | R25, R26 | CodeWeave stale source/revision 거부 | update_codeweave_node | 오래된 source 및 revision 거부, 최신 내용 유지 |
| M34 | R25, R26 | 원문 구조 교체와 snapshot ID | update_document/get_codeweave/update_codeweave_node | 새 노드의 line ID 재조회, 이전 snapshot 수정 거부 |
| M35 | R23, R25 | 잘못된 CodeWeave 속성 수정 거부 | update_codeweave_node | 공백 Prefix·빈 본문·레이어 방향·미존재 노드 오류 및 원문 불변 |
| M36 | R11, R25 | 확장 ID별 독립 탐색과 미존재 처리 | get_codeweave | 복수 CodeWeave 원문 구분, 없는/React Flow 확장에는 오류 |
| M37 | R01, R03, R12, R13 | 설계→구현→검증 문서 작성 | create/get_document | 기존 구현을 설명하는 구현 문서와 View/API/E2E 설계문서 연결 |
| M38 | R12, R14 | 검증 index의 설계검증·결과 catalog | get_document | 검증 index에서 설계문서와 결과 자식 모두 탐색 가능 |
| M39 | R27 | MCP 연결 재생성과 저장 재조회 | 새 MCP Client/get_document | body·extensions·revision 동일; 프로세스 재시작은 H12 |
| M40 | R06 | 임시 프로젝트 삭제·cascade | delete_project/get_project/get_document | 이번 실행의 임시 데이터만 삭제되고 데모·기존 프로젝트 유지 |
| M41 | R01, R02, R17, R25 | 등록 MCP 도구 전체 실행 증거 | 24개 tools/call 호출 기록 | 모든 등록 도구를 실제 호출, REST/DB 직접 접근 없음 |

## 사람 확인 대기

| ID | 요구 | 케이스 | 절차 | 기대 결과 |
| --- | --- | --- | --- | --- |
| H01 | R01, R14 | 사람의 최종 확인·AI 이전 확인 | UI에서 pending 항목 체크·해제, AI passed 항목 최종 확인 | 사람 확인 독립, 최종 조건 충족 때만 verified |
| H02 | R04, R05, R12 | 3패널·가로 흐름·문서 subtree·드래그 | 데모 프로젝트 선택 후 단계/자식 클릭·단계 노드 드래그 | 화면/상세 연동, 위치 새로고침 유지 |
| H03 | R08, R09 | 템플릿 관리·원본 변경/삭제 후 snapshot 유지 | 별도 임시 템플릿 UI 생성→인스턴스→원본 수정/삭제 | 본문·예시·prompt 편집 가능, 기존 문서/확장 snapshot 불변 |
| H04 | R10 | Notion 편집과 Markdown/Mermaid 미리보기 | 복제 문서에서 /블록·→/←·Tab·원문·미리보기 전환 | 서식/표/체크/Mermaid, 저장 후 동일 내용 |
| H05 | R08, R10, R11 | 템플릿 미리보기와 확장 추가 UI | 템플릿 미리보기 버튼·닫기, 복제 문서에 두 타입 확장 추가/제거 | 모달·렌더링·복수 확장 조작 정상 |
| H06 | R13 | View 최종 검증 (Storybook) | pnpm --filter planner-mcp-2 storybook → Planner stories | Props·이벤트·기본/빈/오류·키보드·모바일 확인 |
| H07 | R06, R13, R27 | API 최종 검증 (Bruno/REST) | 소유 테스트 환경에서 pnpm --filter planner-mcp-2 test:api | 상태코드·정상/실패 응답·정리, REST/MCP 일관성 |
| H08 | R15 | verified 변경 reopen·사람 체크 선택 해제 | 소유 문서 A/B 사람 확인→verified→본문 변경→AI에 A만 reopen 요청 | verified→reopen, A만 해제되고 B 사람 확인 유지 |
| H09 | R16 | Overview 항목 선택·사람 What/How 수정 | 업무 Overview 항목 선택·검증 링크 이동·요약 수정 | 자유 계층·What/How·검증 방법 UI 표시 |
| H10 | R17 | MCP 안내 페이지와 자동 명세 | sidebar AI MCP 안내 → 목차·검색·CodeWeave 스키마 | 실제 tools/list 24개와 표시 스키마 일치 |
| H11 | R18, R21, R24, R25 | CodeWeave 트리·diff·주석 상세와 원문 불변 | 전체/가지 접기·로직/주석 클릭·원문 편집 | 초록+·빨강-·없는 속성, 주석 숨김/표시, 접기로 원문 변경 없음 |
| H12 | R03, R27 | SQLite 재시작 보존·SSE | 소유 테스트 서버에서 재시작 후 조회; UI를 열고 MCP 문서 변경 | 디스크 저장 유지·UI 자동 반영; 이번 실행은 서버를 재시작하지 않음 |
| H13 | R01, R13 | 브라우저 E2E 최종 검증 | Playwright/Chrome CDP로 사용자 여정·오류·취소·새로고침 확인 | 사용자가 설계→구현→검증 catalog를 탐색하고 최종 확인 가능 |
| H14 | R03 | 기술 스택·FSD·SLAP 검토 | package.json·공용 설계·core 경계 확인 | 요구 기술 및 순수 core/IO 분리; MCP만으로 버전/구조 증명 불가 |
