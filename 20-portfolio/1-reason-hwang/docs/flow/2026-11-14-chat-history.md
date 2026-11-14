# CHAT-HISTORY-001: /chat 대화 기록

- 날짜: 2026-11-14
- 요청: LangGraph에서 지원하는 대화 기록을 /chat에 연결.
- 설계: 기존 `/threads/search`, `/threads/{id}/state`를 SDK로 사용. 새 thread에 source=host-chat, graph_id, 첫 질문 제목을 metadata로 저장하고 선택한 그래프의 최신 50개만 조회. 서버 API·DB 스키마 변경 없음.
- UI: History · 대화 기록, 새로고침·로딩·빈 상태·오류, 선택한 대화 복원과 같은 thread로 이어쓰기. 새 대화/그래프 변경 시 메시지·SDK 입력 상태 초기화. 실행/복원 중 대화 전환 차단, 취소·새 요청 후 오래된 응답 무시.
- 복원: user/assistant 텍스트만 표시. tool 인자·결과·비공개 추론 제외. 저장 snapshot의 최신 presentation만 마지막 assistant에 붙임. 과거 turn별 차트는 보관 계약이 없어 복원하지 않음.
- 제한: 이전에 source/graph_id를 기록하지 않은 thread는 자동 분류하지 않으며 신규 History 목록에 표시하지 않음. PostgreSQL 설정 시 서버 저장 thread를 재시작 후 다시 조회할 수 있고 메모리 모드는 서버 재시작 시 소실. 계정/권한 정책은 기존 로컬 단일 사용자 범위를 유지.
- Stock: [Host OpenUI](../stock/tech-shared/1-fe-host/open-ui.md)와 [LangGraph 패키지](../stock/tech-shared/3-langgraph-fast/INDEX.md) 동기화 완료.
- 검증: 단위 API 어댑터·reducer 회귀, VAL-VIEW-001 Storybook, VAL-BROWSER-001 소유한 서버 및 Playwright MCP 사용자 흐름 확인. API는 기존 계약을 소비하여 서버 API 변경 검증 대상 아님. 실행 결과/정리는 아래 기록.

## 검증 결과

- `pnpm -C 1-fe-host test:chat`: 12/12 PASS. 메시지 역할/텍스트 block 정규화, tool·추론 제외, 최신 presentation, graph/source 필터·취소 신호, thread 복원 실패 시 기존 메시지 유지, SDK graphId 전달 회귀.
- `pnpm -C 1-fe-host exec vitest run --project storybook --maxWorkers=1 --no-file-parallelism src/_pages/chat/ui/ChatHistory.stories.tsx`: VAL-VIEW-001 3/3 PASS(목록 선택/현재 대화/새로고침, 로딩 비활성, 오류).
- `SEC_LIVE_BASE_URL=http://127.0.0.1:2993 pnpm -C 1-fe-host test:e2e --project=chromium tests/e2e/chat-history.spec.ts`: 1/1 PASS. 통제된 HTTP fixture에서 저장 메시지 복원→동일 thread 후속 SSE 답변→새 대화→새 thread metadata 확인. 실모델 호출 테스트와 구분.
- `pnpm -C 1-fe-host typecheck`, `pnpm -C 1-fe-host lint` PASS. 기존 media img ESLint warning 1건, FSD 오류 없음. 수정 파일 scoped ESLint도 PASS.
- VAL-BROWSER-001: 소유한 실제 Host 2993/FastAPI 2991에 Playwright MCP로 접속. API로 만든 in-memory fixture `history-check`/`history-other` 사용. History 목록 열기, 다른 graph 제외, 저장 메시지 선택 복원, 페이지 재접속 후 다시 열기 PASS. 후속 질문이 `/api/langgraph/threads/history-check/runs/stream`으로 POST되어 HTTP 200인 것을 network_requests로 확인. 모델 답변 내용/품질은 이 확인에서 검증하지 않음.
- 브라우저 증거: `.playwright-mcp/page-2026-11-14T12-00-12-269Z.yml`(복원), `page-2026-11-14T12-00-14-940Z.yml`(재접속 후 복원), `page-2026-11-14T12-01-11-061Z.yml`(후속 요청). console은 favicon 404 외 오류 없음.
- 재시도/수정: 현재 dev script의 고정 2983 때문에 첫 소유 Host 시작이 충돌하여 다른 listener는 유지하고 CLI `--port 2993`으로 재실행. 초기 browser locator가 숨겨진 OpenUI editor textarea와 중복되어 실제 Composer placeholder로 한정 후 재실행 PASS. 최초 CLI E2E가 새 thread metadata의 graph_id 누락을 발견: SDK가 metadata.graph_id를 graphId 옵션으로 덮어쓰므로 create에 graphId도 전달하도록 수정. 회귀 추가 후 단위 12개·E2E 재실행 PASS.

## VAL-CLEANUP-001

- FastAPI는 `--lifespan off`로 실제 앱의 기존 thread/state/run 라우트를 실행하여 DB 초기화·migration을 피했다. fixture는 이 프로세스 메모리에만 기록.
- 서버: FastAPI PID 96226/96239, Host 부모 96427/자식 96433, 포트 2991/2993. Ctrl+C 정상 종료 후 PID/listener 부재 확인.
- 소유한 별도 Playwright MCP PID 96707/97295는 각 시도 finally에서 browser_close 후 종료 확인. 기존 in-app Browser 연결 불가/공유 MCP 프로필 점유 때문에 별도 `--isolated --headless` MCP를 사용. 사용자 브라우저/공유 MCP 유지.
- Storybook·CLI Playwright runner 정상 종료, `.next-chat-history` 삭제 및 해당 tsconfig include만 제거. 동시 작업의 기존 validation include는 보존. 환경/비밀값/생성물은 커밋하지 않음.
- 관련 stock 링크와 scoped diff 공백 검사 PASS.
