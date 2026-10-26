# Grafana UX 참고와 자체 Canvas의 적용

2026-10-25 확인. Grafana 서비스를 설치하거나 화면 코드를 복사하지 않고, 공식 문서와 공개 소스의 상호작용을 참고해 자체 앱에 적용한다.

## 확인한 원본

- [Grafana 패널 개요](https://github.com/grafana/grafana/blob/main/docs/sources/visualizations/panels-visualizations/panel-overview/index.md): 패널은 조회와 시각화의 단위이며 이동·드롭·크기 조절로 배치한다.
- [대시보드 생성/레이아웃](https://grafana.com/docs/grafana-cloud/learn-and-build/visualizations/dashboards/build-dashboards/create-dashboard/): 수동 Custom과 자동 Auto grid를 구분한다. 여기서는 개별 크기와 위치를 조정하는 Custom 경험을 채택한다.
- [Scenes 레이아웃 문서](https://grafana.github.io/scenes/docs/scene-layout/): 콘텐츠와 레이아웃을 분리하며 flex/grid 배치를 제공한다.
- [공개 SceneGridLayoutRenderer 소스](https://github.com/grafana/scenes/blob/main/packages/scenes/src/components/layout/grid/SceneGridLayoutRenderer.tsx): react-grid-layout, 측정한 폭, 고유 항목 key, drag handle/cancel 영역, drag/resize 종료 콜백을 사용한다. 768px 이하에서 드래그를 차단한다. main 브랜치는 이후 변경될 수 있다.

## 적용과 의도적인 차이

| 원본에서 확인한 경험 | 자체 앱의 구현 | 사용자에게 주는 효과 |
|---|---|---|
| 독립 패널 | ID·프로그램·조회 조건·출처·입력 상태를 각각 저장 | 차트 수정 중에도 대상의 정체성 유지 |
| Custom 배치 | 24열 그리드, 명시적 drag handle, resize, 서버 충돌 처리 | 자료를 나란히 비교하고 중요도에 따라 크기 조절 |
| 좁은 화면의 오조작 방지 | Canvas 폭 600px 미만 한 열 표시, 직접 이동/리사이즈 비활성 | 대화와 화면을 나눠 볼 때도 잘못된 배치 변경 방지 |
| 종료 시점의 이동/크기 변경 처리 | 종료 후 공통 명령 저장, Escape로 저장 전 취소 | 움직이는 도중에 중간 배치를 확정하지 않음 |
| 패널 조회와 표현 분리 | SEC 조회형 패널 및 검증된 OpenUI 프로그램 패널 | 실제 조회와 사용자 가정 UI의 근거 구분 |
| 화면 조작 | 같은 명령을 AG-UI 에이전트 도구에도 제공 | 직접 조작과 자연어 요청으로 동일 대시보드 편집 |

빈 공간 보존, 위치 고정, 특정 패널로 이동·강조, 대화별 Canvas, 입력 상태 복원은 이 제품의 선택이다. Grafana의 모든 레이아웃·행 반복·플러그인·권한 기능을 이식했다는 의미는 아니다. 자동 그리드는 목표의 수동 배치 경험과 별개의 기능으로 취급한다.

## 코드와 검증 연결

- frontend/src/features/dashboard/ui/canvas.tsx: 그리드와 사용자 조작.
- frontend/src/features/dashboard/model/grid.ts: 그리드 좌표와 좁은 화면 투영.
- frontend/src/features/dashboard/model/store.ts: 대화별 순차 명령과 revision.
- backend-langgraph/agent/dashboard/store.py: 동일 명령의 서버 저장·충돌·고정 검사.
- backend-langgraph/agent/dashboard/tools.py: 에이전트 패널/탭 명령.

실제 drag·resize·Escape·충돌·고정·reload 증거는 [구현 기록](../flow/2026-10-25-dashboard-implementation.md)에 연결한다. 소스 참고 확인과 실제 앱 검증은 별개이며 SEC 접근 성공을 증명하지 않는다.
