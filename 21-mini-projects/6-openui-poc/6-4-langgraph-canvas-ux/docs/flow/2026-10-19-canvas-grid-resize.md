# 2026-10-19 GRID-01 / RESIZE-01

## 문맥 / 결정

사용자가 참고용 canvas-system.md의 Grid System, Item resize, Drag Drop Layer를 기준으로 오른쪽 Canvas 그리드와 리사이즈를 요청했다. 기존 가로 span + 픽셀 높이 및 pointerup 전용 처리를 교체했다.

- 12열/32px 행/16px gap, 저장 layout {w,h}, 기본 6×11, 범위 3~12 × 4~25.
- 참고 문서의 18행 상한은 기존 1200px 카드 보존을 위해 25행으로 확장했다.
- 공통 GridItem을 분석/등록 카드에 적용. 콘텐츠 스크롤과 고정 우하단 핸들을 분리했다.
- pointermove로 snap preview, pointerup에 한 번 저장, 취소 시 무저장. 방향키 대안 제공.
- 기존 DnD adapter와 store 재정렬/탭 이동/추가 경로 유지. 새 DnD 라이브러리나 좌표 충돌 엔진은 추가하지 않았다.
- v4 저장, v2/v3 pixel layout 읽기 변환. backend 생성 기본 layout과 planner 설명도 grid 단위로 일치시켰다. 프로그램·입력·조회 데이터는 유지한다.

## 검증

- frontend 단위 352 PASS, typecheck PASS, FSD/build PASS.
- ESLint 오류 0, 기존 경고 5.
- Python 관련 29 PASS, Ruff 확인.
- Chrome 5 PASS (7.6초): 실제 마우스 두 축 live resize, gap 기반 snap, 드래그 중 무저장, drop 저장, revision 유지, Escape 취소, 키보드, 두 카드 가로 배치, reload, 기존 registry DnD/교차 thread 차단 및 splitter.
- layout migration/clamp/corrupt input 거부는 단위 검사로 검증. 실제 provider 호출이 필요 없는 UI/저장 변경이며 이번 브라우저 검증은 provider를 호출하지 않았다.
- 보고서 frontend/output/grid-report/index.html; 화면 frontend/output/playwright/canvas-grid-resize.png 육안 확인.
- 검증용 frontend 3055만 실행 후 종료. 기존 서비스 보존.

## Stock

business.md, system.md, canvas-system/canvas-system.md의 GRID-01/RESIZE-01 및 기존 grid 설명을 동기화했다.
