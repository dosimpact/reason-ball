# A2UI 프로덕션 빌드 검증

- 날짜: 2026-09-21 KST
- 범위: A2UI-REG/CAT/VER/DYN/FIX/ACT/MODEL/STATE/VAL-001
- Stock: [공용 설계](../stock/tech-shared/a2ui-system.md), [Host](../stock/tech-shared/1-fe-host/a2ui.md), [LangGraph](../stock/tech-shared/3-langgraph-fast/a2ui.md)
- 이전 기록: [브라우저와 수치 바인딩](2026-09-21-a2ui-browser-and-grounding.md)

## 확정 변경

SDK의 바인딩 검사에 필요한 생성 data를 포함하고, 렌더링 직전에 서버 facts로 교체하도록 수정했다. 실제 모델 질문 6종이 모두 통과했다. 공식 스키마 검증을 facts 검사보다 먼저 실행해 잘못된 타입도 계약 오류로 처리한다.

스크린샷에서 여러 KPI를 한 Row에 놓으면 숫자가 잘리는 문제를 발견했다. Row의 콘텐츠 최소 너비를 보존하고 Metric 숫자 줄바꿈을 막았다. 420px 폭에서 KPI 5개의 scrollWidth가 clientWidth를 넘지 않는 Storybook 회귀 검사를 추가했다. 프로덕션 카탈로그에서도 같은 조건을 확인했다. Chart의 공용 tooltip 이름은 위험 계정 수에도 사용할 수 있도록 `매출` 대신 `값`으로 표시한다.

## 검증 결과

모든 실행은 순차 진행했다. 브라우저 E2E, Storybook, 빌드를 병렬 실행하지 않았다.

| 검사 | 명령/도구 | 결과 |
| --- | --- | --- |
| CAT-01 / VER-01 | `pnpm a2ui:check` | 61개 UI, 66개 어댑터, 3개 카탈로그 PASS |
| 계약 | `pnpm --filter reason-hwang-fe-host test:a2ui` | 68 PASS |
| VAL-VIEW-001 | `pnpm --filter reason-hwang-fe-host test:a2ui:views` | 69 PASS; 최초 실행의 누락된 Chromium shell 설치 후 통과 |
| Python 회귀 | `pnpm --filter reason-hwang-langgraph-fast test` | 122 PASS, 13 SKIP (DB opt-in 7, 별도 실행 실모델 6) |
| 변경 후 Python 집중 검사 | `uv run pytest tests/test_a2ui_contract.py tests/test_a2ui_facts.py tests/test_a2ui_model.py tests/test_a2ui_workflow.py -q` | 21 PASS |
| 실제 OAuth 모델 | `A2UI_LIVE_TESTS=1 uv run pytest tests/test_a2ui_live.py -q -x` | snapshot/team/risk/account/pie/trend 6 PASS, 99.23초 |
| VAL-API-001 | `pnpm --filter reason-hwang-langgraph-fast test:a2ui:api --env-var baseUrl=http://127.0.0.1:18080` | HTTP 7/7, tests 7/7, assertions 8/8 PASS |
| Host lint / typecheck | 패키지 `lint`, `typecheck` | PASS |
| Python typecheck | 패키지 `typecheck` | 0 errors, 0 warnings |
| Python lint | 패키지 `lint` | 기존 타 모듈 49건 FAIL; A2UI와 변경 server 진입 파일은 0건 |
| 빌드 | 두 패키지 `build` | PASS; Host 레이아웃 수정 후 재빌드 PASS |
| Python wheel | zip 항목 검사 | A2UI 16개 파일, 계약과 Fixed JSON 포함 PASS |

모델 설정은 `A2UI_MODEL_PROVIDER=oauth-proxy`, `A2UI_MODEL=gpt-5.6-luna`, 로컬 프록시 2890이다. 비밀값은 기록하지 않았다. Python lint의 기존 오류는 요청 범위 밖 파일에 있으며 수정하지 않았다. Next 다중 lockfile 경고, CopilotKit 내부 AI SDK 동적 의존성 경고, SDK deprecation/serialization 경고가 남아 있다.

## VAL-BROWSER-001

대상은 테스트 소유 FastAPI 18080과 `next start` 프로덕션 빌드 2815였다. Playwright MCP의 navigate/snapshot/fill_form/click/evaluate/take_screenshot/console_messages를 사용했다.

1. 전체 매출 화면에서 $680,000 / $630,000 / 107.9%와 실제 차트 표시를 확인했다.
2. 생성 중 정지 아이콘(`svg.lucide-square`)이 있는 버튼을 클릭했다. 같은 대화에서 즉시 담당자 표를 다시 요청해 4명의 올바른 매출·쿼터·거래처 수가 표시됐고 오류가 없었다.
3. 첫 카드에서 부산 → 서울 → 부산 조회 시 $320,000 → $360,000 → $320,000으로 바뀌었다. 두 번째 카드의 전체 매출 $680,000은 유지됐다.
4. 새 대화 후 기존 fieldset 0개, 초기 안내 문구 표시를 확인했다.
5. Fixed ICN → NRT 카드의 $289가 유지되고 선택 후 같은 카드에서 `선택 완료` 버튼이 비활성화됐다.
6. 최신 Row 갤러리의 KPI 5개 값에 잘림이 없음을 DOM 크기와 스크린샷으로 확인했다.

증거:
- [취소 후 담당자 표 생성](evidence/a2ui-2026-09-21/a2ui-cancel-recovery-table.png): Row 수정 전 캡처이며 KPI 잘림 발견 근거를 보존한다.
- [Fixed 선택 완료](evidence/a2ui-2026-09-21/a2ui-production-fixed-selected.png)
- [Row 잘림 수정 후](evidence/a2ui-2026-09-21/a2ui-row-wrapping.png)

프로덕션 Fixed 페이지의 console error 0건. Dynamic/갤러리의 error는 기존 favicon.ico 404 한 건이며 A2UI 오류는 없었다. 모든 테스트 소유 서버와 MCP 브라우저를 종료했다. 기존 OAuth 프록시는 유지했다.

## 미충족 조건

별도 API-key 제공자의 실제 연결 정보가 없어 A2UI-MODEL-001의 두 제공자 검증은 미완료다. OAuth placeholder를 API 키 증거로 대체하지 않았다. 따라서 전체 목표를 완료 처리하지 않았고 완료 커밋도 만들지 않았다. API-key가 설정된 로컬 설정 위치를 확인한 뒤 동일 실모델·HTTP·브라우저 검증을 순차 실행해야 한다. 저장소 전체 Python lint 역시 PASS로 보고하지 않는다.
