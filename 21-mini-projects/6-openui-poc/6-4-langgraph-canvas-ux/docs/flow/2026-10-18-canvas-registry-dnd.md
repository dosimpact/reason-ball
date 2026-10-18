# Canvas registry와 DnD 확장 — 2026-10-18

## 맥락과 결정

사용자 요청: 차트 외 OpenUI 요소도 등록 wrapper를 통해 Chat 추가/삭제, Canvas DnD 기능을 공통 제공한다.

- REG-01: 개발자가 제어하는 registry와 CanvasItem wrapper. 독립 OpenUI 프로그램과 입력 상태를 저장한다. 기본 openui 등록은 전체 기본 라이브러리의 요소/조합을 수용한다.
- REG-02: 분석 쿼리 위젯과 일반 등록 위젯을 union으로 분리한다. 일반 위젯에는 queryId/snapshot을 강제하지 않는다.
- DND-01: Chat → Canvas 복사, Canvas 패널 앞 삽입/빈 영역 끝 이동, 탭 drop을 지원한다. 12열 CSS grid 자동 배치, x/y 자유 좌표 배치는 범위 밖이다.
- DND-02: 스코프/버전/등록/프로그램 검증, 중복 방지, Alt+위/아래 키보드 대안. 외부 drag JSON을 실행 코드로 취급하지 않는다.
- SAVE-REG: 문서 v3 저장, v2 분석 차트 읽기 호환. 미지원 형식은 덮어쓰지 않는다.
- 액션: 등록은 표시·입력 상태·Canvas 조작을 제공한다. 외부 업무 실행/서버 tool continuation은 자동 부여하지 않는다.

영향 stock: business.md, system.md, canvas-system 3개 문서. 검증은 구현 중이며 아래에 실제 결과를 추가한다.

## 구현 및 검증 중 발견 사항

- 일반 위젯과 분석 위젯 union을 추가하고 v3 저장/v2 읽기 경로를 구현했다. 등록 wrapper는 독립 program/uiState를 복사한다. custom library 등록 및 중복 ID 거부를 단위 검사했다.
- DnD는 HTML5 MIME payload와 thread 검증을 사용한다. 패널 앞 삽입과 빈 영역 끝 삽입을 구분한다. 최대 패널 수 때문에 추가가 거부돼도 기존 선택 패널을 잘못 이동하지 않도록 drop 이후 원본 ID로 대상을 재확인한다.
- 첫 browser fixture는 Canvas 중앙에 놓아 실제로는 기존 패널 앞에 삽입됐는데 테스트가 끝 추가를 가정했다. 빈 영역/패널 drop 위치를 명시했다. 여러 큰 패널이 화면 밖에 있는 테스트는 그리드 너비·높이를 UI로 줄여 source/target을 동시에 표시한 뒤 실제 mouse drag를 검증했다.
- 실제 모델 회귀 검사에서 앞선 Chat-only 지시가 다음 직접 Canvas 생성에 영향을 주는 사례와, 중복 제목 편집을 새 Chat 차트로 오해하는 사례를 발견했다. 최신 요청의 배치 의도와 기존 위젯 수정/대상 모호성 판정을 planner의 우선 규칙으로 명시했다. 두 시나리오의 실제 provider 재검증이 통과했다. 단어 매칭 라우터는 추가하지 않았다.
- 레지스트리 사용자 정의 타입은 표시/저장 가능하지만 Python 자동 생성은 기본 openui 카탈로그를 사용한다. custom 등록 위젯의 자연어 변경은 전용 생성 카탈로그가 없으면 기존 결과를 유지하며 오류로 설명한다.

## 실행 환경과 증거

기존 2037/3045 서비스를 중지하거나 재사용하지 않았다. 검증 전용 Python 2047, production Next 3055와 `/tmp/canvas-registry-validation` 분석 데이터 디렉터리를 사용했다. 브라우저 MCP(iab/chrome)는 연결되지 않아 기존 Playwright Chrome(headless) 경로로 실제 화면을 탐색하고 E2E를 실행했다. 사용자 브라우저의 저장소에는 테스트 자료를 넣지 않았다.

- `npm run generate`: 성공. 생성 프롬프트를 Python packaged asset에 복사하고 cmp 일치를 확인했다. 기존 MapLibre import.meta/CJS 생성 경고는 남아 있다.
- `npm run typecheck`: 통과.
- `npm test`: 348개 통과(9 files).
- `npm run lint`: 오류 0, 기존 경고 5개.
- `npm run verify`: FSD 오류/경고 0, production build 통과.
- `uv run pytest`: 전체 59개 통과. planner 지침 보완 후 관련 `tests/test_canvas_graph.py` 18개를 재검증했다.
- `uv run ruff check agent tests`: 통과.
- 새 E2E fixture: Markdown/표/입력 폼 추가·삭제·drag·키보드 순서 변경·탭 drop·12열 폭·reload·입력 상태 독립성, 잘못된 JSON/cross-thread drop 거부. UI 조작 중 run/query 요청 0을 검증한다.
- 실제 provider: 등록 가능한 Chat 콘텐츠 생성 → 추가 → Canvas 직접 생성 → 선택 위젯 수정. 기존 분석 생성/변경/조회/취소/모호성 시나리오와 함께 검증한다.

최종 전체 E2E 결과는 아래 완료 항목에 기록한다. 보고서: `frontend/output/playwright-report/index.html`, JSON: `frontend/output/validation/e2e.json`, 화면: `frontend/output/playwright/registry-dnd.png`, `registry-live.png`.

추가 회귀: 실제 모델이 CURRENT_DATE SQL을 반환한 1건을 기존 allowlist가 거부했다. validator를 완화하지 않고 Operation.sql 명세에 필수 $start_date/$end_date/$region 바인딩과 서버의 months 해석 책임을 명시했다. 이후 실제 분석 차트 생성 → Chat drag 추가 → 중복 방지 → 모델 없는 refresh → Chat 원본 유지 검증을 통과했다.

## 완료 검증

- 최종 전체 실행: `CANVAS_DATA_DIR=/tmp/canvas-registry-validation BASE_URL=http://127.0.0.1:3055 npm run test:e2e` — **16 passed (50.1s)**. 재시도로 실패를 숨기는 설정 없이 전체 suite가 통과했다. 분석 차트의 실제 Chat→Canvas drag도 포함한다.
- REG-01/02, DND-01/02, SAVE-REG: 대표 UI 및 실패·복원·실제 provider 경로 PASS. 모델/쿼리 없는 Canvas 조작과 Chat 원본 보존 PASS.
- 프롬프트 asset 일치, 문서 상대 링크, git diff whitespace 검사 PASS.
- 개발 서비스 3045 HTTP 200, 2037 health 정상 확인. 이번 소유 검증 서비스 2047/3055만 종료한다.
- stock business/system 및 canvas-system 3개 문서와 요구사항 H에 현재 계약을 동기화했다.

남은 경계: 자유 x/y 좌표·충돌 엔진, 터치 drag sensor, 모든 OpenUI 조합 전수 검증, 외부 액션/AG-UI tool continuation, custom library의 backend 카탈로그 자동 동기화. 이 항목들은 이번 구현 완료 주장에 포함하지 않는다.
