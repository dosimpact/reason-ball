# Notion 스타일 Markdown 편집기

- 요청: master-requirement.md에 추가된 Notion 스타일 Markdown 편집 구현. 후속 피드백의 →/← 들여쓰기 표시와 규칙·예시도 적용.
- 선택: Tiptap 3 + Markdown/GFM 확장. 본문과 템플릿 본문·예시·AI 지침에 공용 편집기 적용. DB/API/MCP의 body 문자열 계약은 유지.
- 기능: 제목·목록·체크 목록·인용·표·코드·Mermaid, 인라인 서식, 슬래시 메뉴, undo/redo, →/← 목록 들여쓰기, 원문/미리보기 전환.
- 원문 보존: 변경하기 전에는 Markdown을 재직렬화하지 않음. HTML·각주 등 확장 문법은 원문 모드로 표시. 템플릿 snapshot·revision 충돌·미저장 보호 유지.
- 근거: [Tiptap Markdown](https://tiptap.dev/docs/editor/markdown/getting-started/basic-usage), [React 설치](https://tiptap.dev/docs/editor/getting-started/install/react). SSR 초기화는 immediatelyRender:false.
- stock: 문서 관리, 템플릿 관리. master-requirement.md는 수정하지 않음.
- 검증: 진행 중.

## 검증 중 수정

- 최초 브라우저 회귀에서 목록 변환 실패를 발견. 브라우저 오류의 `multiple versions of prosemirror-model`을 확인했고, 공유 lockfile의 호환 가능한 버전 두 개가 동시에 번들에 포함되는 것을 확인. 다른 프로젝트의 의존성을 변경하지 않도록 Next/Storybook에 공통 ProseMirror 모듈 alias를 적용함.
- 슬래시 명령의 원문 제거와 블록 변경을 하나의 편집 트랜잭션으로 묶음. 회귀 테스트에 목록 생성과 브라우저 오류 없음 확인을 추가.
- HTML이 포함된 코드 펜스는 정상 서식 편집 대상으로 유지하며, raw HTML·각주·frontmatter는 원문 모드로 보존.

## 최종 검증 및 배포

- lint·typecheck·Next 생산 빌드·Storybook 빌드 PASS. 단위 테스트 9/9, Bruno HTTP 32/32 PASS.
- Playwright 전체 35개 중 34개 PASS. 기존 노드 편집 시나리오 1개는 React Flow 노드 비표시로 timeout; 동일 빌드·독립 테스트 데이터에서 해당 시나리오를 두 번 연속 재실행하여 2/2 PASS. 최초 일시 실패를 숨기지 않고 남김.
- 신규 EDITOR-01/02·VIEW-08 PASS: 슬래시 제목/목록, →/← 버튼 및 Tab/Shift+Tab, Markdown 저장·새로고침, 표·체크 목록·Mermaid, HTML/각주 원문 보존. 브라우저 pageerror 없음.
- 스크린샷 검토에서 체크 항목 DOM의 data-checked 속성에 맞춰 스타일을 수정해 체크박스와 문장을 같은 줄로 정렬.
- 브라우저 MCP 미가용으로 Playwright Chromium 자동화를 사용. 소유 테스트 서버·임시 DB는 종료·정리.
- 프로젝트 소유 4000번 서비스만 재시작. 외부 http://dodonet.iptime.org:14000 에서 임시 문서 서식 편집·저장·API 재조회 및 모바일 390px 가로 넘침 없음 PASS. 임시 프로젝트 삭제 완료, 브라우저 오류 없음.
- 현재 stock 동기화: 통합 비즈니스/시스템 설계, 문서 관리, 템플릿 관리, 검증 문서. 사용자 master-requirement.md 원문은 유지.
