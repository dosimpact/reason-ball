# 2026-10-19 GRAFANA-GRID — 조사 및 적용

## 요청과 조사

목표: Grafana dashboard의 그리드 시스템을 조사하고 이 Canvas에 적용한다.

공식 근거(2026-10-19 조회):
- https://grafana.com/docs/grafana/latest/visualizations/dashboards/build-dashboards/view-dashboard-json-model/ : gridPos x/y/w/h, 24 columns, grid height, negative gravity.
- https://github.com/grafana/scenes/blob/main/packages/scenes/src/components/layout/grid/SceneGridLayoutRenderer.tsx : ReactGridLayout, container measurement, dedicated drag handle, resize handle, stop/layout callbacks.
- https://github.com/grafana/scenes/blob/main/packages/scenes/src/components/layout/grid/constants.ts : renderer constants.
- https://grafana.com/docs/grafana/latest/visualizations/dashboards/build-dashboards/create-dashboard/ : custom layout과 auto grid는 별개.
- https://github.com/react-grid-layout/react-grid-layout : v2 React API, pure core verticalCompactor와 collision behavior, typed layout contract. npm registry 현재 2.3.0 확인.

## 적용 요구사항 / 완료 판정 기준

1. GRAFANA-GRID-01: 24-column x/y/w/h 좌표 저장. width/height 픽셀 및 이전 v4 12열 w/h 문서를 명시적으로 변환한다. 기존 정상 UI와 입력 데이터는 보존한다.
2. GRAFANA-GRID-02: 실제 react-grid-layout 엔진으로 전용 핸들 좌표 drag, resize, preview, 충돌 밀어내기, vertical compaction. 단순 배열 reorder/CSS auto-placement로 대체하지 않는다.
3. GRAFANA-GRID-03: 전체 영향 패널을 원자적으로 저장하고 재로드 시 배치 복원. 모델/API 호출 및 content revision 변화 없음. thread/tab 경계를 보존한다.
4. GRAFANA-GRID-04: Chat 추가/타 탭 이동/삭제/기존 컨트롤과 새 좌표 모델을 통합한다. 중복·미지원 payload 차단과 입력 독립성을 유지한다.
5. GRAFANA-GRID-05: splitter/container resize 반영, 좁은 화면 읽기 레이아웃과 저장 좌표 분리, 키보드 접근 대안.
6. GRAFANA-GRID-06: migration/충돌/compaction/store 단위, 실제 browser drag/resize/reload/삭제/다른 탭/Chat 추가 회귀, typecheck/lint/build 검증. 최신 stock 동기화.

Grafana 전체 UI/쿼리 에디터/대시보드 변수/Auto grid 구현은 이 요청의 grid 적용 범위가 아니다. Canvas의 OpenUI registry와 분석 데이터 경계를 유지한다.

## 진행 상태

조사 및 엔진 통합 완료. 아래 요구사항별 증거와 검증 결과로 완료 여부를 확인한다.


## 구현 결과 및 차이

- frontend dependency react-grid-layout 2.3.0 (npm/package-lock). Grafana renderer 상수와 동일하게 cols=24, rowHeight=30, margin=8.
- Grafana의 gridPos 구조에 대응하는 layout{x,y,w,h}를 기존 Canvas widget envelope 안에 저장한다. 별도 Grafana 서버/패널 플러그인을 실행하는 통합은 아니다.
- 앱 정책: 기본 12×14, 높이 4~40, 좁은 화면 기준 600px. Grafana 소스의 768px drag 제한과 다른 이유는 이 앱이 화면을 Chat/Canvas로 나누어 사용하기 때문이다.
- 기존 grid CSS/pointer 구현은 실제 배치 경로에서 제거하고 ReactGridLayout + verticalCompactor 사용. 우하단 핸들은 hover 없이 항상 표시한다.
- 원문 일반 카드 수정 요청이 planner 요약에서 누락되는 통합 회귀를 발견해 실제 사용자 요청을 등록 프로그램 생성 입력에도 전달했다. 관련 Python 검증 추가.

## 요구사항별 완료 증거

| ID | 구현 및 검증 |
| --- | --- |
| GRAFANA-GRID-01 | grid.ts v2/v3 pixel + v4 span migration; grid/layout unit tests; browser v4 seed→v5 저장→reload |
| GRAFANA-GRID-02 | dashboard-grid.tsx 실제 엔진; Grafana browser test가 resize 중 placeholder/폭 증가, 이웃 밀어내기, x좌표 drag, 삭제 후 y=0을 검사 |
| GRAFANA-GRID-03 | store setLayouts peers 검증·원자적 저장; 단위에서 1회 write/바쁜 상태 차단/revision 보존; browser reload·내용·다른 탭 보존 |
| GRAFANA-GRID-04 | 기존 registry DnD/추가/삭제/다른 탭 회귀 및 external Chat coordinate drop 테스트 |
| GRAFANA-GRID-05 | ResizeObserver 기반 useContainerWidth; narrow projection 저장 불변; splitter card-width 반응/저장 불변; 키보드 이동·기존 크기 컨트롤 |
| GRAFANA-GRID-06 | 아래 테스트와 stock 동기화. 요구사항.md I 및 AGENTS tooling 갱신 |

## 검증 증거

- Frontend 356 tests PASS (11 files), typecheck PASS, FSD PASS, production build PASS.
- ESLint errors 0 / 기존 warnings 5. Python 관련 29 PASS, Ruff PASS.
- 전체 Chrome E2E 21 PASS (59.8초), 실제 Python/provider 및 DuckDB 실행 포함. HTML: frontend/output/grafana-report/index.html.
- 별도 external Chat drop + splitter reflow 1 PASS (2.1초). HTML: frontend/output/grafana-container-report/index.html.
- 화면: frontend/output/playwright/grafana-grid-expanded.png.
- npm audit의 기존 workspace findings는 15개. 새 react-grid-layout/react-draggable/react-resizable은 보고 항목에 없었다. 무관한 dependency 강제 업데이트는 하지 않았다.
- 첫 통합 검사: 19 PASS / 2 FAIL. 하나는 simulator의 CANVAS_DATA_DIR가 테스트 서버와 달랐고, 하나는 등록 카드 수정 문구 누락이었다. 테스트 실행에 같은 데이터 경로를 지정하고 생성 입력을 보완한 뒤 전체 21 PASS.
- build 중 한 번 발생한 next/font/Turbopack Google font resolve 실패는 코드 변경 없이 재실행해 통과. 애플리케이션 폰트 설정을 바꾸지 않았다.
- 검증 전용 backend 2047 (/tmp/canvas-grafana-validation) 및 frontend 3055 사용. 기본 경로에 테스트가 생성한 단일 advance request는 ID/내용을 확인해 제거했다. 기존 사용자 서비스와 저장본은 유지한다.

## Stock 동기화

business.md, system.md, canvas-system/canvas-system.md의 과거 12열/픽셀/자동 배치 설명을 현재 24열 좌표 계약으로 대체했다. 이전 flow는 보존한다.

최종 핸들 표시 CSS 변경 후 Grafana 전용 Chrome 3개 재검증 PASS (5.3초). opacity=1 검사 포함. 최종 production build/FSD PASS, git diff --check PASS. 검증 전용 서버 종료.
