# OpenUI 명칭 통일

- 날짜: 2026-11-14
- 결정: OPEN-UI-NAME-001
- 배경: 현재 구현은 OpenUI Lang인데 이전 프로토콜 명칭이 URL·설정·파일명에 남아 있어 혼동을 일으켰다.
- 범위: `1-reason-hwang`의 현재 실행 코드·테스트·설정·stock 문서. 기존 사용자 변경은 보존했다. 과거 flow 및 human-docs는 변경하지 않았다.

## 변경과 이전 이름 대응

| 이전 | 현재 |
| --- | --- |
| `/a2ui` 및 하위 dynamic/fixed/sec/catalog | `/open-ui` 및 동일 하위 경로 |
| `A2UI_LANGGRAPH_URL` | `OPEN_UI_LANGGRAPH_URL` |
| `A2UI_MODEL_*`, `A2UI_SEC_BFF_URL` | `OPEN_UI_MODEL_*`, `OPEN_UI_SEC_BFF_URL` |
| `a2ui_report.py`, `a2ui_report_plan.py` | `open_ui_report.py`, `open_ui_report_plan.py` |
| `test_a2ui_report.py`, `test_a2ui_model.py` | `test_open_ui_report.py`, `test_open_ui_model.py` |
| `docs/stock/tech-shared/a2ui-system/` | `docs/stock/tech-shared/open-ui-system/` |
| 패키지별 `a2ui.md`, 도메인 `a2ui-system.md` | 패키지별 `open-ui.md`, 도메인 `open-ui-system.md` |
| `SEC-A2UI-01`~`09` | `SEC-OPEN-UI-01`~`09` |

화면 URL의 이전 별칭은 제공하지 않는다. `OPENUI_*` 설정의 기존 우선순위는 유지한다. 로컬 `.env*`의 이전 키도 값을 출력하지 않고 변경했다. 로컬 설정은 커밋하지 않는다. Python 식별자는 하이픈 대신 밑줄을 사용한다. API URL과 업무 로직은 변경하지 않았다.

## 영향 stock

- [공통 설계](../stock/tech-shared/openui-migration.md#open-ui-name-001-명칭과-경로)
- [Host](../stock/tech-shared/1-fe-host/open-ui.md), [LangGraph](../stock/tech-shared/3-langgraph-fast/open-ui.md)
- [문서 지도](../stock/tech-shared/open-ui-system/INDEX.md), [SEC 요구사항](../stock/us-corporate-filings/open-ui-system.md)
- docs/INDEX 및 관련 SEC 문서의 현재 참조를 동기화했다. 과거 flow의 링크·문구는 원문을 보존하므로 위 대응표로 해석한다.

## 검증

OPEN-UI-NAME-001 시나리오: 새 URL에서 화면과 갤러리를 열고, 탐색 링크가 새 경로를 가리키며 이전 URL은 더 이상 제공하지 않아야 한다. 모듈명을 바꿔도 공시 보고서·모델 설정 테스트가 통과해야 한다.

| 검사 | 결과 |
| --- | --- |
| FE `pnpm typecheck` | PASS. 최초에는 이전 `.next/types` 참조로 실패했으나 작업 전용 dev 서버에서 타입 재생성 후 재실행 통과 |
| FE `pnpm lint` | PASS. 기존 media.tsx img 경고 1개, FSD 오류 없음 |
| FE `pnpm test:generative-ui` | PASS 3 |
| FE `pnpm test:generative-ui:views` | PASS 2. 누락된 Playwright Chromium 설치 후 재실행 |
| Python `pnpm test tests/domains/tenk/test_open_ui_report.py tests/test_open_ui_model.py tests/test_sec_hybrid.py` | PASS 15 |
| Playwright MCP 화면 확인 | PASS. `/open-ui`에서 새 링크 확인, 카탈로그 링크 클릭 후 `/open-ui/catalog`와 카탈로그 제목 확인 |
| MCP 브라우저 HTTP 확인 | PASS. 새 경로 5개 모두 200, `/a2ui` 404 |
| 현재 소스·테스트·stock 이전 명칭 검색 | PASS. 보존한 flow 링크를 제외한 참조 없음 |
| 변경한 문서 경로 링크 확인 | PASS. 깨진 open-ui 링크 없음 |

VAL-VIEW-001을 Storybook으로 확인했다. 업무 로직과 서버 API 계약은 변경하지 않아 VAL-API-001은 적용되지 않는다. MCP 브라우저는 이름 변경의 탐색 회귀를 추가 확인했다. 실제 모델·Yahoo·SEC 외부 서비스 호출은 이번 명칭 변경 검증 범위에 포함하지 않았다. 브라우저 콘솔의 favicon 404와 의도적으로 확인한 이전 URL 404를 구분했다.

## 자원 정리

- 작업 소유 FE 서버: port 3280, PID 24324/24325. 종료 신호로 정상 종료 후 `ps`와 `lsof`에서 PID·리스닝 포트 잔존 없음 확인.
- 작업 중 MCP가 실행한 브라우저 PID 24399: 공식 `browser_close` 호출 후 프로세스 잔존 없음 확인. 공유 MCP 서버는 유지했다.
- Storybook/Vitest는 명령 종료로 정리됐다. 설치한 Playwright 브라우저는 재사용 도구 캐시로 유지한다.
- 기존 사용자 서버·파일·브라우저에는 종료·정리 작업을 수행하지 않았다.
