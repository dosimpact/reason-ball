# 2026-10-22 SEC Behind the scenes

- 요구사항 SEC-IUI-006: 현재 자유 대화/공시 분석에도 OpenUI Behind the scenes 방식의 실행 타임라인 적용.
- 결정: 자체 SecChat/Renderer 구조를 유지하고 ActivityTimeline을 구현한다. OpenUI AgentInterface 원본 컴포넌트를 도입한 것은 아니다. 실제 LangGraph 노드 이벤트와 HTTP 요청 관측만 표시한다.
- 변경: tracked_node → 상태 큐 → CUSTOM sec.activity → 프런트 턴별 타임라인. resolve는 Accept SSE로 실시간 노드 상태와 sec.resolution을 받고 기존 JSON API는 보존한다. chat은 기존 AG-UI 본문/추천 이벤트 전에 노드 진행을 전달한다. 프록시는 Accept 전달.
- 실패 경계: 노드 실패/요청 실패/사용자 중단/추천 unavailable을 구분한다. 취소 시 aclosing으로 생성 작업을 취소하고 기다린다. 상태 데이터에는 프롬프트/원시 응답/추론을 넣지 않는다.
- UX: Working은 열림, 완료 후 Behind the scenes 접힘, 수동 펼침/접힘. 이전 턴 실행 기록 보존. 원문 답변 및 추천 질문은 기존 계약 유지.
- stock: [도메인](../stock/us-corporate-filings/intelligent-ui.md), [백엔드](../stock/tech-shared/3-langgraph-fast/sec-intelligent-ui.md), [프런트](../stock/tech-shared/1-fe-host/sec-intelligent-ui.md).
- 자원: 작업 시작 시 2800/2801/8000 서비스는 종료 상태였고 Docker DB/모델 프록시는 실행 중이었다. 사용자 서비스 실행 요청을 이어 FE/BFF/Python을 기존 pnpm dev로 재시작했다. launcher PID 51054/51052/51053, 로그 /tmp/sec-timeline-{1-fe-host,2-bff-apps,3-langgraph-fast}.log. 사용자가 접속할 서비스는 유지하고 작업 브라우저만 종료한다.

## 최종 검증

- Python `pnpm test:sec-chat`: 22 PASS. 실제 시작/종료 순서, 완료 전 시작 이벤트 전달, 제한된 상태 payload, 오류/추천 unavailable, 연결 종료 시 task 취소 회귀 포함.
- 변경 Python Ruff/Pyright 0 errors. FE typecheck PASS, lint 0 errors/기존 media img warning 1건.
- Storybook 8 PASS: 인용/추천 기존 4개 + 타임라인 완료 토글/진행/실패/중단 4개.
- Bruno 실제 HTTP/provider: 11 requests / 11 tests / 11 assertions PASS. JSON 호환, 공시 4개 노드의 시작/완료, 일반 대화 2개 노드의 시작/완료, 답변 전 이벤트 순서와 제한된 payload 확인. `/tmp/sec-timeline-bruno.json`.
- Playwright HTTP fixture: 5 PASS. 기존 대화/추천/기업 선택/오류 복구/중단 회귀 + 타임라인 완료 후 접힘·수동 펼침·실패 기록·이전 턴 유지. 최초 실패는 중첩 보조 라벨을 포함한 요소에 exact text locator를 사용한 테스트 오류였고 실제 DOM 기준 locator로 수정했다.
- 실제 MCP/provider: 일반 10-K 개념 대화 완료 3개 활동, Apple 질문에서 Working 상태의 Item 선택을 실제 관찰, 최종 7개 완료 활동을 펼쳐 확인. 공시 원문 링크/추천 유지. 모바일 390px 가로 넘침 없음. `.playwright-mcp/sec-timeline-mobile.png`.
- 콘솔은 기존 favicon.ico 404 1건, 채팅 오류 없음. production build 및 10기업 전체 회귀는 재실행하지 않았다.
- stock/문서 지도 동기화, git diff --check 통과. 기존 형제 6-7 작업 보존.
- 자원: MCP 새 대화로 검증 세션 닫기 → 공식 browser_close. 검증 브라우저/Playwright/Vitest 프로세스 잔존 없음 확인. 사용자 접속용으로 재시작한 서비스 2800/2801/8000과 기존 Docker는 유지한다.
