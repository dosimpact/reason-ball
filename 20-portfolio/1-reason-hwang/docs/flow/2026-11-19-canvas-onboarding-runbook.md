# Canvas A–Z HTML 온보딩 런북

- 날짜: 2026-11-19
- 결정: CANVAS-ONBOARD-001
- 요청: 사용자가 지정한 human-docs/3.dynamic-canvas-openui 아래에 친절한 시각적 HTML 설명서 작성. 해당 새 HTML 생성에 한해 human-docs 금지 예외를 적용. goal.md와 다른 기존 human-docs 원문은 보존.
- 산출물: [canvas-system-onboarding-runbook.html](../human-docs/3.dynamic-canvas-openui/canvas-system-onboarding-runbook.html). 외부 폰트·CDN 없는 단일 HTML, A–Z 26개 주제, 검색 목차, SVG 화면도·흐름도, 설명용 클릭 시뮬레이터, 코드 링크, 실습·운영 명령·문제 해결표·인쇄 스타일.
- 근거: 현재 ChatPage/PinnedCanvas/pinnedCanvas/CanvasSplitter/OutputView/추출기/금융 블록, Canvas workflow/presentation/shared composer, runtime·시작가이드·stock·기존 검증 기록을 대조. sol 서브에이전트는 읽기 전용 사실 검토.
- 설명 경계: 반복 추가 허용이 기존 goal의 중복 금지보다 나중 결정. 원래 서버 근거와 로컬 배치 및 최신 Query 결과를 구분. 메모리/PG 체크포인트 보존 조건, source ID/패널 UUID, 모바일900/600px 구분, 공유·정적 과거 재현 미구현을 표시. 실제 서비스 상태·외부 시세를 새로 검증했다는 주장 없음.
- Stock: [기술적 분석 시스템 설계](../stock/technical-analysis/system-design.md#canvas-onboard-001-온보딩-런북)에 연결, docs/INDEX.md에 진입 링크 추가.

## 검증

- Python HTMLParser:26 section, 중복 id 없음, 모든 로컬 링크/앵커 유효. node --check inline script PASS.
- Playwright MCP, owned HTTP 서버39876 및 isolatedContext canvas-runbook-review로 HTML을 열어1440×1000/390×844 렌더링 확인. 데스크톱·모바일 스크린샷을 실제 확인. 검색 결과 필터, 시뮬레이터 추가/조회/모델 작업 카운터·초기화, 인쇄 시 목차 숨김 PASS. 가로 넘침 없음. pageerror0.
- 최초 검색 hidden 속성이 nav display 규칙에 가려진 문제 발견 → [hidden] CSS 명시 후 재검증 PASS. favicon을 data URI로 처리해 불필요한 요청 제거.
- 증거: .tmp/canvas-runbook/desktop.png, mobile.png, simulation.png. 문서 자체 검증이며 Canvas 제품 회귀·외부 API 검증은 아님.
- 정리: owned MCP context를 닫고 HTTP 서버 functions session36650을 Ctrl-C로 종료.39876 포트 및 프로세스 잔존 확인 후 완료. 기존 앱·사용자 브라우저·공유 MCP는 보존.
