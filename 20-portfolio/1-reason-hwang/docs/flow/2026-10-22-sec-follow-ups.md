# 2026-10-22 답변 후 추천 질문

- 요구사항 SEC-IUI-005: 모든 대화의 답변 후 hook처럼 LangGraph에서 LLM을 한 번 더 호출해 다음 추천 질문을 제공한다.
- 구현: 공시 그래프의 answer 뒤와 일반/확인 응답 그래프의 respond 뒤에 공통 after_answer를 연결했다. 내부 research 라우팅은 건너뛰어 최종 사용자 답변에 한 번만 생성한다. 구조화 출력 3개, 160자 제한, 중복/공백/직전 질문 반복 검증. 본문/최근 이력/현재 공시 문맥을 입력한다.
- 전송: 일반 JSON followUps와 SSE CUSTOM sec.follow-ups. 프런트는 답변별 추천을 표시하고 클릭으로 기존 send를 호출한다. 이전 턴/진행 중 버튼은 비활성화한다.
- 실패 정책: 추천 생성 30초 timeout 또는 오류는 추천만 생략하고 정상 본문을 유지한다. asyncio 취소는 전파한다. 추가 LLM 호출 완료 후 본문을 전달하므로 응답 지연이 늘어난다.
- stock: [도메인](../stock/us-corporate-filings/intelligent-ui.md#sec-iui-005-답변-후-추천-질문), [백엔드](../stock/tech-shared/3-langgraph-fast/sec-intelligent-ui.md), [프런트](../stock/tech-shared/1-fe-host/sec-intelligent-ui.md).
- 검증: 진행 중. 기존 사용자의 서비스와 Docker는 유지하며 작업 검증 브라우저만 종료한다.

## 검증 완료

- Python 20 PASS: 공시 그래프 after_answer 추가 1회 호출/추천 결과, 일반 답변 및 기업 없는 확인 답변 hook, 내부 research 분기 skip, 추천 실패 시 원래 답변 유지, 취소 전파 포함.
- 변경 Python Ruff/Pyright 0 errors. FE typecheck PASS, lint 0 errors/기존 media img warning 1건.
- Storybook 4 PASS: 기존 인용 토글 + 추천 클릭/이전 턴 비활성/추천 없음.
- Bruno 전체 기존·대화 API 10 requests/10 tests/10 assertions PASS. 추천 필드 검증 추가 후 04~07 재실행 4 requests/4 tests/4 assertions PASS: 일반 JSON과 공시 SSE의 3개 중복 없는 추천, ready 상태 확인. `/tmp/sec-followups-asserted-bruno.json`.
- Playwright fixture 4 PASS: 일반 추천 표시→클릭→다음 사용자 메시지→이전 턴 비활성, 공시 SSE 추천 표시, 기존 실패/재시도/중단 회귀. `SEC_LIVE_BASE_URL=http://127.0.0.1:2800 pnpm test:sec-chat:live --grep 'conversation:' --workers=1`.
- 실제 MCP/provider: “10-K는 어떤 문서야?” 답변 + 추천 3개 → 첫 추천 클릭 → 새 답변 + 새 추천 3개 → “애플의 사업 구조…” 실제 공시 답변 + 매출/세그먼트/경쟁우위·공급망 관련 추천 3개 확인. 모바일 390px 가로 넘침 없음. 증거 `.playwright-mcp/sec-followups-mobile.png`.
- 브라우저 오류는 기존 `/favicon.ico` 404 1건이며 채팅 오류는 없음. 10기업 전체 회귀/production build는 이번에 재실행하지 않았다.
- 기존 사용자 서비스 2800/2801/8000 및 Docker 유지. MCP 새 대화로 검증 공시 세션 종료 후 공식 browser_close 실행, 전용 브라우저/Playwright/Vitest 작업 프로세스 잔존 없음 확인. 기존 다른 프로젝트 미커밋 변경 보존. stock 동기화 완료.
