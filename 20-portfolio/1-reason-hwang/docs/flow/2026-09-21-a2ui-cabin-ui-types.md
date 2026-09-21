# 단일 도구에서 Fixed UI 종류 선택

- 날짜: 2026-09-21
- 맥락/결정 CABIN-03: 사용자가 도구 하나에서 여러 고정 UI를 선택하는 ui_type 인자를 요청했다. 기존 단일 통합 화면만 제공하던 해석을 수정한다.
- 구현: display_cabin_options(flight_id, ui_type: Literal[meal, seat, both] = both). 서버 허용 목록에서 meal.json/seat.json/cabin.json 선택. arbitrary 파일 경로를 입력받지 않는다. 기존 flight 도구는 유지.
- 데이터와 action: 개별 UI에는 해당 필드만 초기화하고 확정한다. 서버 checkpoint uiType에서 예상 context 키를 계산하므로 다른 선택값 주입/클라이언트 uiType 주입을 거절한다. 기존 uiType 없는 통합 카드의 확정은 both로 해석한다.
- stock: [LangGraph](../stock/tech-shared/a2ui-system/langgraph.md). 기존 통합 동작 기록은 역사로 보존한다.
- 단위: tests/test_a2ui_cabin.py + test_a2ui_workflow.py 16 PASS. UI별 필드 부재, 개별 확정, 잘못된 UI 타입/추가 필드 거절 검증.
- Storybook: cabin.stories.tsx 3 PASS, 단일 worker. meal/seat/both 바인딩과 개별 action에 다른 필드가 없음을 검증.
- 정적: 변경 Python ruff/pyright PASS(0오류), frontend typecheck 및 변경 파일 ESLint PASS.
- VAL-API-001: test:cabin:api --env-var baseUrl=http://127.0.0.1:18084 → 실제 OAuth gpt-5.6-luna, 8요청/8테스트/9assertion PASS, 12.460초. 세 UI 모두 단일 도구 호출 및 선택값 확정 검증.
- VAL-BROWSER-001: Playwright MCP, localhost:2821/a2ui/fixed. 기내식만 요청 → 좌석 그룹0개, 채식 선택/확정 완료. 새 대화 좌석만 요청 → 기내식 그룹0개, 14C 선택/확정 및 입력 잠금 PASS. console 오류0개. 첫 dev 컴파일59.5초로 navigation timeout 후 정상 페이지 확인. 새 대화 초기화 직후 Enter는 요청을 보내지 않아 입력이 남았으며 준비 후 재전송으로 실제 흐름 검증; 초기화 시점 UI는 이번 변경 범위 밖.
- 정리: 검증 backend PID5609/부모5608, frontend5735/부모5729에 TERM, ps/lsof로 종료 확인. MCP 검증 탭 종료(No open tabs), 기존 공유 MCP 호스트 유지. 전용 .next-cabin-types-dev 삭제, Next 자동 변경 tsconfig/next-env 원복. 다른 사용자 서버·문서 유지.
