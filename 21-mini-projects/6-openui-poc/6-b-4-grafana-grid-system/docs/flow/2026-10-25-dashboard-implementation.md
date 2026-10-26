# 승계와 사용자 시나리오 감사

기준: goal.md와 6-2·6-4·6-5의 docs/stock/business.md 및 6-4 시스템 설계. 아래는 2026-10-25 현재 작업 트리의 완료 증거와 남은 차이다. 원본의 완료 기록은 6-7의 새 검증을 대신하지 않는다.

## 승계 기능

| 원본 계약 | 현재 6-7 | 남은 작업 |
|---|---|---|
| 6-2 DOC-002 PDF 준비·검색·페이지 출처 | 준비 CLI·검색·자료 저장 승계, 실제 비교 대화 보존 | 요약·섹션·여러 연도 분석의 대표 브라우저 흐름 확대 |
| 6-2 DOC-003 비교·Sources·테마·도구 보기 | /comparison 승계, 기존 E2E 통과 기록 확인 | 주 헤드리스 채팅의 도구 진행/근거 보기 UX는 비교 화면과 완전히 같지 않음 |
| 6-2 DOC-004 대화 CRUD·중단·복원 | SQLite·실행 가드·기존 단위 검증 유지 | 중단→새로고침→후속 질문 브라우저 확인. 실패 상태 저장/잠금 해제 API 검증. 실환경 외부 오류 후 재개 추가 확인 |
| 6-5 MERGE-001 137 컴포넌트·59 함수·CopyToClipboard | 기존 계약 유지, 138 컴포넌트·60 함수·2 액션 | 모든 조합의 전수 검증을 주장하지 않음 |
| 6-5 gallery/preview 45 예제 | /gallery·/preview 유지, 승계 E2E 결과 확인 | 현재 변경과 관련된 추가 회귀 발생 시 재실행 |
| 6-4 CHAT/CANVAS/PATCH | headless 채팅·선택 맥락·서버 명령·부분 수정 | 기존 대상 ID별 성공 검사 및 두 패널 제목/고정 브라우저 검증. 신규 생성 개수·필드 의미 검증은 남음 |
| 6-4 FRESH 수동 갱신·polling·Snapshot | 모델 없는 갱신·1/5/15분 polling·Snapshot·시각/오류 보존 구현 | API 단위 및 격리 UI 검증 통과. 실제 SEC 갱신 성공은 403으로 남음 |
| 6-4 THREAD/TAB/PANEL | 대화별 SQLite Canvas·탭 CRUD·패널 탭 이동 | native 탭 드래그와 입력 보존 확인. 내용 있는 탭 삭제 경험 차이 확인 필요 |
| 6-4 ADD/REG/DND | 독립 프로그램·artifact ID·버튼/외부 drag·중복 방지 | 버튼/탭 드래그 입력 복사·삭제 후 재추가·native 탭 이동 브라우저 확인. grid 내부 drop 좌표 추가 검증 |
| 6-4 GRAFANA-GRID | 24열·이동·리사이즈·충돌 처리·핀 | grid drag 중 Escape 취소와 외부 drop 좌표 반영 확인/보강 |
| 6-4 좁은 화면·키보드 | 600px 미만 표시만 한 열, 저장 좌표 유지; 방향키 이동/Shift 크기 조절; 너비/높이 선택 | 직접 조작과 저장 보존 브라우저 확인, 추가 접근성 검토 |
| 6-4 SPLIT-01 | pointer/방향키·Home/End/Enter·더블클릭 초기화·Escape/pointercancel 복원 | End/Enter 및 실제 drag→Escape→추가 이동 후 48% 유지 확인 |
| 6-4 QUERY 합성 분석 | 6-7은 SEC 재무 쿼리/SQLite와 원문 분석을 채택 | 합성 DuckDB 분석 엔진을 그대로 승계했다고 주장하지 않음. 사용자 목표의 Canvas UX를 SEC 조회 경로에 연결해야 함 |
| 6-4 QUICKSTART | SEC/Canvas 시작 카드 제공 | 일반 폼·메모·복수 패널 예시와 초보 사용자 동선 확인 |

## US-01~16 증거와 남은 검증

| 시나리오 | 현재 증거 | 남은 검증 |
|---|---|---|
| US-01 수집 | 수집 그래프 단위 테스트, SEC 403 확인 | 실제 SEC 원문 수집 성공 |
| US-02 요약 | 검색·생성 경로 구현 | PDF 목차·사업·위험·MD&A/재무 6페이지 읽기와 요약 확인. 단일 보고서 완독을 주장하지 않으며 SEC 수집 기반 검증은 남음 |
| US-03 섹션 | 파서/섹션 도구 단위 검증 | PDF 위험 요인 12페이지 원문 읽기/정확한 일부 발췌/범위 표시 확인. SEC 섹션 경로는 남음 |
| US-04 후속 분석 | PDF 비교 후 설명 요청, 상태 유지 | PDF 12페이지 발췌→36·37페이지 실적 원인 후속 분석과 원문 대조 확인 |
| US-05 기업 비교 | PDF 3사 표·페이지 링크·CSV 일치 | 누락 항목 재검색과 비교 조건 변경 |
| US-06 다년 분석 | 연간 수치/누락/YoY 단위 테스트 | 실제 10년 조회·기간 제외·정성 변화 |
| US-07 inline 탐색 | 계산기 함수·입력·0 처리·액션 | 추가 일반 UI 상호작용 |
| US-08 Canvas 추가 | 실제 artifact 버튼 추가·직접 생성 | 버튼 및 탭 drag 입력 복사 확인; grid 좌표 drop 검증 남음 |
| US-09 선택 맥락 | 선택 표 제목/너비 변경과 설명 전용 요청 | 동명 패널 확인 흐름 |
| US-10 범위 수정 | publish 도구의 기존 ID 유지 | 실제 데이터 기간 확대/제외와 실패 보존 |
| US-11 배치 | resize·너비/높이·키보드·모바일 저장 보존 | 다중 패널 drag 충돌·취소 |
| US-12 고정/이동 | 모델 pin·너비, FocusPanel 클릭 | 고정 시 직접 조작 거절·해제·다른 탭 focus |
| US-13 삭제 | 서버 단위 검증 | 브라우저 삭제·채팅 artifact 보존·drag 재추가 확인; 원문 보고서 경로 추가 확인 |
| US-14 다운로드 | JSON/CSV/다중 탭 PDF, 정상·오류 import | 가정 데이터 차트 6개 관측치·표 80셀 CSV 일치, 3페이지 PDF 확인. 실제 SEC 수집 검증과는 별개 |
| US-15 복원 | 대화 복귀·새로고침·입력값 복원 | 생성·이름 변경·새로고침·임시 대화 삭제/연결 Canvas 정리 확인 |
| US-16 실패 | 프로그램 검증 실패·import 보존·SEC 실패 | 사용자 흐름의 실패→재시도 전체 |

증거 경로는 [진행 기록](../flow/2026-10-25-dashboard-implementation.md)에 누적한다. 위 표에 남은 항목이 있는 동안 전체 목표 완료로 표시하지 않는다.
- 최종 frontend 435 tests, TypeScript/Steiger/production build 통과. 파서 오류 타입의 ValidationError/OpenUIError 불일치를 수정한 뒤 빌드를 재실행했다. 실제 검증 API에서도 본문을 버리는 초과 인자가 거절되는 것을 확인했다.


## Canvas drag/resize Escape 취소 보강

- 날짜: 2026-10-25. US-11 / CANVAS-01 / SYS-07.
- 발견: 그리드 drag/resize stop이 항상 저장되어 사용자 취소 경로가 없었다.
- 변경: gesture 시작/종료를 추적하고 Escape에서 임시 그리드를 해제하여 저장된 배치로 복원한다. 취소 이후 stop은 무시하며 정상 stop은 기존 명령으로 저장한다.
- 브라우저: 대화 `063437c5-a7e0-42f9-a240-44d1c0ee5b42`의 입력 계산기에서 실제 drag/resize 활성 CSS 상태를 확인한 뒤 Escape → 추가 마우스 이동 → mouseup을 수행했다. 각 작업 전후 GET state 전체가 동일했다. 가정 성장률 패널은 이후 일반 drag의 POST 성공과 상태 변경을 확인하고 reload했다.
- 검증: npm run typecheck, npm run lint:fsd 통과. 증거는 frontend/output/playwright/grid-escape-result.txt, grid-escape.png, grid-normal-result.txt. 기존 콘솔 오류를 이번 수정으로 해결했다고 주장하지 않는다.
- 동기화: business CANVAS-01, system SYS-07, inheritance-audit의 US-11과 그리드 행 갱신. 외부 drop 좌표·충돌 상세 검증·내용 있는 탭 삭제 등은 계속 남아 있다.


## 내용 있는 Canvas 탭 삭제

- 날짜: 2026-10-25. CANVAS-02 / US-13 / 6-4 THREAD-TAB 승계.
- 변경: 현재 탭 삭제 확인창에 제목·패널 수·보존 범위를 표시한다. 취소는 명령을 보내지 않는다. 서버는 nonempty 탭에 remove_panels=true를 요구하고 해당 패널과 선택만 정리한다. 마지막 탭은 유지한다. Agent 도구 설명에 내용 삭제 의도 확인을 추가했다.
- 검증: backend 81 tests 및 Ruff, frontend typecheck·변경 파일 ESLint·Steiger 통과. Playwright에서 API로 임시 탭/텍스트 패널을 준비한 후 실제 확인창 취소와 승인을 수행했다. 취소 전후 전체 서버 상태 동일, 승인 후 대상 제거와 다른 패널/artifact 동일을 확인했다. 준비 중 기존 계산기 복제 프로그램은 validator에서 거절되어 별도 단순 텍스트 프로그램을 사용했다. 원본은 수정하지 않았다.
- 증거: frontend/output/playwright/tab-remove-result.txt, tab-remove-after.txt. 임시 대상만 제거하고 검토 대화는 보존했다. Agent 자연어 확인 흐름 검증은 남아 있다.
- 동기화: business CANVAS-02, system 탭 삭제 확인, inheritance-audit, implementation-status.


## 외부 드롭 좌표와 패널 충돌 검증

- 날짜: 2026-10-25. US-08 / US-11 / SYS-07.
- 발견/변경: 빈 안내가 그리드를 아래로 밀던 문제를 absolute overlay로 수정했다. 열 간격을 포함한 dropPosition을 분리하고 경계를 제한했다. verticalCompactor가 저장된 빈 공간을 화면에서 없애던 차이를 noCompactor로 해소하여 사용자가 놓은 위치를 유지한다.
- 브라우저: c1422a2c 연구 대화의 36-37페이지 분석 artifact를 실제 native drag로 빈 Canvas x=4,y=3에 추가했다. 서버 좌표 및 reload 후 120px 상단 여백 일치를 확인했다. 이 패널은 사용자 검토용으로 보존했다. 계산기 대화의 입력 검증 탭에서는 성장률 패널을 계산기 위치로 drag하고 서버/화면 비겹침 및 layout 외 전체 패널 필드 보존을 확인했다. 첫 시도는 활성 탭이 달라 핸들을 찾지 못했고 올바른 탭 선택 후 재검증했다.
- 검증: frontend 436 tests, typecheck, 변경 TS/TSX ESLint 통과. 증거: artifact-grid-drop-result.txt, artifact-grid-drop.png, grid-collision-result.txt, grid-collision.png, grid-unit.txt (frontend/output/playwright).
- 문서: business, system, inheritance-audit, implementation-status 동기화. 전체 SEC 성공과 나머지 승계 검증은 계속 남아 있다.


## 고정·탭 간 focus 및 온보딩 갱신

- 날짜: 2026-10-25. US-12 / SYS-07 / goal 4.1.
- 실제 UI 검증: 입력 계산기 고정 시 이동·탭 drag·위로 이동 버튼 및 너비·높이·탭 선택이 disabled이고 resize handle이 보이지 않았다. 마우스 drag 전후 전체 서버 상태 동일, 해제 후 원래 패널 전체 동일을 확인했다. 성장률 계산기 대화의 FocusPanel 버튼을 다른 탭에서 클릭해 목표 탭 전환·선택 ID·화면 강조·내용 보존을 확인했다.
- 온보딩: 입력 복사, Escape, 고정/삭제, 좁은 화면, 중단/재개, 실제 원문 범위, 차트 CSV와 JSON 복원 안내를 현재 구현에 맞췄다. 과도한 자동 검증 보장 표현을 줄였다. 작은 화면에서 전체 구조를 볼 수 있게 minZoom을 낮추고 큰 minimap을 숨겼다.
- 검증: 타입·변경 파일 ESLint·Steiger 통과. 구조도 9개 노드 렌더, Zoom In transform 변경, 모바일 390px Fit View와 페이지 가로 넘침 부재 확인. 모바일 스크린샷을 보고 minimap이 큰 문제를 수정했다. 최초 zoom 자동화는 버튼 대소문자 불일치로 실패했고 스냅샷의 실제 접근성 이름으로 재실행했다.
- 증거: frontend/output/playwright/pin-direct-result.txt, focus-cross-tab-result.txt, focus-cross-tab.png, onboarding-result.txt, onboarding-desktop.png, onboarding-mobile.png. 사용한 대화와 분석 패널은 보존했다.
- 문서: inheritance-audit US-12 및 system 온보딩 안내 동기화. 전체 목표의 남은 연구/Agent 흐름 검증은 유지한다.


## 동명 패널 확인 단계 보강

- 날짜: 2026-10-25. US-09 / CANVAS-01 / SYS-02.
- 실제 발견: 새 대화 f854d038-b615-4c42-8760-ac7ee1a8515a에서 모델이 Overview와 비교 탭에 같은 제목의 패널 두 개를 생성했다. 단수 제목 변경 요청과 선택 무시 지시에도 두 제목을 모두 변경했다(revision 7). 이 실패 이력도 보존한다.
- 수정: CanvasPlan에 clarification을 추가했다. 확인 필요 상태는 operations/targets를 지우며 Canvas 도구를 inspect_dashboard로 제한한다. 동명 단수 요청을 전체 변경으로 해석하지 말고 탭을 확인하도록 계획/실행 지침을 보강했다. 단위 테스트는 잘못 포함된 mutation 계획 제거와 변경 도구 배제를 검증한다.
- 실제 재검증: 같은 대화에서 모델이 Overview/비교 중 대상을 질문했다. revision 7과 두 제목이 유지됐다. 사용자가 비교 탭을 지목하자 revision 8, 비교 패널만 검증 완료로 변경되고 Overview 제목과 두 프로그램의 가정 A:100/B:200이 유지됐다. 브라우저 최종 답변과 저장 상태를 대조했다.
- 검증: backend 82 tests 및 Ruff 통과. frontend/output/playwright/ambiguity-created.txt, ambiguity-clarified.txt, ambiguity-resolved.txt에 브라우저 증거. 확인 분류는 모델 판단이며 모든 표현의 정확성까지 보장하지 않는다.
- 문서: business, system, inheritance-audit, implementation-status 동기화. 비교 범위 변경 및 나머지 전체 목표 검증은 계속 남아 있다.


## 비교 범위 변경에서 발견한 근거·읽기 전용 오류

- 날짜: 2026-10-25. US-05 / US-16 / RESEARCH-01.
- 실제 발견: 5cff361a 비교 대화에서 Intel을 제외하고 AMD 누락을 재검색하는 요청은 수행됐으나, NVIDIA 데이터센터 매출에 AMD의 16.6B를 잘못 사용했다. NVIDIA 원문 37/40과 AMD 55/74를 직접 대조해 발견했다. 또한 Canvas 변경 금지 요청에도 변경 도구가 노출돼 기존 패널을 갱신했다.
- 변경: GroundingGuard가 이번 턴 조회 근거와 최종 답변의 기업·수치·기간·단위·페이지를 별도 모델로 대조한다. 불일치 시 최대 두 번 재검토하고 실패하면 답변을 보류한다. 실제 잘못된 후보 수치를 넣어 거절되는 것도 확인했다. 초기 검사에서 맞는 반올림 값도 issues에 섞여 반올림 허용/오류만 반환 지침을 보강했다. 원문 확인 턴은 최종 검사 후 텍스트를 전송한다. 변경 작업 없는 계획은 Canvas 조회 도구만 제공하도록 수정했다.
- 복구: 잘못 바뀐 기존 패널 ab08b739-1255-4512-b815-3e57a2fbdcad를 source artifact 011af010-b92b-41c8-b258-45b14635d65a의 프로그램/출처와 기존 제목 반도체 비교 요약으로 복원했다. 배치와 입력은 유지했다. 원본 artifact는 변경되지 않았다.
- 최종 검증: 원문 NVIDIA 40페이지/AMD 55페이지로 범위를 좁힌 요청에서 총매출 215,938/34,639 백만 달러와 종료일 2026-01-25/2025-12-27이 정확히 표시됐다. NVIDIA 데이터센터 16.6B의 근거가 없음을 답변에 명시했다. Canvas revision 11은 유지됐다. 기존 실패·정정 대화를 모두 보존했다. 데이터센터 비교 전체 성공을 주장하지 않는다.
- 검사: backend 86 tests 및 Ruff 통과. 기존 analysis-only 도구 기대값을 새 읽기 전용 정책에 맞춰 수정했다. 단위 검증은 현재 턴 근거/기업 귀속 유지, 재시도·보류, 정상 통과, 읽기 전용 도구 배제를 다룬다.
- 증거: frontend/output/playwright/comparison-followup-request.txt, comparison-withheld.txt, comparison-readonly-state.txt. 모델 기반 근거 검사는 정확성을 보장하지 않으며 Canvas 내부 프로그램 전체의 사전 검증도 아직 아니다.
- 문서: business/system/inheritance-audit/implementation-status 갱신. 전체 목표는 계속 진행 중이다.


## OpenUI 게시 전 근거 검사와 데이터센터 비교 완성

- 날짜: 2026-10-25. US-05 / US-08 / US-10 / RESEARCH-01.
- 변경: GroundingGuard.awrap_tool_call이 publish_ui_panel과 update payload.program을 저장 전에 검사한다. 불일치 또는 검사 서비스 오류는 handler 호출 없이 실패 ToolMessage로 반환한다. 제목-only는 제외하며 가정 UI는 허용한다. 게시 검사는 서버 소유 과거 도구 근거도 최대 24개/200,000문자로 재사용하고 current_turn 구분을 유지한다. 모델 답변은 증거가 아니다.
- 실제 거절: AMD 55/NVIDIA 40페이지를 근거로 NVIDIA Data Center 16.6B를 게시하려는 호출을 실제 검증 모델이 거절했으며 저장 handler에 도달하지 않았다. 실제 대화의 근거 부족 업데이트도 거절되어 기존 패널을 유지했다.
- 실제 성공: 총매출 비교 새 패널 e6e73e13-1d47-4674-a370-e3ee368021ab를 게시했다. NVIDIA Revenue by End Market 재검색으로 79페이지를 찾았고 AMD 55페이지와 대조했다. 최종 총매출/데이터센터 값은 NVIDIA 215,938/193,737, AMD 34,639/16,635 (백만 USD), 종료일은 각각 2026-01-25/2025-12-27이다. 원문 표와 직접 대조했다.
- 중간 문제/수정: planner가 자료 확인을 사용자 의도 확인으로 혼동해 갱신하지 않았다. clarification은 대상/제외연도/삭제범위 등 사용자 의도에 한정하고 근거 탐색은 에이전트가 수행하도록 지침을 보강했다. 마지막 실제 요청에서 양쪽 페이지 읽기와 저장이 성공했다.
- 브라우저: 비교 대화 5cff361a-f605-4d80-959f-e14cf102255c, revision 14, 패널 2개 유지. 대상 ID와 x0/y0/w12/h12 유지, 기존 반도체 비교 요약의 프로그램/제목 보존, 네 수치의 cell 표시와 reload 후 193,737 복원을 검증했다. 대화와 결과를 보존했다.
- 검사: backend 87 tests, Ruff 통과. 증거: frontend/output/playwright/grounded-panel-created.txt, datacenter-panel-final-result.txt, datacenter-panel-final.png. 전체 기존 artifact/JSON 사실검증이나 모델 오판 부재를 보장하지 않는다.
- 문서: business/system/inheritance-audit/implementation-status 동기화. 실제 SEC 수집·다년 조회 등 전체 목표의 남은 항목은 유지한다.


## 헤드리스 채팅의 도구 활동 표시

- 날짜: 2026-10-25. CHAT-01 / US-01·16 / 6-2 도구 보기 승계.
- 변경: OpenUI useToolActivities 기반 ToolActivities를 assistant 메시지에 연결했다. 텍스트 없는 호출도 보이고 작업명·문서/페이지/섹션을 표시한다. JSON 실패/부분실패와 단순 응답 수신을 구분하며 종료 후 결과 없는 호출은 미완료로 표현한다. 원시 도구 결과나 프로그램은 표시하지 않는다.
- 실제 검증: 기존 비교 대화의 원문 읽기와 저장 실패가 표시됨을 확인했다. 빠른 페이지 읽기의 진행 상태는 첫 자동화가 놓쳤으므로, 새 AMD 검색에서 DOM MutationObserver로 실제 진행 중 렌더를 관찰했다. 종료 후 응답 수신, reload 후 검색/실패 이력 존재 및 stale 진행 중 상태 부재를 확인했다. 대화는 보존했다.
- 검사: frontend 438 tests, typecheck, workspace ESLint, Steiger 및 production build 통과. 증거: frontend/output/playwright/tool-progress-history.txt, tool-progress-observed-result.txt, tool-progress-completed.png, tool-progress-reload-result.txt, tool-progress-unit.txt, tool-progress-build.txt.
- 문서: business/system/inheritance-audit/implementation-status 동기화. 이 요약 UI는 원시 도구 결과 상세 inspector와 다르며 기존 /comparison은 유지한다.


## SEC 실패 후 PDF 분석 재개와 시작 예제

- 날짜: 2026-10-25. US-01/16, CHAT-01, QUICKSTART.
- 실제 흐름: 새 대화 0a873d3e-bd7f-4fdc-a5cc-41dc61771074에서 SEC 조회가 403으로 실패했다. 재시도에서도 실패했으며 모델은 준비된 PDF까지 없다고 잘못 안내했다. 같은 대화에서 NVIDIA PDF 37페이지 읽기로 전환한 최종 답변은 215,938백만 USD/65% 성장과 PDF 부재 설명의 정정을 제공했다. 원문 37페이지 표와 대조했으며 Canvas revision 1을 유지했다. 검증 대화를 보존했다.
- 변경: SEC HTTP 오류에 상태/공개 host/재시도 가능 여부를 추가하고 헤더·쿼리는 노출하지 않는다. 최종 근거 검사에 SEC 도구 결과와 서버 PDF 목록을 포함했다. Canvas planner가 채팅 artifact를 패널 update 대상으로 잘못 지정한 사례를 발견하여 실제 panel/tab ID 및 필수 target 검증과 최대 2회 재분류를 추가했다. SEC 수집/확인과 Canvas 저장·내보내기를 구분하는 지침을 보강했다.
- 시작 예제: 가정 계산기, 분석 입력 폼, 메모와 체크리스트 카드 추가. 실제 첫 화면에 표시됨을 확인했다. 폼·메모 전체 실행 검증은 후속 작업이다.
- 검사: backend 90 tests/Ruff, frontend typecheck·workspace ESLint 통과. 도중 구문 오류는 즉시 수정 후 전체 backend 검사를 통과했다. 증거: frontend/output/playwright/sec-catalog-final.txt, sec-recovery-pdf-final.txt, starters-expanded-result.txt, starters-expanded.png.
- 범위: SEC 수집 성공이나 모든 오류 유형의 회복 검증을 의미하지 않는다. 403은 외부 차단으로 남는다. business/system/inheritance-audit/implementation-status를 동기화했다.


## 입력 폼 시작 예제의 실제 상호작용과 게시 참조

- 날짜: 2026-10-25. US-07/08/15, QUICKSTART.
- 실제 발견: 시작 버튼으로 생성된 폼은 Chips 선택을 초기값 슬롯에 연결하여 복사 문자열에서 관심 항목이 빠졌다. 별도 raw 폼과 artifact shelf에도 중복 표시됐다. 반응형 Select 사용 지침과 새 게시 artifact의 최종 root 참조 검사를 추가했다. 반복 게시가 동일 결과를 늘려 동일 제목/프로그램/출처를 기존 ID로 재사용하도록 보강했다. 기존 artifact 보기 요청을 신규 게시로 분류하던 문제도 지침을 보강했다.
- 실제 검증: 대화 421a24e5-0886-45d6-a0b9-f9002eed77f2에서 수정된 Select 폼은 AMD/데이터센터 성장 원인/segments가 모두 실제 clipboard에 복사됐다. 등록된 f0ff5fcc-d0a3-4ab2-b2b4-31e8ba753df7 재표시 후 최종 답변의 artifact/form 각 1개를 확인했다. 현재 입력값으로 Canvas 추가, reload 후 기업명·질문·Segments 선택 복원을 확인했다. 초기 실패 및 중복 artifact는 역사로 보존했다.
- 한계: 최초 생성부터 재시도 없이 항상 올바른 폼/게시를 만든다는 검증은 아니다. 최초 게시 재구성은 표시 미완료를 거쳤고 기존 결과 재표시로 복구했다. 메모·체크리스트 예제는 아직 실행하지 않았다.
- 검사: backend 92 tests/Ruff, frontend 438 tests/typecheck/변경 파일 ESLint/Steiger 통과. 참조 ID는 실제 root에서 도달 가능한 노드만 포함하며 바깥 표현식은 포함하지 않는다. 병렬 반복 게시의 동일 ID/단일 저장 테스트 추가.
- 증거: frontend/output/playwright/form-copy-fixed-result.txt, form-artifact-final-result.txt, form-canvas-restored-result.txt, form-canvas-restored.png, form-unit.txt. business/system/inheritance-audit/implementation-status 동기화.


## 메모·체크리스트 복원과 연속 저장 충돌 수정

- 날짜: 2026-10-25. US-07/08/15, INPUT-01.
- 발견: 초기 대화 719a23de에서 잘못된 폼 구성과 중복 메모 생성. 독립 IuiTextArea/Checkbox 지침, 실행 내 동일 게시 중복 방지, minimum_new_panels 검사와 새 분석 split 전환을 추가했다.
- 실제 재실행: 308d6ba3-5418-4350-8ac3-7c1c8bf6fec7에서 서로 다른 메모/체크리스트 패널이 생성됐다. 그러나 최종 미완료 안내는 남았다. 저장 도구 이력에서 서로 다른 add ID 2개를 확인했으며 완료 판정 원인은 후속 조사 대상이다.
- 추가 발견/수정: 메모 직후 체크 두 개를 연속 변경하면 동일 revision 요청들이 409로 실패했다. frontend command를 대화별 Promise queue로 직렬화했다. 외부 충돌은 재시도 덮어쓰기하지 않고 기존 오류 안내를 유지한다.
- 검증: 메모 원문 확인 후 기업별 회계기간 비교하기, 원문 확인=true, 출처 점검=true, 기간 비교=false가 reload 후 유지됨을 실제 브라우저로 확인했다. 대화와 초기 실패 이력을 보존했다. backend 94 tests/Ruff, frontend 신규 queue 테스트/typecheck/변경 파일 ESLint 통과.
- 증거: frontend/output/playwright/memo-retry-snapshot.txt, memo-queue-edit.txt, memo-restored-result.txt. stock business/system/implementation-status 동기화. SEC 403 및 전체 목표의 나머지 검증은 남는다.


## 신규 패널의 빈 대상 ID로 인한 잘못된 미완료 판정 수정

- 날짜: 2026-10-25. US-08/15, CANVAS-01.
- 재현: 대화 308d6ba3의 첫 요청을 빈 Canvas에서 다시 분류한 실제 모델 계획이 minimum_new_panels=2와 add targets의 빈 ID 두 개를 반환했다. 두 성공한 add ID가 있어도 missing_effects가 add target=을 요구함을 확인했다. 원래 실행 계획은 별도 보존되지 않아 과거 계획과 완전히 동일하다고 단정하지 않는다.
- 변경: 신규 add/artifact_publish/tab_add의 빈 placeholder target은 정규화에서 제외한다. 실제 생성 개수 검사 및 기존 대상 ID 요구는 유지한다. 회귀 테스트는 두 개 성공 시 완료, 한 개일 때 미완료를 확인한다.
- 실제 검증: 새 분석의 메모와 체크리스트 시작 버튼으로 대화 83057618-023c-436f-9e0b-9110d08883c2 생성. 패널 018d05fe-d6c2-483d-9f39-d4e9e0804621과 def7ebb4-6e04-4fde-9c4f-5aa59e299916이 각각 저장됐고 저장 미완료 안내가 없었다. 메모와 기간 비교 체크를 연속 변경한 뒤 서버 상태와 reload 화면을 대조했다. 원문 확인 미선택도 유지됐다. 이전 실패 대화는 보존했다.
- 검사: backend 95 tests/Ruff; frontend 전체 439 tests 통과. 증거: frontend/output/playwright/memo-completion-snapshot.txt, memo-completion-restored.txt, memo-completion.png, memo-full-tests.txt.
- 문서: business/system/implementation-status/inheritance-audit 현재 상태를 동기화했다. 실제 SEC 수집과 다년 기간 수정 검증 등 나머지 목표는 계속 진행한다.


## 공식 전년도 보고서 추가와 다년 비교·기간 수정

- 날짜: 2026-10-25. US-06/10, RESEARCH-02.
- SEC 재확인: 기업 티커 목록과 Company Facts 모두 403. 우회하지 않고 공식 NVIDIA IR annual-reports-and-proxies가 링크하는 FY2025 PDF를 별도 PDF 분석 경로로 추가했다. SEC 수집 성공으로 취급하지 않는다.
- 준비: `uv run prepare-documents --include-history`, 4개 문서/2291개 구절. 신규 nvidia-2025 181페이지. FY2025 Summary는 실제 PDF 130페이지(내부 인쇄 쪽수 38)임을 원문으로 확인했다.
- 실패와 수정: 첫 실제 분석은 관련 없는 페이지 번호를 반복 추측해 실패했다. find_document_pages를 추가하여 문구별 실제 페이지 위치를 찾게 했고, PDF-only 분석은 검증된 원문으로 일반 OpenUI 패널을 게시하도록 지침을 명시했다. 검색 결과 자체는 원문 읽기 증거로 세지 않는다.
- 실제 검증: 대화 41b4f318-03f5-4c85-93cc-0803dee07f3c의 재시도에서 FY2025 130,497/114%, FY2026 215,938/65%와 성장 원인 비교를 원문 130/37페이지와 대조했다. 동일 패널 7712d4c6-14f6-43bb-a1a7-c8ada6dcee82를 세 해(60,922/130,497/215,938)로 확대한 뒤 FY2025를 제외했다. 최종 revision3, 패널1개, x0/y0/w12/h12 유지. 원문 근거 두 개를 sources에 저장하고 reload 후 60,922/215,938 표시·130,497 부재 및 정확한 종료일을 확인했다.
- 발견한 후속 과제: 첫 게시/확대는 program 내 출처만 넣고 패널 sources를 누락했다. 후속 명시 요청으로 복구했으나 자동 동기화가 필요하다. FY2026 성장 원인은 후속에서 원문 표현인 가속 컴퓨팅·AI 전환으로 정리했다. 초기 실패와 복구 대화는 모두 남겼다.
- 검사: backend 96 tests/Ruff, frontend typecheck/변경 파일 ESLint 통과. 증거: backend-langgraph/output/history-prepare.txt; frontend/output/playwright/history-comparison-result.txt, history-retry-result.txt, history-expand-result.txt, history-exclude-restored.txt, history-exclude.png.
- 문서: backend README, stock business/system/implementation-status/inheritance-audit 동기화. 실제 10년 SEC 조회 및 전체 목표의 남은 검증은 유지한다.


## 화면 출처와 저장 메타데이터 동기화

- 날짜: 2026-10-25. SOURCE-01 / US-08/14.
- 문제: 실제 다년 비교에서 Card의 sources에는 링크가 표시됐지만 publish_ui_panel의 sources 인자가 빠져 저장 메타데이터가 비었다.
- 변경: frontend 검증 API가 유효한 root에서 도달 가능한 element의 출처를 추출해 반환한다. 게시 도구는 명시 출처와 합쳐 중복 제거한다. 업데이트는 새 프로그램/인자 출처로 교체하며 기존 출처를 무조건 누적하지 않는다. 기존 전체 데이터에는 소급 적용하지 않았다.
- 테스트: 미사용 선언 제외/중복 제거 frontend 회귀, 실제 게시 시 metadata 저장과 update 교체 backend 회귀. 초기 backend 테스트의 가짜 program이 store의 root 검사를 통과하지 못해 유효한 프로그램 fixture로 수정했다. 최종 backend97/Ruff, frontend440/typecheck/변경 파일 ESLint 통과.
- 통합/브라우저: 대화 41b4f318의 패널 7712d4c6-14f6-43bb-a1a7-c8ada6dcee82를 기존 프로그램 그대로 sources 인자 없이 게시했다. 실제 frontend parser를 거쳐 sources2개가 유지됐고 패널 객체 전체가 이전과 같았다(revision4). 모델 재생성 검증과 구분한다. reload 후 JSON 버튼으로 다운로드하고 dashboard.panels 내 page37/page130 출처와 기존 ID를 확인했다. 처음 파일 검사에서 export envelope를 놓친 경로를 정정 후 통과했다.
- 증거: frontend/output/playwright/source-sync-download.txt, source-sync-export.json. stock business/system/implementation-status 동기화. 외부 favicon404는 별도 남은 화면 오류이며 console clean을 주장하지 않는다.


## 탭 ID 계약·반복 생성 및 삭제 확인 검증

- 날짜: 2026-10-25. TAB-01, CANVAS-02, 온보딩.
- 발견: 검증 대화 4294279a에서 tab_add 응답에 ID가 없어 반복 탭 생성/잘못된 게시 위치 발생. tab_id 응답과 publish_ui_panel의 명시적 탭 인자, 지원 action enum을 추가했다. 후속 c31d5feb에서도 탭 생성 재시도로 동명 탭이 중복되어 동일 실행의 같은 요청을 기존 ID로 반환하도록 보강했다. 기존 실패 이력을 삭제하지 않았다.
- 삭제 문제: 모델이 최상위 tab_id를 보내지만 기존 도구는 payload.id만 받아 Unknown tab 발생. 두 표현을 지원하고 불일치 시 거절하도록 수정했다. planner가 재시도를 내용 삭제 승인으로 오해하여 지침을 구체화하고 미승인 nonempty tab_remove를 패널 수 포함 clarification으로 변환하는 함수를 추가했다. 승인 판단은 여전히 모델 기반이며 모든 모호한 문장의 안정성을 보장하지 않는다.
- 실제 성공: c31d5feb에서 사용자가 패널 삭제 미승인을 명시하자 1개 패널 확인 질문이 나왔고 저장 상태 전체/revision4 불변. 탭과 패널 모두 삭제 버튼을 클릭하자 revision5에서 185b4f20 탭과 포함 패널만 삭제했다. Overview의 보관 메모 객체 전체, 빈 동명 탭과 artifact 목록은 그대로였다. reload 후 Overview 메모 표시와 대상 부재 확인.
- 검사: backend99 tests/Ruff. 탭 ID 전달/병렬 다른 탭 게시/반복 생성 동일 ID/미확인 삭제 거절/승인 삭제/확인 계획 테스트. frontend typecheck/온보딩 ESLint 통과. 증거 frontend/output/playwright/tab-agent-question-final.txt, tab-agent-approve.txt, tab-agent-final.txt/png; backend-langgraph/output/tab-agent-before-confirm.json.
- 온보딩: 원문 문구 검색, 근거 검사와 한계, 신규 개수 검사, 연속 저장, 출처 동기화, 전년도 PDF 명령을 현재 구현으로 동기화. 실제 9노드와 확대/Fit View, 390px 수평 overflow 부재 확인. 증거 onboarding-updated-result.txt/mobile.png.
- 후속: 새 도구 계약으로 최초 탭 생성부터 전체 흐름을 다시 검증해야 한다. 일반 짧은 삭제 문장의 승인 분류도 추가 검토 대상. 전체 목표는 진행 중이다. stock business/system/implementation-status/inheritance-audit 동기화.


## 최초 생성 재검증·확인 응답 고정·연쇄 삭제 증거

- 날짜: 2026-10-25. CANVAS-01/TAB-01.
- 발견/수정: 74ef29fe에서 요청한 패널 배치는 맞지만 미완료 안내. 같은 요청 재분류가 add target=main을 반환해 목적지 탭과 artifact 대상 혼동을 재현했다. add 대상은 기존 artifact만, 새 tab_add/artifact_publish에는 기존 target 금지 검증을 추가했다.
- 새 한국어 생성: 1b11da35에서 Overview/임시 분석의 보관 메모/검토 메모가 정확히 생성되고 미완료 안내가 없었다. 보관 상태를 output/tab-fresh-success.json에 기록했다. 별도 혼합 언어 대화 03573725는 제목이 요청과 달라 완료 증거로 사용하지 않는다.
- 확인 표시: 짧은 삭제 요청에서 상태는 유지됐으나 모델이 질문을 생략했다. plan.clarification을 서버가 직접 Callout으로 만들어 전송·저장하고 graph를 실행하지 않도록 변경했다. API 테스트로 무변경/이력/완료 이벤트와 graph 미호출 확인. 실제 동일 짧은 요청에서 확인 질문과 전체 상태 불변 확인.
- 연쇄 삭제: 승인 후 탭과 패널은 삭제됐지만 완료 검사는 별도 remove 증거를 못 찾아 이미 삭제한 항목을 다시 삭제하려 했다. tab_remove 결과에 실제 전후 차이 removed_panel_ids를 추가하고 remove 효과로 계산했다. 삭제 재검증 탭/임시 메모를 생성 후 승인했을 때 revision8, Overview와 보관 메모만 남고 객체 전체 동일, 실패 중복 호출/미완료 안내 없음과 reload 확인.
- 남은 사례: 삭제 재검증 탭을 만드는 후속 요청의 실제 저장은 맞았지만 미완료 안내가 남았고 명시적 동시 삭제에도 재확인이 발생했다. 계획 진단 기록으로 후속 추적한다. 모든 생성/분류가 안정됐다고 주장하지 않는다.
- 검사: backend102 tests/Ruff. 증거 frontend/output/playwright/tab-korean-final-created.txt, tab-deterministic-confirm.txt, tab-cascade-final.txt, backend-langgraph/output/tab-fresh-success.json. stock business/system/implementation-status/inheritance-audit 동기화.
- Grafana 참고: 공식 panel/layout 문서와 grafana/scenes SceneGridLayoutRenderer 공개 소스를 직접 확인하고 docs/stock/grafana-ux.md 및 문서 지도에 연결했다. 수동 Custom, 핸들/종료 콜백, 좁은 폭 오조작 방지와 자체 구현의 차이를 구분했다. 원본 코드를 복사하지 않았다.


## 실행 당시 계획 진단과 기존 유지·추가·삭제 재검증

- 날짜: 2026-10-25. CANVAS-01/TAB-01.
- 변경: 실제 계획/완료 효과/미충족 조건/종료 상태를 로컬 conversations.sqlite 진단 테이블에 기록. 대화별100회 제한, 대화 삭제 연동, 원문/프로그램/키 및 전체 메시지 비복제. 진단 저장 오류는 실제 대화 저장/결과를 방해하지 않는다. 계획 instruction에는 사용자 요청 요약이 포함될 수 있다.
- 실제 재현: 1b11da35에서 보관 메모 유지+새 작업 탭/다음 질문 패널1개 추가. 실제 계획 add/tab_add, minimum_new_panels1, targets=[], completed 두 작업, missing=[]로 revision10. 명시 승인 삭제는 remove_tab_contents_confirmed=true, clarification없음, actual remove/tab_remove, missing=[]로 revision11. 추가 재확인이나 미완료 안내 없음. 보관 메모 객체 전체와 Overview 유지.
- 브라우저: 최초 검사에서 채팅 이력의 Tabs까지 포함해 삭제 탭이 남았다고 잘못 판단했다. Canvas dashboard region으로 범위를 좁혀 reload 후 Overview 한 탭과 보관 메모만 있음을 확인했다. 제품 상태 오류가 아니라 테스트 locator 범위 문제였다.
- 검사: backend104 tests/Ruff. 진단 메시지 비복제/대화삭제/100회 제한/다른대화 보존 테스트 포함. 최신 npm run verify(Steiger+production build) 통과.
- 증거: backend-langgraph/output/plan-diagnostics-verified.json; frontend/output/playwright/diagnostic-add-result.txt, diagnostic-final-reload.txt, diagnostic-reload-snapshot.txt, current-verify.txt. 과거 계획을 다시 추정한 값과 이번 실행 당시 기록을 구분한다.
- 문서: implementation-status를 누적 사건 나열에서 최신 요구사항/증거/제약 표로 정리했다. 과거 변경은 기존 flow에서 보존한다. system/inheritance-audit 동기화. SEC 실제 성공과 SLAP 최종 검토 등 전체 목표는 남는다.

## 화면 책임 분리와 브라우저 회귀 확인

- 맥락: goal.md의 SLAP 요구에 따라 workspace/canvas의 세부 UI 책임을 분리했다.
- 변경: workspace는 391줄의 조정 역할로 정리하고 chat-message/welcome/workspace-splitter를 추출했다. canvas는 218줄로 정리하고 canvas-panel/canvas-toolbar/canvas-tabs를 추출했다. 공통 DashboardMutation 타입을 명시했다. RGL 직접 자식 DOM, 저장 명령, 기존 프로그램 계약은 유지한다.
- 검증: `frontend/output/playwright/refactor-final-verify.txt`의 Steiger/production build 성공. `refactor-controls.txt`의 분할 키보드·패널 너비·핀 검증, `refactor-splitter-escape.txt`의 실제 드래그 취소, `refactor-tab-added.txt`의 탭 추가, `refactor-export-check.txt`와 `refactor-export.json`의 임시 탭 삭제 후 JSON 저장을 확인했다. JSON의 보관 메모 전체 객체는 backend/output/tab-fresh-success.json의 동일 ID 객체와 정확히 일치했다.
- 입력 검증: `refactor-memo-restored.txt`에서 83057618-023c-436f-9e0b-9110d08883c2 대화의 메모 편집·reload 유지·원래 값 복원을 확인했다. 서버 재조회에서도 메모는 “매출 증가 원인을 원문과 대조”, 체크리스트는 period만 true로 유지된다.
- 자동화 복구: 이전 결합 스크립트는 native prompt 처리 중 대기하고 409 안내가 남아 있었다. dialog-dismiss로 해당 대기를 해소하고 GET 완료 후 탭 추가/승인, 삭제/승인을 별도 명령으로 재검증했다. 당시 실패를 성공으로 간주하지 않았다.
- 동기화: system SYS-UI-01, implementation-status SLAP 행과 검증 목록. 전체 목표는 실제 SEC 수집·10년 조회 및 최종 승계 감사가 남아 진행 중이다.

## SEC 실환경 재확인

- 기존 캐시를 읽지 않고 실제 앱의 `agent.sec.client.download`로 tickers, NVIDIA submissions, Company Facts를 재요청했다. 세 경로 모두 HTTP 403을 반환했다. 우회하거나 수집 성공으로 처리하지 않았다.
- 증거: `backend-langgraph/output/sec-final-recheck.json`의 UTC 확인 시각과 응답 상태. 키·헤더·본문은 기록하지 않았다.
- 현재 상태: SEC 원문 수집 성공 및 실제 10년 XBRL 기간 변경/갱신 검증은 미완료다. 화면 책임 분리 회귀 검증은 완료했으며 전체 목표는 진행 중이다.

## 현재 원본 명세 대조와 승계 E2E 재검증

- 맥락: goal.md의 6-2/6-5 기능 승계와 실제 브라우저 검증을 최종 대조했다.
- 변경: 기존 E2E의 문서 개수 3개 고정 가정을 필수 문서 nvidia/amd/intel 존재 검사로 수정했다. 여러 연도 보고서와 사용자 PDF를 함께 보관하는 요구에 맞춘다. 구현 코드는 변경하지 않았다.
- 명세 확인: 최초 6-2 spec.json 비교는 Stack/Modal 누락처럼 보였으나 package.json 생성 명령과 library 진입점을 확인하니 실제 생성 명세는 system-prompt.spec.json이었다. 해당 84개 명세는 회귀 fixture와 정확히 같았다. 올바른 기준으로 6-2/6-5 모두 직접 대조하고 Card의 자식 확장 외 계약 차이가 없음을 확인했다. 오래된 파일을 근거로 불필요한 호환 코드를 추가하지 않았다. frontend/backend 프롬프트 바이트도 일치했다.
- 실행: 3049/2041 listener의 cwd가 6-7 소유임을 확인한 뒤 `E2E_EXTERNAL_SERVERS=1 npm run test:e2e`. 4 tests passed, 28.2s. 실제 provider 비교/후속 질문/카운터와 SQLite reload 포함. Playwright 격리 컨텍스트는 실행 종료 시 닫혔으며 기존 서비스는 유지했다. 테스트 자체 임시 대화만 삭제되며 기존 대표 대화는 유지한다.
- 증거: frontend/output/playwright/final-inheritance-e2e.txt, final-catalog-inheritance.json 및 frontend/playwright-report/index.html. stock inheritance-audit/implementation-status 동기화. 실제 SEC 수집·10년 XBRL 변경/갱신 미검증은 그대로 남는다.

## BLOCK-SEC-01 외부 차단 판정

- 이전 턴 분류: 승계 명세 대조와 4개 실제 브라우저 E2E 완료로 progress. 이번 턴은 원래 goal.md와 구현 경계·온보딩 예제·남은 증거를 재확인했다.
- 최신 직접 확인: 사용자 승인 연락처가 SEC_USER_AGENT에 포함되며 tickers/submissions/Company Facts는 전부 403. 증거 output/sec-blocker-audit.json. 현재 3개 연속 목표 턴에서 같은 차단이 남아 있다. 새로운 키 요구나 가상 데이터로 완료 조건을 바꾸지 않는다.
- 보존 검증: implementation-status의 대표 대화 7개 모두 실제 SQLite 메시지를 보유한다. 증거 backend-langgraph/output/representative-history-audit.json.
- 판정: 독립적인 화면 리팩터링·승계 검증을 완료한 뒤에도 실제 SEC 수집/10년 조회/갱신은 외부 접근 상태 변화 없이는 검증할 수 없다. 목표를 complete가 아니라 blocked로 전환하며 재개 조건을 stock implementation-status에 명시한다. 현재 기능의 일반적인 모델 정확성을 보장하는 판정은 아니다.

## SCOPE-03 사용자 확정: 3년으로 n년 기능 검증

- 사용자 결정: 10년 확보 대신 3년치로 검증하고 10-K·10-Q로 한정한다. n년 변경 가능 여부가 핵심이다. 기존 10년 성공 조건을 대체하며 3년 최대 제한을 도입하지 않는다.
- 변경: 연간 조회·차트·갱신 기본값 3년, 시작 예제/온보딩/목표/시나리오 동기화. 20-F 제외, 도구 form enum. 10-Q의 잘못된 4n개를 3n개 고유 기간으로 수정했다. SEC 공식 Form 10-Q 지침을 확인했다.
- 발견/수정: 연도 제외 전에 YoY를 계산해 제외된 연도에 대한 성장률이 남았다. 표시 범위를 적용한 다음 연속 관측치만 계산하도록 수정했다.
- 검증: backend 106 tests 및 Ruff 통과. n=1/2/3/5, 제외 연도, 10-Q n=1/2/3 및 지원 외 보고서 거절 포함. 증거 backend-langgraph/output/three-year-scope-tests.txt. 기존 41b4f318 대화의 실제 PDF 3년 확대/제외 증거도 유지한다.

- 추가 실제 검증: 41b4f318 대화에서 사용자 요청으로 같은 패널 7712d4c6-14f6-43bb-a1a7-c8ada6dcee82를 FY2024~2026 세 해로 다시 확대했다. 최종 revision8, 패널1개, 회계기간 2024-01-28/2025-01-26/2026-01-25, 매출 60,922/130,497/215,938백만 USD와 두 원문 출처를 확인했다. 이번 요청 직전 화면의 너비13을 유지했다(과거 최초 검증의 너비12와 구분). reload 후 Canvas 표의 세 값을 실제 브라우저에서 확인했다. 증거 frontend/output/playwright/three-year-selected.txt, three-year-state.json, three-year-reload.txt, three-year-rescope.png. frontend typecheck/변경 두 파일 ESLint도 통과했다. 대표 대화를 보존한다.

## CACHE-01 로컬 캐시와 SEC 요청 억제 보강

- 요청: SEC 자료를 로컬에 보관·캐시하고 한꺼번에 많은 요청을 피한다.
- 변경: 기존 SQLite TTL 재사용에 URL별 동시 요청 합류와 취소 격리 추가. 새로고침도 동시 합류하며 잘못된 JSON은 저장하지 않는다. 최소 간격을 0.22초에서 1초로 변경했다. 403/429 또는 Retry-After가 있는 5xx는 프로세스 전체 새 요청을 최소60초/서버 지정시간 동안 억제하며 유효 캐시 읽기는 유지한다. 도구에 SEC_COOLDOWN/재시도 시각까지 남은 초를 반환한다.
- 검증: backend114 tests/Ruff. 실제 submissions HTTP 요청 한 번은 403이며 다음 fetch는 SecCooldownError로 종료되어 추가 요청을 보내지 않았다. 정상 수집이나 403 원인이 요청량이었다고 주장하지 않는다. 증거 output/sec-cache-tests.txt, output/sec-cache-live-check.json(backend-langgraph 기준).
- 한계: cooldown/요청 합류는 단일 백엔드 프로세스 범위. 기존 확보 원문과 캐시는 보존하며 자동 만료 삭제는 하지 않는다. 범위·재개 기준은 3년 n년 기능 및 10-K/10-Q의 최신 사용자 결정 유지. business/system/implementation-status 동기화.

## UI-EMPTY-01 새 분석 Canvas 가운데 정렬

- 사용자 요청: canvas-empty를 chat+canvas 전체가 아닌 Canvas 기준 가운데로 배치한다.
- 원인: 기존 대화는 relative인 canvas-grid 아래에 빈 안내를 렌더하지만, 새 분석은 static인 canvas-pane 바로 아래에 absolute 안내를 렌더해 위치 기준이 없었다.
- 수정: workspace.css의 canvas-pane에 position:relative 한 줄 추가.
- 검증: 실제 브라우저의 새 분석→split 48/70/30%→Canvas 단독→split에서 안내 offsetParent가 canvas-pane이며 가로/세로 중심 차이가 1px 이하임을 확인했다. 증거 frontend/output/playwright/empty-center-verified.txt, empty-canvas-centered.png. CSS 수정이므로 별도 단위 테스트는 추가하지 않았다. system 문서 동기화.

## US-REPLAY-01 실데이터 US-01~16 재생성

- 사용자 요청: goal.md의 US-01부터 끝까지 실제 데이터로 볼 수 있도록 chat history를 다시 만든다. 기존 이력 삭제 없이 [실데이터 재검토] US-01~16으로 새 대화 생성. 실제 HTTP agent run만 사용하고 assistant 메시지를 임의 삽입하지 않았다.
- 자료: 준비된 공식 NVIDIA FY2026/FY2025, AMD/Intel FY2025 보고서. US-01 SEC 수집은 실제403이며 이후 로컬 자료 부재 오안내를 검색 근거로 정정했다.
- 최초 오류/보완: 요약·비교 등의 요청에서 불필요한 add 계획/화면 표시·저장 실패가 발생했다. 같은 대화에서 결과를 재표시하거나 명시적 패널 생성/실제 Canvas 추가 버튼으로 보완했다. US-10의 연도 제외는 근거 검사가 누락으로 오판해 사용자 필터임을 차트에 명시한 뒤 수정 저장했다. 이 재현은 향후 계획/근거 검사 개선 과제이며 일반적인 모델 안정성을 증명하지 않는다.
- 검증: 모든16개 대화에 실제 메시지 존재, 최종 diagnostics missing=[] 확인. 브라우저에서 모두 선택·렌더 확인. US-07 실제 값→가정 입력100%→원복, US-12 이동 버튼→실제 선택 ID, US-15 reload 패널 복원. US-10은 같은ID/배치에서2년→3년→FY2025제외 확인. US-11 좌우14/10열, US-13 위험 패널만 삭제. US-14 실제 JSON·CSV·2페이지 PDF 저장 확인.
- 증거: backend-langgraph/output/us-review/manifest.json 및 turn별 SSE/state/messages. frontend/output/playwright/us-review-16-browser.txt, US-xx-review.png, us07-interaction.txt, us12-focus-action.txt, us15-restored.txt, us14-downloads.txt, us16-final-render.txt. UI-EMPTY-01 수정도 이번 작업 중 요청받아 별도 기록했다.
- 문서: stock/scenario-review.md에 16개 ID/검토 지점/제약을 정리하고 README와 implementation-status에 연결. 기존 대표 대화·서비스·원본 데이터는 보존한다.


## GROUNDING-SCOPE-01 연도 제외 검사 수정

- 맥락: US-10에서 FY2025 제외가 근거 부족으로 잘못 차단됐다. 기존 검사 입력에 사용자 표시 범위가 없었다.
- 변경: 최신 사용자 범위를 사실 근거와 분리해 전달하고 준비 PDF 목록을 게시/답변 검사 모두에 포함했다. 주장별 근거 설명과 supported/unsupported 판정을 분리하고, 비공개 검사 모델은 채팅 모델의 비스트리밍·temperature0 복사본을 사용한다.
- 검증 과정: 문자열 issues 프롬프트 보강만으로는 정상 설명이 오류로 반환됐다. 최초 구조화 판정도 잘못된 값과 YoY를 통과시켰다. 이 중간 실패를 성공으로 취급하지 않는다. 설명 후 판정, 명시적 기간/값 규칙, 전용 검사 설정으로 수정했다.
- 결과: 실제 US-10 도구 근거를 사용한 검사기 호출에서 정상 필터 통과/999999 잘못된 금액 차단/FY2024→FY2026 YoY 차단을 확인했다. backend117 tests/Ruff 통과. 정상·오류 혼합 판정 및 채팅 모델 원본 설정 보존을 단위 검증했다.
- 증거: backend-langgraph/output/check_grounding_scope.py, grounding-scope-live-final.json, grounding-scope-tests.txt. 중간 실패 결과도 grounding-scope-live.json 등에 남긴다. 이 증거는 검사기 통합 검증이며 새 전체 브라우저 E2E 성공 증거가 아니다.
- 동기화: stock/business.md RESEARCH-01, stock/system.md GROUNDING-SCOPE-01, stock/implementation-status.md. 다음 검증은 별도 회귀 대화에서 단순 연도 제외 요청→동일 패널 갱신→브라우저 확인이다.


## GROUNDING-SCOPE-02 전체 경로 회귀

- 맥락: GROUNDING-SCOPE-01의 검사기 직접 호출 후 실제 사용자 경로를 확인한다.
- 실행: 새 대화 05a0c606-5371-490e-928f-edf7f8f9120f에서 nvidia PDF51 실제 원문을 읽어 FY2024~FY2026 차트를 만들고, “같은 패널에서 FY2025만 제외해줘.”를 보냈다. 기존 US-01~16 대화는 변경하지 않았다.
- 결과: 두 실행 모두 RUN_ERROR 없음, 진단 missing=[]. 최초 생성 중 OpenUI 구문 검사 실패 1회를 자체 수정했다. 이를 첫 시도 무오류로 보고하지 않는다. 연도 제외는 별도 사용자 보완 없이 성공했다. 패널 f976c1a4-a0e2-45aa-ae95-1ac5951f20a4, x0/y0/w12/h12 유지, revision2→3. 최종 차트 값60922/215938, FY2025는 축에서 제외되며 원문 출처 인용에는 남는다. YoY 표기 없음.
- 브라우저: 목록에서 새 대화 선택→Canvas LineChart 확인→reload→FY2024/FY2026 축 존재 및 FY2025 축 부재 확인. 스크린샷 시각 확인 완료. 최초 3년 차트는 기존 채팅 기록에 유지되고 최신 Canvas만 두 해로 바뀐다.
- 증거: backend-langgraph/output/grounding-e2e/{thread.json,messages.json,turn-1-state.json,turn-2-state.json,turn-1-diagnostics.json,turn-2-diagnostics.json,turn-1-events.json,turn-2-events.json}; frontend/output/playwright/grounding-scope-e2e.{txt,png}.
- 동기화: implementation-status.md, scenario-review.md. 남은 전체 목표: SEC 실제 신규 수집/10-Q 분석, 연구 요청의 Canvas 계획 오분류 개선 및 전체 요구 감사. 이번 회귀는 준비된 PDF 기반이며 SEC 수집 성공을 증명하지 않는다.


## PLAN-INTENT-01 채팅 분석의 Canvas 오분류 수정

- 맥락: US-02 연구 요약을 add/minimum_new_panels1로 해석한 저장 진단을 확인했다. 실제 모델6개 기본 요청에서 요약·일반 차트·재사용 채팅 게시가 잘못된 패널 추가로 분류되는 것을 재현했다.
- 변경: 계획 schema의 instruction을 먼저 생성해 출력 목적지를 판단하게 하고 패널 수는 operations 뒤에 산출한다. 명시적 Canvas 추가가 없는 분석은 채팅, artifact 게시와 패널 수는 별개임을 규정했다. 계획 전용 모델은 비스트리밍·temperature0 복사본이며 원래 채팅 모델 설정을 유지한다. 추가 회귀에서 발견한 width를 update로 분류하는 오류와 연도 미지정 제외를 update로 분류하는 오류도 지침에 반영했다.
- 검증: 기본 의도6개 및 선택 패널 후속5개 실제 모델 호출 통과. 중간 테스트에서 “Canvas에 추가하지 마”를 artifact 게시로 오분류해 금지 자체는 재사용 게시 요청이 아님을 명확히 했다. 최종 기본6개 재검사 통과. backend118 tests/Ruff 통과.
- 전체 흐름: 새 실제 대화0e8b3943-39f7-47e2-816c-f9f054d22633에서 로컬PDF51 3년 매출 채팅 차트→Canvas 추가→증가 설명을 실행했다. 패널 수0→1→1, 마지막 설명 후 패널 객체와 revision1 그대로. 세 실행 모두 RUN_ERROR/missing 없음. 브라우저에서 “이 차트에서 1년치는 빼줘.” 전송→연도 확인 질문, 전체 서버 상태 보존, reload 후 FY2024/25/26 유지 확인. 기존16개 검토 대화는 보존했다.
- 증거: backend-langgraph/output/planner-intent-before.json, planner-intent-final.json, planner-followups.json, planner-intent-tests.txt, planner-e2e/; frontend/output/playwright/planner-intent-e2e.txt/png, planner-clarification.txt/png, planner-after.txt. 모델 의도 분류 자체의 정확성 보장을 주장하지 않는다.
- 동기화: business/system/implementation-status/scenario-review stock. SEC 실제 신규 수집과10-Q 실데이터 분석 및 전체 목표 감사는 남아 있다.


## SEC-Q-PARTS-01 10-Q 중복 Item 손실 수정

- 맥락: 남은10-Q 경로 감사에서 기존 파서가 Part를 무시하고 Item별 긴 구간만 남겨 Part I/II의 Item1 중 하나를 잃는 결함을 발견했다. SEC 공식 Form10-Q의 재무제표/법적 절차 항목을 확인했다: https://www.sec.gov/files/form10-q.pdf (6~7쪽).
- 변경: HTML 텍스트 정규화와 섹션 추출을 분리하고 분기 양식은 Part+Item 키를 사용한다. Part 전환에서 이전 섹션을 끝내며 불명확한 Part를 추정하지 않는다. read_section은 정확한 정규 키 또는 유일한 Item 별칭을 허용하고 모호하면 후보만 반환한다. 도구 설명에10-Q 이름을 추가했다. 10-K 기본 키와 공개 도구 인자 계약은 유지했다.
- 캐시: 기존 분기 Item-only 저장본은 원문 재분리·검색 passage 제거·downloaded 상태 변경을 트랜잭션으로 수행한다. 재다운로드하지 않고 다음 검색에서 재인덱싱한다. 현재 실제 저장소의10-Q는0건으로 사용자 분기 데이터에 적용된 마이그레이션은 없다.
- 검증: 기존10-K 회귀와10-Q/A 목차/본문 중복, 두 Item1 보존, Part 경계, offset 원문 일치, 부분 키 모호성, 캐시1회 다운로드, legacy 인덱스 제거를 격리 SQLite와 모의 다운로드로 확인했다. 전체119 tests/Ruff 통과. 실제 제출 목록 단일 요청은403으로 추가 요청하지 않았다.
- 증거: backend-langgraph/output/quarterly-parts-tests.txt, sec-quarterly-access.json, tests/test_sec_collection.py. 실제10-Q 원문/브라우저 분석 성공 증거로 대체하지 않는다.
- 동기화: business/system/implementation-status. 다음은 접근 가능한 공식 분기 원문으로 파서·분석을 검증하고 SEC 신규 수집 제약과 별도로 범위를 기록한다.


## SEC-Q-REAL-01 공식 분기 원문 검증과 추가 실패

- 원문: NVIDIA 공식IR FY2027 Q2 10-Q PDF, https://investor.nvidia.com/files/doc_financials/2027/NVDA-2027-Q2-10Q-Final-including-exhibits.pdf. EDGAR 접수0001045810-26-000075/2026-08-26 제출/2026-07-26 보고기간을 공식 제출목록과 대조했다. SEC 직접 HTML collect_one은 HTTPStatusError로 실패했으며 IR PDF를 SEC 수집 완료로 기록하지 않았다.
- 준비: --include-quarterly 추가. --include-history와 함께 실행해 기존4문서 유지 및61쪽 분기 자료 추가,5문서/2512구절. 원문 텍스트 Part별9개 섹션 추출, 재무제표 Item1과 법적 절차 Item1 구분. 실제 HTML 추출 검증은 아니며 PDF 텍스트에 같은 extract_sections를 적용한 증거다.
- 발견/수정: 긴 실제 분석 요청에서 Canvas 오분류 재현(실패 대화394dfd8f-5444-48f0-9c93-a1363d652c08). 목적지 분류 OutputScope를 계획과 분리하고 chat/재사용chat의 변경 가능 작업을 서버에서 제한했다. 원문 요구는 유지했다. 수정 후 기본6개+후속5개 실제 모델 회귀와 동일 긴 요청의 패널0을 확인했다.
- 추가 결함: 대화3c5b1b38-446f-4bc2-811e-cd93185c26b3의 명시적 추가는 destination 누락으로 채팅artifact만 생성하고 미완료됐다. 재요청에서는 저장 후 답변 보완이 거의 같은 프로그램을 다시 게시해2패널이 생겼다. 중복ID 지정 삭제로1개 보존. 두 결함은 아직 일반적으로 해결되지 않았다.
- 분석 검토: 최종 Canvas는FY2026Q2(2025-07-27)46743/FY2027Q2(2026-07-26)96221백만USD 두 점과6개월누적90805/177837별도표. 최초채팅의분기/누적혼합차트는보존하고후속에서분리했다. PartII요약의'아래위험요인을제외하면'조건이누락된초기답변은34쪽재읽기후정정했으며,원문에없는모니터링추정도제거했다. 근거검사만으로이오류를자동차단하지못했다.
- 브라우저: 최종차트/표/출처/회계기간,새로고침복원,정정요약렌더링을확인했다. JSON상법적절차질문전후패널/버전동일.121 tests/Ruff통과. 모든최초실패를지우지않았다.
- 증거: output/quarterly-prepare.json,quarterly-real-sections.json,sec-quarterly-original.json,quarterly-e2e-before-scope/,quarterly-e2e/,planner-intent-scoped.json,planner-followups.json,quarterly-real-tests.txt;frontend/output/playwright/quarterly-chart,quarterly-table,quarterly-corrected-summary(txt/png).
- 동기화: README,AGENTS,system,implementation-status,scenario-review. 남은목표는게시목적지누락/재시도중복/예외조건검사강화,실제SEC전체경로,최종요구감사다.


## PUBLISH-POLICY-01 목적지 누락과 중복 생성 경계

- 맥락: SEC-Q-REAL-01에서 목적지 생략이 chat 저장으로 끝났고, 답변 보완의 약간 다른 프로그램 재게시가 동일 목적의2개 패널을 만들었다.
- 변경: 계획의 허용 목적지를 도구에 전달하고 생략 시 유일한 목적지로 결정한다. 다른 목적지는 거절한다. 정확한/최대 개수 요청은 maximum_new_panels를 갖고, 최소 개수 요청은 상한None이다. mutation_lock 안에서 성공한 신규 ID 수를 검사해 초과 add를 거절하고 기존 ID 수정으로 안내한다. 기존 동일 payload 재사용을 유지한다.
- 완료 판정: 실제 저장 목적지를 도구 응답에 추가하고 실행 완료/채팅 artifact 표시 검사가 그 값을 우선하도록 수정했다. 기존 응답은 인자 fallback으로 호환한다.
- 단위 검증: 생략·목적지 불일치·혼합 목적지, 병렬1/2개 생성 제한, 실패/동일 재시도/기존 수정/다음 실행, 완료 효과 분류.126 tests/Ruff 통과. 실제 모델 기본6개 목적지/개수/상한 검증 통과.
- 전체 흐름: b759b659-58e7-4b98-b8df-3bf2dd8ec468에서 실제10-Q PDF3쪽 분석→정확히1개 패널 추가→제목 변경.0→1→1, 패널ID d400f856-8406-430e-a128-b847ed865be0/내용/배치 유지, 세 RUN_ERROR/missing없음, 게시 실패없음. 브라우저 재선택/reload/패널1개 표시 확인. 실제 요청은 destination=canvas를 명시했으며 누락 경로는 단위 검증이다.
- 제한: 분석 카드의 Fiscal Year Ended라는 분기 기간 오표현을 화면에서 발견했다. 게시 기능 증거와 사실/표현 정확성 증거를 구분한다. 예외조건·기간 의미 검사 개선과 SEC 전체 실제 경로는 여전히 남아 있다.
- 증거: output/publication-policy-tests.txt, publication-plan-limits.json, publication-e2e/; frontend/output/playwright/publication-single-panel.txt/png. stock business/system/implementation-status/scenario-review를 동기화했다.


## GROUNDING-QUALIFIER-01 기간·예외 검사 및 후속 답변 버퍼링

- 맥락: 실제10-Q 요약의 예외 누락과 분기 종료일의 Fiscal Year Ended 오표기를 직접 검사도 승인했다.
- 변경: 예외/기간/일반 주장 구조화 검사를 분리하고 과거 원문 근거도 최종 답변 검사에 사용한다. 실행별 검사 메타데이터를 진단에 기록한다. 과거 근거를 활용하는 후속 답변의 초안 토큰도 버퍼링한다.
- 검증: 직접 실제 모델7사례 통과, backend130 tests/Ruff 통과. 실제 turn5/7의 retry→accepted를 확인했다. turn7 SSE 최종 답변1건, Canvas 상태 불변, 브라우저 reload/스크린샷 확인. turn6 변환 오류는 수정 후 회귀 테스트를 통과했으며 실패 이력은 유지한다.
- 한계: turn7은 예외를 보존하지만 해당 예외에 실제 변경이 있다고 단정한다. 모델 검사 승인과 사실 정확성을 동일시하지 않는다. 브라우저에서 동일 원문 URL key 중복 오류 발견. 두 항목 및 SEC 신규 수집 경로는 후속 작업이다.
- 동기화: system/implementation-status/scenario-review. 증거 backend-langgraph/output/qualifier-e2e/, qualifier-grounding-actual-final.json, qualifier-grounding-tests.txt; frontend/output/playwright/qualifier-buffer-final.png.


## SOURCE-KEY-01 및 GROUNDING-CONVERSE-01

- 맥락: 동일 PDF34쪽을 가리키는 법적 절차/위험 요인 인용이 upstream ListedSources의 URL key와 충돌했다. 출처 삭제나 URL 변경 없이 렌더링을 수정했다.
- 변경: 로컬 Card 렌더러 래퍼는 중복 URL만 순서별 key/sourceId 목록으로 표시하고 나머지는 기존 구현에 위임한다. 스키마와 생성 프롬프트는 변경하지 않는다.
- 검증: frontend440 tests/typecheck/ESLint/Steiger, backend130 tests/Ruff. 브라우저 두 인용 보존/reload/Enter 원문 새 창 확인 및 key 오류 없음. source-card-fixed.png 직접 시각 확인.
- 별도 정확성 작업: 예외 존재가 실제 변경·신규 위험을 증명하지 않는다는 지침을 생성/검사 모델에 추가. 직접 모델7사례 중5개 통과/2개 실패했고 실제 turn8도 '추가된' 표현이 남았다. 프롬프트 수정의 안정성은 미검증이며 완료로 취급하지 않는다. 기존 이력과 실패를 보존한다.
- stock: system/implementation-status 동기화. 다음 작업은 주장별 기간/한정 범위 검증의 신뢰성 개선과 전체 요구 감사다.


## DISCLOSURE-01 직역 기반 범위 보존 및 과거 패널 정정

- 맥락: 기간·예외 검사 실패의 설명을 직접 읽고 별도 집중 검사/다른 모델 비교를 수행했다. 기간은 개선됐지만 예외의 함의를 명시적 변경으로 해석하는 오판이 남았다.
- 결정: 실험 모델 교체나 추가 호출을 제품에 적용하지 않고, 생성 지침에서 원문 전체 예외와 직역/추론 구분을 강화했다. 출력 안정성 보장으로 과장하지 않는다.
- 실제 검증: 같은 후속 질문 turn9은 아래 기술된 위험 요인을 제외한다는 정확한 범위를 표시했다. Canvas 상태 유지. 기존 단일 분기 패널은 실제 요청으로 Quarter Ended 정정, ID/배치/출처/금액 유지 및 브라우저 reload 확인. 과거 실패 답변은 보존.
- 증거: focused-review-probe.json(3/4), qualifier-grounding-stronger.json(6/7), qualifier-e2e/turn-9-*, period-label-repair/ 및 두 브라우저 스크린샷. graph Ruff 통과.
- stock: business/system/implementation-status 동기화. implementation-status 상단의 오래된 테스트 수와 분기 PDF 상태도 현재 검증 범위에 맞게 정리했다. SEC 신규 수집은 미완료다.


## AUDIT-CURRENT-01 전체 요구 대조 및 온보딩 정합성

- 이전 턴은 실제 요약/기간 표기 정정과 브라우저 증거를 확보한 진행 턴이다. 이번에는 전체 목표를 축소하지 않고 요구별 현재 증거를 completion-audit에 정리했다.
- 새 SEC submissions 요청은403. 불필요한 후속 요청 없이 종료. US-01~16의 현재 실제 메시지/Canvas 조회 성공.
- 출처 수정까지 production build/Steiger 성공, 카탈로그/갤러리 최신 브라우저 회귀2/2.
- 감사 중 온보딩 준비 명령에 분기 포함 옵션이 없어 재준비 시 해당 인덱스가 제외되는 안내 불일치를 발견했다. --include-history --include-quarterly로 수정하고 Part/Item 및 분기/누적/추론 구분을 안내했다. backend README도 동기화. 실제 데이터 재준비는 하지 않았다. 이후 typecheck/ESLint 및390px 렌더/가로 넘침 부재 확인.
- stock: completion-audit 신설, implementation-status/docs README 동기화. 증거 파일은 감사 문서에 연결. SEC 수집·갱신 실제 성공과 전체 최종 감사는 남아 있다.


## REFRESH-COOLDOWN-01 갱신 경로의 요청 대기 예외

- 코드 감사에서 refresh_panel이 HTTPError만 처리하여 별도 RuntimeError인 SecCooldownError를 놓치는 것을 확인했다. 기존 대기 정책과 패널 갱신 간 통합 결함이다.
- 대기 예외를 안전한 refresh_result 오류로 변환하고 기존 데이터/성공 시각을 유지한다. 기존 operation_id/revision/잠금 정책은 그대로 적용한다.
- backend131 tests/Ruff. 실제 클라이언트 cooldown gate→HTTP 갱신 핸들러→SQLite 결과 저장 격리 테스트에서 외부 HTTP 호출을 금지해 미호출을 검증했다.
- 브라우저에는 해당 격리 응답만 route로 주입하여 가정 데이터 패널의 새로고침·대기 경고·차트 유지 확인. 실제 대화/Canvas에는 저장하지 않았고 확인 후 원래 상태 유지 검증. 실 SEC 수집 성공으로 해석하지 않는다.
- system/implementation-status/completion-audit 동기화. 증거 output/refresh-cooldown-tests.txt, refresh-cooldown-ui.json 및 frontend/output/playwright/refresh-cooldown.txt/png.


## BLOCK-SEC-02 현재 재개 조건

2026-10-25T04:33:51Z에 연락처 설정 여부를 값 노출 없이 확인하고 submissions 신규 요청1건을 보냈다. 결과403, 응답 제목은 `SEC.gov | Your Request Originates from an Undeclared Automated Tool`이다. 응답만으로 구체적인 차단 원인이나 추가 키 필요 여부를 단정하지 않는다. 프런트3049와 백엔드2041 문서 API는 모두200으로 서비스는 유지된다.

동일 외부 조건은 전체 감사→갱신 예외 수정→이번 차단 재감사의 연속 목표 턴에서도 지속됐다. 그동안 발견한 독립 작업(온보딩 누락, 갱신 cooldown 처리)은 완료했으며, 현재 남은 SEC 신규 원문/재무 수집·갱신의 실제 성공 검증은 외부 정상 접근 없이는 증명할 수 없다. 목표를 완료로 처리하지 않고 blocked로 전환한다. 추가 반복 요청이나 허용되지 않은 우회는 하지 않는다.

재개 조건: 현재 실행 환경에서 선언된 SEC 클라이언트의 정상 접근이 가능해짐. 이후 실제 기업 탐색→10-K/10-Q 수집→섹션/검색→재무 조회/기간 수정→갱신→브라우저 복원과 전체 요구 감사를 수행한다. 대표 US-01~16, 원문/PDF/SQLite, 실패·정정 이력과 실행 서비스를 보존했다. 증거: backend-langgraph/output/sec-resume-blocker-audit.json.


## SEC-BFF-COMPARE-01 차단 원인 설명 정정

사용자가 지정한 20-portfolio/1-reason-hwang/2-bff-apps의 SecClientService를 읽기 전용으로 비교했다. BFF는 Node fetch, 선언된 User-Agent, Accept: application/json, text/plain, */*를 사용한다. Python 클라이언트는 httpx와 기본 Accept를 사용하며 더 보수적인1초 간격/cooldown을 적용한다.

같은 NVIDIA submissions URL에 BFF의 실제 빌드 클라이언트와 현재 .env를 사용하면200/NVIDIA CORP/최근공시1000개가 반환됐다. DB 캐시를 조회한 결과가 아닌 직접 SEC GET이다. BFF .env의 연락처는 예시 이메일이며, 같은 클라이언트/같은 User-Agent 형식에서 연락처만 사용자가 제공한 실제 연락처로 바꾸면403이었다. 현재 dashboard User-Agent를 Node로 보내도403, sec-dashboard/0.1과 실제 연락처를 사용한 Node/httpx도403이었다.

따라서 BLOCK-SEC-02의 '현재 실행 환경의 SEC 접근이 불가능'이라는 포괄적 해석은 정정한다. 이 환경에서도 BFF의 기존 User-Agent로200이 가능하다. 확인된 것은 이번 비교에서 User-Agent 값에 따라 응답이 달라진다는 점이며, 이메일 자체의 차단 목록/SEC 내부 판정 원인은 확인하지 못했다. BFF 설정·코드·DB와 사용자의 실제 연락처를 변경하지 않았고 예시 연락처를 새 프로젝트에 복사하지 않았다.

남은 조건은 사용자가 지정한 실제 연락처를 포함하는 정상 요청 설정으로 SEC 수집·갱신 성공을 검증하는 것이다. 증거 backend-langgraph/output/sec-bff-comparison.json, sec-bff-format-probe.json, sec-node-format-probe.json.


## SEC-DECLARED-PROBE-01 실제 연락처 유지 진단

사용자가 후속 비교 진행을 요청했다. SEC 공식 FAQ의 선언된 User-Agent 예시(앱/조직 이름과 연락처)를 확인했다: https://www.sec.gov/about/webmaster-frequently-asked-questions . 현재 연락처를 유지해 Reason Ball SEC Research 형식, BFF Accept, gzip/deflate, From 연락처를 사용한 단일 submissions GET은403/AkamaiGHost/Undeclared Automated Tool이었다(04:57:11Z). BFF의 기존 설정·실제 클라이언트로 재확인한 같은 URL은200/NVIDIA/공시1000개였다(04:57:37Z).

단순 Accept·Node/httpx·괄호/버전 유무·From 추가로 해결됐다는 근거는 없다. 이 결과만으로 이메일 주소 차단 또는 허용되는 이메일 도메인 규칙을 확정할 수 없다. 성공한 실연락처 설정을 확보하지 못했으므로 프로덕션 SEC 클라이언트, 사용자 .env, BFF 코드/DB/설정을 변경하지 않았다. 예시 이메일을 실제 연락처 대신 사용하지 않는다.

남은 진단은 다른 실제 연락처를 사용한 통제 비교 또는 SEC의 공식 접근 거절 확인이다. SEC FAQ는 접근 거절 시 오류 내용과 IP를 포함해 webmaster에 문의하도록 안내한다. 외부 메시지는 발송하지 않았다. 증거 backend-langgraph/output/sec-declared-request-probe.json, sec-bff-success-recheck.json.


## SEC-BFF-LOCAL-01 실제 로컬 원문 다운로드

사용자가 BFF를 통한 로컬 SEC 다운로드 검증을 명시 요청했다. BFF의 기존 `pnpm --filter @reason-hwang/bff-apps test:sec-live`를 실행했다. 이는 Apple10-K 한 건만 다루는 opt-in 스크립트다. 실제 SEC 메타데이터/원문 요청은 성공했지만 새 원문과 기존 DB 원문의 정확한 문자열 비교가 실패했다. 크기/해시의 DB 내부 일관성과 file_path 없음 검사는 통과한 상태였으며 전체 테스트를 PASS로 표시하지 않는다.

BFF SecClientService의 기존 설정으로 Apple FY2025 10-K(0000320193-25-000079, 보고기간2025-09-27, 제출2025-10-31)를 직접 다시 내려받아 6-7 backend output/bff-local-download에 HTML 파일로 보관했다. 크기1,520,322 bytes, 저장 파일 SHA256이 다운로드 해시와 동일함을 확인했다. BFF의 기존 공시 원문 API도200이었다. 새 HTML과 저장본은 마지막 script src URL이 달랐으며 모든 script 태그를 제외한 HTML은 동일했다. 원문을 임의로 덮어쓰거나 성공 판정을 위해 테스트를 완화하지 않았다.

로컬 원문을 6-7 파서로 읽어206,727자와18개 Item을 추출하고 apple-2025-10k.txt로 저장했다. BFF 코드/.env/기존 서버2801은 변경하지 않았다. 검증 스크립트의 임시 Nest 서버는 finally로 닫혔고 PID52658/53039 종료를 확인했다. 전체 백필은 실행하지 않았다. 사용자 지시로 실행한 단일 공시 검증 외 DB 정리/전체 변경은 수행하지 않았다.

증거: backend-langgraph/output/bff-sec-live-download.txt(기존 통합 테스트 실패 그대로), output/bff-local-download/manifest.json(다운로드·SHA·내용 비교), 해당 HTML 및 TXT. 이 증거는 BFF 설정으로 실제 SEC 원문을 로컬 확보할 수 있음을 증명한다. 6-7 Python의 직접 SEC 클라이언트가 복구됐다는 뜻은 아니며 BFF 경유 통합은 아직 구현하지 않았다.


## SEC-NATIVE-01 독립 Python 수집 복구 및 캐시 검증

사용자가 사용자 정보까지 BFF와 동일하게 따르도록 지시했다. BFF의 SEC_USER_AGENT 값 하나만 6-7 루트 .env에 복사하고 Python client에 BFF와 같은 Accept를 적용했다. 다른 시크릿/DB 설정은 복사하지 않았으며 런타임에 BFF 프로세스·코드·경로를 참조하지 않는다. 설정 복사 전 httpx에서 동일값으로 submissions/원문200을 먼저 확인했다. 기존 실제 연락처를 유지하려던 제약은 이번 사용자의 동일 설정 지시로 대체되었다. 환경 파일 값은 문서/로그에 노출하지 않는다.

LangGraph SEC 수집 tool call은 기존 collect_sec_reports를 사용한다. 서비스 응답에 reused 수를 추가하고 도구 설명에 캐시를 명시했다. downloaded는 기존 보관본을 포함한 이용 가능 원문 수이며 reused는 그중 재사용 수다. 원문은 filing ID로 영구 보관·재사용하고 동일 파일을 다시 받지 않는다. SQLite URL캐시는 원문365일·제출목록/재무1시간·기업목록/과거목록24시간이며 이미 저장한 원문의 재사용은 이 TTL과 무관하다. 동일 URL 동시 요청 합류,1초 간격 직렬 요청,Retry-After/cooldown 정책을 유지한다.

실제 Python 도구: AAPL 기업 식별,10-K3건·10-Q3건 수집 성공,Company Facts3년 매출 조회 성공. 최초 추가 네트워크7건(이미 확보한 Apple 최신10-K 재사용), 반복 수집은 네트워크 함수를 금지한 상태에서 성공하며 외부 요청0건. 원문 섹션 읽기도 성공. backend131 tests/Ruff 통과.

실제 대화5b6ee045-b0e9-4b95-b253-bed548dc58e5(`[실데이터 검증] 자체 SEC 수집과 캐시`)에서 수집 상태→3년 financial 패널→FY2024 제외→실제 갱신을 확인했다. FY2023/2024/2025 매출은383285000000/391035000000/416161000000 USD. 패널db82c9c3-e7fd-4f55-beed-22f60d0f73e5의 ID/배치 유지, 제외 후2023/2025만 표시. 처음 갱신에서 동기SQLite 연결이 LangGraph 이벤트 루프 차단 검사에 걸렸다. operation_applied 조회를 asyncio.to_thread로 이동하고 비동기 루프 밖 DB 접근 회귀 테스트를 추가한 뒤 같은 대화에서 갱신 성공(error=None,last_success_at 갱신). 브라우저 reload와 수동 새로고침도 성공했다. 최초 실패 이력은 보존했다.

증거: backend-langgraph/output/python-bff-settings-probe.json, python-sec-collection-success.json, native-sec-tools-success.json, sec-native-settings-tests.txt, native-sec-e2e/; frontend/output/playwright/native-sec-excluded-refreshed.png. 이는 BFF API 연동이 아니라 6-7 Python의 직접 SEC 호출 성공이다. 다음은 새 SEC 원문의 검색/분석 연결,자동 갱신 및 전체 요구 최종 감사다.


## SEC-NATIVE-02 원문 분석·자동 갱신 최종 검증 (2026-10-25)

- 맥락: SEC-NATIVE-01 이후 남은 직접 수집 원문 분석과 Live/Snapshot 검증.
- 실제 대화 `5b6ee045-b0e9-4b95-b253-bed548dc58e5`의 turn5~7에서 SEC 검색/첫 임베딩 인덱싱, FY2025 Item1 요약, FY2024/2025 Item7 비교, FY2026 Q3 Part I Item1/2를 읽었다. 각 실행 errors=[]/missing=[], 기존 Canvas1개 유지.
- 원문 대조: 분기 종료2026-06-27,3개월109417/9개월364357 백만USD. 연간 제품별 성장률도 Item7 원문과 일치. 정성 해석 전체 정확성을 전수 인증하지 않는다.
- 브라우저: 실제1분 자동 갱신200·오류없음, Snapshot230663ms 동안refresh0건·수동/주기 컨트롤 비활성. Live/자동끔으로 복원 후 reload, 연간 비교/분기 표와 기존 연도 제외 패널 렌더 확인. 소유 브라우저sec-auto 종료, 서버와 사용자 이력 유지.
- 증거: backend-langgraph/output/native-sec-e2e/turn-{5,6,7}-*.json 및 messages.json; frontend/output/playwright/native-sec-*.png, native-sec-snapshot-check.txt, native-sec-render-check.txt.
- 문서 정합성: completion-audit를 현재 상태로 재작성하고 business/system/implementation-status/inheritance-audit/scenario-review의 SEC 미확인 표기를 갱신했다. 과거 실패 기록은 삭제하지 않는다.
- 판정: goal.md 요청 범위의 구현 및 대표 실데이터/브라우저 검증 완료. 모델 일반화·모든 해석 정확성은 완료 주장에 포함하지 않는다.
