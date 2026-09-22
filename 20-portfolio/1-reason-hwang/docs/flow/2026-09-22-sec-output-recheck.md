# SEC Inline / Canvas 요청 재확인

날짜:2026-09-22. 요구사항:SEC-A2UI-11. 사용자가 이전 제안인 Inline 새 화면/Canvas 고정 화면의 구현 및 브라우저 검증을 다시 요청했다.

## 현재 구현 대조

작업 시작 working tree는 clean. 구현은 `1d21aa6`, UX 보완은 `7a05732`에 이미 포함되어 있었다. `agent_tools.surface_update`에서 자연어 Inline 렌더링마다 UUID를 만들고, Canvas는 thread의 canvas_surface_id를 재사용하며, action은 발신 surfaceId와 저장된 context를 사용한다. 같은 sec_a2ui graph와 도구를 사용한다. 현재 계약은 [SEC-A2UI-11](../stock/tech-shared/a2ui-system/sec.md#sec-a2ui-11-inline-이력과-고정-canvas)을 따른다. 도움말처럼 렌더 도구를 호출하지 않는 텍스트 답변에는 surface를 만들지 않는다.

빠진 런타임 구현은 발견하지 않았다. 기존 Playwright 시나리오에 Inline 공시 선택 버튼 실행 전후 같은 ID/같은 surface 개수/과거 내용 보존 assertion을 추가했다. 기존 검사는 자연어 새 ID, 두 번 렌더링, 읽기 전용 이력, 고정 Canvas ID, 화면별 선택 문맥, 회사 전환, 새 대화 초기화를 포함한다.

## 실제 MCP 검증

대상 `http://localhost:2820/a2ui/sec`, 기존 Next2820 PID3547, FastAPI8000 reloader5942/worker15463 및 실제 BFF/OAuth 사용. 새 서버/DB 데이터 생성 없이 브라우저를 조작했다.

| 사용자 행동 | 실제 결과 |
| --- | --- |
| Inline CPNG 검색 | sec-inline-74a1ee2ce1214fd3be419468c3659403 생성 |
| CPNG 공시 보기 버튼 | 같은 ID로 공시 목록 갱신 |
| 새 채팅 AAPL 검색 | sec-inline-0fdb8e6ed97e442fb61d90896f31b2d4 생성, 이전 CPNG 내용 보존 |
| Canvas CPNG → MSFT 검색 | sec-canvas-1da1b30f645741b5b98bceb17fd53adc 유지, Canvas1개/Inline2개 |
| 출력 선택을 Inline으로 변경 후 Canvas MSFT 공시 보기 | 같은 Canvas ID/회사로 갱신, Inline 전체 textContent 동일 |

[최종 화면](evidence/2026-09-22-sec-output-recheck/mcp-inline-canvas.png). 실행 SSE RUN_FINISHED 확인, RUN_ERROR 없음. 콘솔은 favicon.ico404 1건과 기존 SDK 개발 경고가 있었으며 화면 수명/갱신 실패는 없었다.

## 자동 검증 및 정리

명령: `pnpm --filter reason-hwang-fe-host test:e2e:sec-agent --grep 'Inline history'`. 결과와 종료 확인은 아래에 추가한다. 이번 변경은 E2E assertion과 문서이며 런타임 API/View 계약 변경이 없으므로 Bruno/Storybook/생산 빌드 재실행 대상이 아니다.

MCP 소유 Chrome PID18577, 공유 MCP 부모99635, 임시 profile `playwright_chromiumdev_profile-ZrvMet`를 기록했다. 공식 browser_close를 호출했고 종료/프로필 정리 확인은 아래에 기록한다.

최종 결과: 대상 E2E1/1 PASS(52.8초; 명령 전체53.9초), FE typecheck PASS. [실행 로그](evidence/2026-09-22-sec-output-recheck/playwright.txt), [자동 검증 캡처](evidence/2026-09-22-sec-output-recheck/playwright-inline-canvas.png). 기존 HTML reporter가 `1-fe-host/playwright-report/index.html`을 생성했다. 이 시나리오에는 Inline 두 번 생성/읽기 전용 이력/Inline 버튼 동일ID/Canvas 두 번 렌더/위치 전환/발신 화면 문맥/회사명 교체/새 대화 초기화가 포함된다. 전체 SEC5시나리오의 이번 재실행이라고 표현하지 않는다. 이전 전체5/5는 [UX 검증](2026-09-22-sec-ux-redesign.md)의 증거다.

정리 확인: MCP Chrome18577 및 CLI worker18840 부재, 임시 profile 삭제 확인. 공유 MCP99635와 사용자 Next3547/FastAPI5942·15463은 유지됨을 ps/lsof로 확인했다. 별도 테스트 서버를 생성하지 않았고 사용자 브라우저/서비스를 종료하지 않았다. 문서 상대 링크와 diff 검사 후 회귀 테스트/증거를 커밋한다. 런타임 동작은 기존 구현과 일치하며 요청한 개발 범위 및 현재 브라우저 검증을 완료했다.
