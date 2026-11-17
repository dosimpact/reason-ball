# 2026-11-17 SEC 연구 채팅 선택 기업 수집 도구

- 요구사항: SEC-COLLECT-CHAT-001. 사용자는 SEC Intelligent Research Chat에서 기존 선택 기업 공시 수집 POST API를 tool calling으로 사용할 수 있도록 요청했다. 사용자 표기8q는8-K로 해석했다.
- 기존 문제: 도구 자체는 공통 목록에 있었지만 일반 대화의 수집 요청 및 기업 선택 흐름이10-K 준비로 제한돼 있었다.
- 변경: resolve에 collect 라우팅, 기업 선택의 pendingAction·years·since 보존, FastAPI collect endpoint와 Host proxy 허용 경로를 추가했다. 실제 호출은 기존 sync_sec_company_filings와 BFF company-filing-sync-jobs를 사용한다.
- BFF는 변경하지 않았다. 지원 수집 유형은10-K/10-Q/8-K와 정정본이며 개별 formType 필터는 없다. 기본2년·사용자 기간을 유지하고 완료된 수집 건수만 안내한다.
- 전체 기업 동기화·모델링 실행은 노출하지 않는다. 기존 공시 분석 세션과 원문 근거 답변은 유지한다.
- Stock: [SEC Intelligent Research Chat](../stock/us-corporate-filings/intelligent-ui.md#sec-collect-chat-001-선택-기업-공시-수집).

## 검증

- Playwright MCP: 소유 Host32983에서 통제된 resolve/collect 응답으로 기업 선택 → 수집 완료 안내 표시를 직접 확인했다.
- Playwright CLI: selected company collection 1건 PASS. 선택 CIK·years·since의 POST, prepare 미호출, 수집 실패 표시와 성공 답변 중복 없음 확인.
- 브라우저 검증은 통제된 fixture다. 실제 SEC 다운로드나 DB 변경을 수행했다고 주장하지 않는다. API 도구 연결은 별도 mock BFF 경계 검증을 사용한다.
- 적용 스킬: apb-bruno-api-tests, apb-playwright-e2e. 사용자 요청대로 브라우저 범위는 핵심1건으로 제한했다.
- Python·Bruno 및 최종 타입 검사 결과와 자원 정리는 아래에 기록한다.


## 최종 결과와 정리

- Python: `uv run pytest tests/test_sec_tools.py tests/test_sec_intelligent_ui.py -q` 43 PASS. 선택 기업·기간 고정, 반복 도구 호출의 중복 POST 방지, 완료 결과 검증, SSE 실패를 포함한다.
- Bruno: 소유 fixture38473에서 `bru run 28-sec-collection --env-var baseUrl=http://127.0.0.1:38473`,2요청·2테스트·2assertion PASS. 성공200과 원문 일부 실패502를 검증했다. 내부 BFF MockTransport는 실제 수집 endpoint 경로와 POST·선택 CIK를 검사한다. 모델 및 외부 SEC 연결은 fixture로 대체했다.
- Host: typecheck 및 변경 파일 ESLint PASS. Playwright1건 PASS, MCP 클릭 흐름 PASS. 화면 증거는 로컬 `1-fe-host/test-results/sec-collection.png`이며 Git 제외다.
- 정리: MCP browser_close와 CLI 종료 후 테스트 Chrome 잔존 없음. 소유 Host32983과 API fixture38473 종료·리스너 없음 확인. Uvicorn PID21135 종료. 소유 `.next-sec-collection`을 삭제하고 Next가 자동 변경한 next-env/tsconfig만 되돌렸다. 기존 사용자 서버는 유지했다.
- 수집 도구는 확인된 인자와 일치하는 요청을 한 번만 외부 POST한다. 재호출은 차단하며 실패를 완료로 바꾸지 않는다. since는 실제 날짜 형식까지 검사한다.
