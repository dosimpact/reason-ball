# TA-FASTAPI-001: 기술적 분석 전용 화면의 FastAPI 전환

- 날짜: 2026-11-16
- 요청: 기술적 분석 인라인·Canvas를 LangGraph 개발 runtime에서 기존 FastAPI runtime으로 전환. 구현 전 기존 변경 전체를 먼저 커밋.
- 기준 커밋: `e5863a44` (`Add OpenUI gallery and financial showcases`). 당시 코드·문서·사용자 검증 증거 96개 파일을 저장했다. 검증 서버가 생성한 `next-env.d.ts`와 `tsconfig.json`의 임시 타입 출력 경로는 커밋에서 제외하고 작업 파일에 보존했다. 커밋 이후 발생한 다른 작업 변경은 이번 구현에 포함하지 않는다.

## 결정과 구현

- `/technical-analysis`는 `technical_analysis_agent`, `/technical-analysis/canvas`는 `technical_analysis_canvas_agent`를 유지하면서 `fastApiChatRuntime`을 주입한다. Sol 서브에이전트가 frontend 구현·검증을 담당하고 메인이 문서와 최종 검토를 담당했다.
- 기존 runtime context로 assistant discovery/schema, 메시지 전송, run 조회·취소, history/state와 차트·지표 카탈로그가 `/api/fastapi-langgraph`를 함께 사용한다. 새 thread metadata의 `runtime=fastapi`, 기존 graph ID별 분리를 유지한다.
- 개발 탐색 `/langgraph-dev-chat`은 기존 development runtime을 유지한다. 개발 기록 자동 복사와 FastAPI 실패 시 개발 runtime fallback은 추가하지 않는다.
- 백엔드 endpoint·API 계약·DB·환경 설정 변경은 없다. 기존 실제 graph 실행, ToolMessage, inline presentation, Canvas custom event/report 저장 경로를 재사용한다.
- 기존 navigation Playwright fixture를 두 runtime에 맞게 갱신했다. 전용 화면의 FastAPI thread/history metadata와 개발 runtime 호출 부재, 개발 채팅의 discovery 유지 검증을 추가했다. 브라우저 실행은 사용자 담당이므로 spec 실행 성공을 주장하지 않는다.

## 검증 결과

| 검증 | 결과 | 근거/제한 |
| --- | --- | --- |
| `pnpm -C 1-fe-host typecheck` | PASS | frontend 전체 타입 검사 |
| `pnpm -C 1-fe-host exec eslint src/_pages/chat/ui/page.tsx tests/e2e/technical-analysis-navigation.spec.ts` | PASS | 변경 frontend 파일 |
| `pnpm -C 1-fe-host test:chat` | 23 PASS / 1 FAIL | `native-tools.test.ts`의 token 설정 시 stream 옵션 exact assertion이 기존 `onDisconnect: continue`와 `onRunCreated`를 기대하지 않음. 기준 커밋에도 존재하며 이번 변경 파일과 무관. 전체 통과로 보고하지 않음 |
| 변경 파일 `git diff --check` | PASS | 이번 구현·문서 범위 |
| VAL-BROWSER-001 / Playwright spec 실행 | SKIP | 사용자가 브라우저 검증을 담당하도록 지정. 실제 화면·모바일·모델/Yahoo 연동은 미검증 |
| VAL-API-001 | 해당 없음 | 서버 API 계약·구현 변경 없음. [기존 FastAPI API 검증](2026-11-16-fastapi-runtime-and-ta-indicators.md)은 선행 근거이며 이번 실행 결과가 아님 |
| VAL-VIEW-001 | 해당 없음 | 새 순수 View 추가 없이 runtime binding 변경 |

신규 서버·브라우저·MCP 연결·임시 DB·검증 데이터는 생성하지 않았다. 서비스 재시작도 하지 않았다. 기존 사용자 실행 자원과 진행 중인 별도 검증 파일은 보존했다.

## 사용자 브라우저 확인

1. FastAPI 서비스 실행 상태에서 두 전용 주소를 열어 기존 고정 graph로 분석되는지 확인한다. Network에서 discovery·threads/runs·history·chart/catalog가 `/api/fastapi-langgraph`인지 확인한다.
2. 인라인에서 도구 인자·결과, 본문·차트, 차트 조건 변경과 구조화 재분석을 확인한다.
3. Canvas에서 보고서 생성·탭 전환·기록 복원·새 대화와 후속 재분석을 확인한다.
4. 실행 중단·오류·잘못된 티커와 빠른 기록/화면 전환 시 이전 결과가 섞이지 않는지 확인한다. FastAPI 연결 실패 시 개발 runtime으로 전환되지 않아야 한다.
5. `/langgraph-dev-chat`의 그래프 선택과 기존 개발 기록 유지, 모바일 메뉴·차트 탐색을 확인한다.

## Stock 동기화와 복구

- [TA 시스템 설계](../stock/technical-analysis/system-design.md): 전용 화면 실행 경계·운영 명령·과거 포트 관찰 구분.
- [Host 아키텍처](../stock/tech-shared/1-fe-host/2-frontend-side-architecture.md): HOST-NAV-001, CHAT-RUNTIME-002.
- [Host OpenUI](../stock/tech-shared/1-fe-host/open-ui.md): CHAT-RUNTIME-002, TA-NAV-001.
- 복구가 필요하면 `page.tsx`의 인라인·Canvas runtime 두 곳을 `developmentChatRuntime`으로 되돌린다. 두 runtime의 기록을 이동하거나 삭제하지 않는다.
- 이번 전환 구현은 별도 커밋하지 않았다. 사용자 요청에 따른 작업 전 스냅샷 커밋과 구분한다.
