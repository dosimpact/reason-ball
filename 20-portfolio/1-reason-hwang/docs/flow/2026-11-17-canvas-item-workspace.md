# 2026-11-17 선택형 분석 Canvas 구현

- 요구사항: TA-CANVAS-003. 사용자가 승인한 `human-docs/3.dynamic-canvas-openui/goal.md`의 상위 계획.
- 배경: 기존 Canvas가 보고서 전체를 자동으로 표시했지만 사용자는 wrapper로 지정된 차트·표 중 필요한 요소만 모으기를 원했다.
- 범위: `technical_analysis_canvas_agent`와 해당 Chat 화면. 기존 inline·TA-Lib·SEC 출력은 유지한다. 공유 발행은 후속 단계다.

## 변경

- 공통 OpenUI `CanvasItem(id,title,children)`와 Library Explorer 예제, 생성 catalog/spec/Python 사본을 추가했다. Canvas 전용 화면에서만 추가 콜백을 연결한다.
- 선택한 children의 의존 선언·Query·reactive state를 추출한다. 전체 보고서를 복사하지 않고 요소별 별도 Renderer로 렌더링한다.
- 가격 및 지표 인스턴스별 차트를 결정적 OpenUI로 생성하고 설명은 채팅에 남긴다. 기존 custom 보고서 자동 표시를 대체한다. 가격 전용 v2 API는 명시적 `instances=[]`를 허용한다.
- 요소 추가·중복 방지·제거·드래그 순서 변경·두 열 폭/높이 조절·키보드 조절을 구현했다. 현재 브라우저 localStorage에 runtime/thread별 구성과 상태를 저장한다. 저장 차단 시 메모리에서 계속 사용한다.
- 예제의 splitter 저장·초기화·인용 질문·인쇄 패턴을 Host 구조에 맞게 적용했다. 공유 링크 API는 만들지 않았다.
- 인용 문맥은 저장된 보고서와 요소 소속을 검증한다. 차트 재조회와 원래 분석 시점의 차이를 UI에 명시한다.
- PDF는 현재 Canvas를 브라우저 인쇄로 출력한다. 최신 chart Query 성공 전에는 버튼을 막는다. 오래된 요청의 완료가 최신 상태를 덮어쓰지 않는다.
- 분할된 채팅이 SDK mobile 모드로 바뀔 때 헤더가 중복되던 현상을 Canvas 범위 CSS로 수정했다.

## 검증

사용자 요청대로 Playwright는 핵심 흐름만 실행했다. 화면 fixture 검증과 실제 모델/API 결과를 구분한다.

| 검증 | 결과 | 근거 |
| --- | --- | --- |
| Host 타입 검사 | PASS | `pnpm -C 1-fe-host typecheck` |
| Chat 단위 테스트 | PASS 29 | `pnpm -C 1-fe-host test:chat` |
| Wrapper 의존성 추출 | PASS 2 | CanvasItem extraction Vitest |
| Wrapper Storybook | PASS | 전체 관련 view 6개, 후속 한글 버튼 시나리오 1개 |
| PinnedCanvas Storybook | PASS 1 | 제거·접기·PDF 가능 상태 |
| Catalog 동기화 | PASS | `openui:check`: 59 components, FE/Python 일치 |
| 관련 ESLint | PASS | 변경 TS/TSX 파일 범위 |
| 전체 lint | FAIL: 별도 기존 문제 | `dartTesting.ts` constant condition, `talib-validator.mjs` globals. 이번 작업에서 관련 없는 코드를 변경하지 않음 |
| Python | PASS 60 | Canvas·TA20·chart API 관련 pytest |
| Bruno 가격 전용 API | PASS 1 request/1 assertion/1 test | 소유 fixture 서버39997, 07b-price-only-chart.bru |
| 실제 모델·Yahoo API | PASS | AAPL 30일봉·RSI14, ready 보고서·2개 wrapper, Host validator valid=true; 인용 후 presentation=null·보고서 수1 유지 |
| Playwright MCP | PASS: 통제 응답 | 32983 전용 Host, 클릭 추가·중복 방지·이동·크기 조절·기록 복원·인용 후 요소 유지 |
| Playwright CLI | PASS 3 | `canvas-wrapper.spec.ts` 및 inline/Canvas 메뉴 핵심 2개 |

- 새 회귀 테스트 `1-fe-host/tests/e2e/canvas-wrapper.spec.ts`: 자동 Canvas 미표시, 명시적 추가, 중복 방지, 순서·폭 저장/복원, 인용 POST의 reportId/elementId/quote, 제거 후 채팅 UI 보존.
- 첫 두 테스트 실패는 fixture/assertion 문제였다. `grid-column:span 2`는 computed start에 나타나며 end는 auto이고, 인용 응답 fixture는 실제 계약에 맞게 presentation=null로 수정했다. 그 뒤 단일 흐름 PASS.
- 스크린샷: `1-fe-host/test-results/canvas-workspace/pinned.png`, `quote.png`. 최종 실제 차트·인쇄 관찰도 같은 디렉터리에 보관한다. 로컬 실행 산출물은 Git 제외다.
- 인쇄 미디어 화면을 확인했으며 OS 인쇄 대화상자를 통한 최종 PDF 파일 저장은 자동화하지 않았다.

## 제한

- localStorage 저장은 현재 브라우저 한정이며 서버 동기화·공유 발행이 아니다. 대화 기록을 열어 같은 thread로 복원한다.
- 차트는 재조회되므로 저장 당시 가격을 불변 스냅샷으로 고정하지 않는다. 인용 설명은 서버에 저장된 원래 분석 근거를 사용한다.
- 레이아웃은 두 열 그리드의 순서·폭·높이를 조절한다. Grafana 전체 대시보드 기능이나 임의 좌표 편집기를 구현한 것은 아니다.
- 많은 지표를 선택하면 차트별 HTTP 조회가 늘어난다. 공급자 오류는 화면에 표시한다.

## 문서 동기화

- [업무 설계](../stock/technical-analysis/business-design.md#ta-canvas-003-선택형-canvas)
- [시스템 설계](../stock/technical-analysis/system-design.md#ta-canvas-003-선택형-요소와-인용-문맥)
- [Host OpenUI](../stock/tech-shared/1-fe-host/open-ui.md#ta-canvas-003-canvasitem과-library-explorer)

## 자원 정리

기존 사용자 Host 2983와 FastAPI 2981은 재시작하거나 종료하지 않는다. 이번 Host는 `NEXT_DIST_DIR=.next-canvas-wrapper`, 포트32983으로 분리했고, 테스트 전용 Chrome과 API thread만 정리한다. 최종 종료 확인 결과는 아래에 기록한다.


## 최종 실행 보완

- 메뉴 회귀 두 건은 첫 실행에서 페이지 전환/새로고침 timeout이 발생했다. 동일 코드·동일 assertion으로 개발 서버가 준비된 뒤 60초 test timeout으로 재실행해 각각3.1초·4.0초에 PASS했다. 원인을 제품 동작 실패로 확정하지 않았다.
- 실제 모델 AAPL 분석의 program을 브라우저에 재생하고 chart/catalog HTTP는 실제 FastAPI에 연결했다. RSI Canvas에서 실제 캔들·거래량·RSI60.9028,30봉, 기준일2026-11-13 및 PDF 버튼 활성화를 확인했다. 모델 대화 이벤트만 재생이며 브라우저에서 모델을 추가 호출하지 않았다.
- 증거: `1-fe-host/test-results/canvas-workspace/live-rsi.png`, `live-print.png`. 실제 전체 그래프 API thread는 삭제204 후 조회404 확인. 예전 Bruno22/23의 기대값도 새 presentation 계약으로 갱신했지만 전체 컬렉션은 재실행하지 않았다.
- 관련 API 검증에는 `apb-bruno-api-tests`, 화면 검증에는 `apb-playwright-e2e` 스킬을 적용했다.

- 최종 인쇄 검증에서 사이드바의 빈 여백을 제거하고 전체 차트와 기준일·조회 시각이 잘리지 않음을 확인했다. 화면에서는 저장 높이380px이 적용되고 내용은 스크롤되며 인쇄에서는 전체 높이로 펼친다.
- 정리 완료: 소유 Next 프로세스7847/7856 종료, 포트32983/39997 리스너 없음. MCP browser_close 후 Chrome7882 및 관찰한 자식 프로세스가 남지 않음을 확인했다. CLI/Storybook의 브라우저도 러너 종료로 정리했다. 소유 `.next-canvas-wrapper`를 삭제하고 Next가 자동 수정한 next-env/tsconfig만 원복했다.
- 기존 사용자 Host12379/2983와 FastAPI supervisor12376/2981은 유지했다. FastAPI reload 자식 PID 변경은 관찰했으나 사용자 서버를 재시작하지 않았다.
