# Chat + Canvas 제품 설계

## 범위와 현재 상태

요구사항 B~H가 기준이다. Python LangGraph가 요청을 해석하고 OpenUI로 기존 Chat 응답 또는 독립 Canvas 위젯을 생성한다. 합성 매출·광고 데이터는 실제 DuckDB SQL로 분석한다. 핵심 PoC와 채택한 확장 기능의 구현·검증을 완료했다. 후보·후속 기능은 아래 지원 범위와 검증 기록에서 구분한다.

## CHAT-01~03 / CANVAS-01~04

Chat과 Canvas를 나란히 표시한다. Canvas 생성 지시가 없는 일반 요청은 기존 OpenUI Chat을 사용한다. Canvas 설명 요청은 읽기만 하고, 생성·수정 요청은 위젯별 작업으로 전달한다. 대상이 불명확하면 확인을 요청한다. 선택한 위젯 ID를 함께 전달한다. `매출과 광고비 Canvas`처럼 짧게 입력해도 Canvas 처리 시 Chat 안내를 표시하며, 모델 설명이 비면 기본 진행 안내를 제공한다.

## PATCH / DATA

분석 Canvas 위젯은 제목, 차트 종류, 기간·지역 조건, 등록된 쿼리 ID, 마지막 정상 데이터와 기준 시점을 가진다. 매출과 광고비를 각각 생성하고 한 위젯만 수정할 수 있다. 기간·지역 변경은 등록된 SQL의 파라미터 변경으로 처리한다. 다른 지표를 요청한 경우에만 새 SQL을 검증·등록한다. 차트 종류·제목 변경은 해당 위젯의 OpenUI 프로그램을 교체한다. 실패한 변경은 기존 정상 위젯을 유지한다.

데이터는 합성 데이터이며 USD/UTC 기준이다. 원본 업무 데이터 변경·실제 예측으로 설명하지 않는다. 표에서 조회된 행을 확인할 수 있다.

## FRESH / SAVE / COMPAT

수동 새로고침과 polling은 Python 조회 API를 사용하고 LLM을 호출하지 않는다. 자연어 정책 변경에는 모델이 사용된다. Snapshot은 현재 데이터를 보관하며 새로고침을 차단한다. 조회 시각과 원천 반영 시각을 별도로 표시한다. 로컬 시뮬레이터로 원천 값을 변경한 뒤 새로 조회할 수 있다.

저장은 이 브라우저의 localStorage 범위다. 완료된 정의와 snapshot을 복원하며 자동으로 모델을 재실행하지 않는다. 미지원 저장 형식은 원본 덮어쓰기를 차단한다. 계정별 저장·공유·보고서·되돌리기·임의 Chat Root 추출은 후속 범위다.

## THREAD / TAB / PANEL / CONTEXT

Chat thread 하나에 Canvas 작업공간 하나를 연결한다. New chat은 빈 작업공간을 열고, 첫 메시지에서 생성된 threadId에 연결한다. 기존 채팅 선택과 reload는 해당 작업공간을 복원한다. 채팅 삭제 시 그 Canvas 저장본도 삭제한다. 생성·조회가 늦게 끝나도 다른 thread의 상태를 변경하지 않는다.

작업공간 안에는 여러 탭을 만들고 선택·이름 변경·삭제할 수 있다. 탭 삭제는 포함된 패널 수를 확인하며 마지막 탭 삭제 후 기본 탭 하나를 남긴다. 패널은 드래그 또는 너비/높이 컨트롤로 크기를 조정하고, 다른 탭으로 이동하거나 맨 위로 이동·삭제한다. 배치 변경만으로 모델이나 조회 API를 호출하지 않는다. 좁은 모바일 화면에서는 너비를 화면에 맞추되 저장된 설정은 유지한다.

Chat은 현재 thread의 전체 탭, 활성 탭, 순서·크기·제목·필터·snapshot 기준 시점, 선택 패널과 진행/실패 상태를 요청마다 전달받는다. “현재 캔버스 상태를 알려줘”는 설명만 수행한다. 기본 생성 위치는 요청 시작 시 활성 탭이다. 탭/크기/탭 간 이동의 자연어 편집 명령은 후속 범위이며 현재는 Canvas 컨트롤로 조작한다.

이전 공용 Canvas는 자동으로 특정 thread에 연결하지 않는다. 가져오기 버튼으로 현재 작업공간에 복사하며 원본을 보존한다. 저장 범위는 같은 브라우저이고, 인증된 서버 측 사용자 저장은 아직 없다.

## ADD / QUERY — Chat 분석 차트 추가

DuckDB 분석 차트는 서버가 발급한 실제 artifact ID를 참조하는 AnalysisChart로 표시하며, 각 차트에 Add to Canvas 버튼을 제공한다. 완료된 차트를 현재 thread의 활성 탭에 추가한다. 추가 클릭은 LLM/SQL을 다시 실행하지 않고 새 패널 ID와 독립 파라미터·snapshot을 만든다. 동일 artifact를 다시 클릭하면 기존 패널로 이동한다. 패널을 삭제하면 다시 추가할 수 있다.

Chat 당시 결과는 유지하며 Canvas 필터/수동·자동 갱신은 Canvas만 변경한다. 새로고침·채팅 복귀 시 저장된 Chat artifact와 Canvas를 각각 복원한다. 조회가 없는 일반 콘텐츠는 아래 Canvas 등록 wrapper를 사용한다. 임의 Root의 자동 추출은 지원 범위 밖이다.

조회 정의(queryId)는 SQL·제목·설명·스키마를 포함한다. 실행 결과는 조건·조회 시각·데이터 버전과 함께 별도 보관한다. 조회 제목과 차트 표시 제목은 다를 수 있다. Chat 차트의 조회 정의 펼치기에서 SQL과 설명을 확인한다.

## 검증 상태

최종 Chrome E2E 16개 통과(50.1초). 등록형 Markdown/표/입력 폼의 추가·삭제·DnD·키보드 재정렬·탭 이동·그리드 폭·입력 독립성·reload와 실제 Python/provider 일반 콘텐츠 생성·부분 수정을 확인했다. 기존 분석 차트 생성/수정/Chat drag 추가/조회/취소/모호성/호환성도 통과했다.

Frontend 348개, Python 전체 59개 통과. planner 보완 후 Python 관련 18개를 재검증했다. typecheck, FSD, production build, Ruff 통과. ESLint 오류 0/기존 경고 5개다. 개별 라이브러리의 모든 요소 조합·외부 액션 동작을 전수 검증한 결과는 아니다.

[최신 registry/DnD 검증 기록](../flow/2026-10-18-canvas-registry-dnd.md)을 참고한다. 이전 검증은 [Chat 추가·FSD 기록](../flow/2026-10-18-add-to-canvas.md)에 보존한다. 기존 개발 서비스 2037/3045는 유지하며 검증 전용 2047/3055는 종료한다.

## REG / DND — 등록형 OpenUI Canvas

등록 wrapper를 적용한 OpenUI 요소 또는 조합은 Chat에서 Add to Canvas, Delete from Canvas, 드래그 추가를 공통 제공한다. 텍스트·Markdown·표·이미지·입력 폼 등 기본 OpenUI library의 요소를 독립 프로그램으로 사용할 수 있다. 쿼리는 일반 위젯의 필수 조건이 아니다.

패널 핸들을 다른 패널에 놓으면 그 앞에 삽입하고, Canvas 빈 영역에 놓으면 끝으로 이동한다. 탭 버튼에 놓으면 해당 탭으로 옮긴다. 24열 좌표 배치와 크기 조절을 유지한다. desktop drag와 Alt+위/아래 키보드 재정렬을 지원하며 터치 drag는 별도 확장이다.

추가 시 입력 상태를 복사하고 Canvas/Chat은 이후 독립 상태를 가진다. Canvas 입력은 reload 후 복원된다. 같은 원본 재추가는 기존 패널 선택이며 삭제 후 다시 추가할 수 있다. 일반 위젯 자연어 수정은 프로그램을 교체하고 입력 상태를 초기화한다. 미등록·불완전 콘텐츠는 추가하지 않는다.

등록이 외부 업무 실행 권한을 부여하지는 않는다. 별도 호스트 연결이 필요한 액션과 서버 tool 왕복은 후속이다. 검증 증거는 [registry/DnD 기록](../flow/2026-10-18-canvas-registry-dnd.md)을 따른다.

## SPLIT-01 — Chat / Canvas 영역 너비

두 영역 사이 구분선을 마우스로 끌면 너비가 즉시 바뀐다. 양쪽 최소 430px, 기본 50:50이며 현재 화면에서 유지한다. 더블클릭 또는 Enter로 초기화할 수 있다. 방향키로 2%씩 조절하며 Escape는 진행 중 드래그를 취소한다. 950px 이하에서는 세로 배치하고 구분선을 숨긴다. 화면 영역 조절은 카드 크기 변경과 별개이며 API를 호출하지 않는다.

SPLIT-01 검증: Chrome 관련 E2E 4개, typecheck/FSD/build 통과. [검증 기록](../flow/2026-10-18-workspace-splitter.md).

## REG-FIX-01 — 등록 콘텐츠 생성 형식 검증

독립 프로그램은 `$state`와 로컬 컴포넌트 선언 뒤에 `root = Col(...)`를 정의할 수 있다. 서버는 첫 문자열이 아닌 root 선언을 검사하며 전체 코드 펜스를 제거한다. packaged catalog의 컴포넌트·함수·액션 호출 이름을 검사하고 잘못된 생성 결과에는 오류 문맥을 전달해 최대 한 번 재생성한다. 로컬 컴포넌트 변수는 호출하지 않고 참조하며 Add/Delete/drag는 호스트 wrapper가 제공한다. 서버 검사는 전체 OpenUI 문법·인자 타입 검증을 대체하지 않으며 최종 검증은 브라우저 parser가 담당한다. 기존 실패 응답은 자동 재실행하지 않는다.

원문 메모/입력 폼 요청의 실제 provider 생성→입력→Canvas 추가→reload 복원을 확인했다. [수정·검증 기록](../flow/2026-10-18-registered-program-fix.md).

## GRAFANA-GRID — 좌표 기반 Dashboard Grid

Grafana의 수동 배치(custom/default) grid 방식을 적용한다. react-grid-layout 2.3.0이 24열, rowHeight 30px, gap 8px, `{x,y,w,h}` 좌표, drag/resize preview, 충돌 밀어내기와 위쪽 빈 공간 정리를 담당한다. 기존 CSS auto-placement와 개별 pointer resize는 교체했다. Grafana의 별도 Auto grid나 전체 대시보드 제품을 복제한 것은 아니다.

패널 기본값은 12×14, 너비 1~24, 높이 4~40이다. 높이 범위는 이 앱의 콘텐츠와 기존 최대 크기를 보존하기 위한 제품 정책이다. ⠿는 좌표 이동, 우하단 핸들은 resize, ↗는 기존 native DnD로 탭 이동/재정렬이다. Chat 추가도 native DnD를 유지하며 grid 안에 놓으면 해당 위치를 시작점으로 충돌 정리한다. 입력/버튼 조작은 이동을 시작하지 않는다. 방향키 이동 및 기존 너비/높이 컨트롤이 키보드 대안이다. Escape로 진행 중 위치/크기 변경을 취소한다.

Grid 이벤트는 thread 소유 store의 setLayouts에 해당 탭 전체 패널 좌표를 전달한다. 모든 영향 패널을 한 번 저장하고 content revision·프로그램·입력·query는 유지한다. 생성/삭제/수동 컨트롤/탭 이동도 같은 normalizeWidgets 경로에서 collision/vertical compaction을 적용한다. 실행 중·호환성 차단·폐기된 thread의 layout commit은 거부한다. 요청된 패널 집합이 현재 탭과 다르면 저장하지 않는다.

문서 저장은 v5. v2/v3 pixel height와 v4의 12열 w/h를 24열 비율 및 가장 가까운 38px row pitch로 변환한다. 좌표 없는 항목은 빈 자리를 순서대로 찾고, 좌표 있는 항목은 충돌을 정리한다. Renderer는 측정한 Canvas container width를 사용하여 splitter 변화에 반응한다. 폭 600px 미만은 한 열 읽기 배치로 표시하고 drag/resize를 끄며 저장 좌표는 보존한다.

실행 파일: entities/analysis/model/grid.ts (계약·migration), features/manage-canvas/model/layout.ts (정규화), model/store.ts (원자적 저장), pages/chat/ui/dashboard-grid.tsx (ReactGridLayout), grid-item.tsx (공통 카드). 조사 출처·적용 기준·최종 검증은 docs/flow/2026-10-19-grafana-grid.md에 기록한다.

GRAFANA-GRID 검증: frontend 356개, Python 관련 29개, 전체 Chrome 21개 통과. 최종 핸들 표시 보완 후 grid 전용 3개(외부 drop/splitter 추가 시나리오 포함)를 재검증했다. typecheck/FSD/build/Ruff 통과, lint 오류 0/기존 경고 5. 조사와 증거는 [Grafana grid 기록](../flow/2026-10-19-grafana-grid.md)을 참조한다.
