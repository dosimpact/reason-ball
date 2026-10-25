# 구현·검증 현황

**최신: SEC-NATIVE-01에서 자체 Python SEC 수집·Company Facts 조회·갱신이 성공했다. 이전 BLOCK-SEC 기록은 당시 이력이며 현재 차단 상태가 아니다.** BFF 서비스 의존성은 없고, 사용자 지시에 따라 SEC 설정값만 복사했다. Apple10-K3건/10-Q3건 및 반복 다운로드0건, 실제 채팅/Canvas 갱신 성공. SEC-NATIVE-02에서 원문 검색·분석 및 자동 갱신/Snapshot 검증까지 완료했다. 현재 요구별 최종 판정은 [완료 감사](completion-audit.md)를 따른다.

기준: 2026-10-25 현재 작업 트리. 사용자의 범위 변경을 반영했다: **3년 실데이터로 n년 변경 검증**, 10-K·10-Q 한정. 기간 상한을 3년으로 고정하지 않는다. 대표 시나리오 검증과 모든 모델 응답의 정확성 보장은 구분한다. 과거 오류와 수정 과정은 [flow](../flow/2026-10-25-dashboard-implementation.md), 원본별 대응은 [승계 감사](inheritance-audit.md)에 보존한다. 아래는 현재 증거와 남은 검증이다.

## 요구사항 대조

| goal.md 요구 | 현재 구현 및 직접 확인한 범위 | 남은 검증·제약 |
|---|---|---|
| SEC 다운로드 subagent/subgraph | CIK 식별·공시 탐색·원문 수집·실패 보존 구현, 단위 테스트 | Apple 10-K/10-Q 각3건, 재무3년, 반복 네트워크0건과 수동·자동 갱신 성공 |
| 요약·섹션·온디맨드 분석 | PDF 검색/문구 위치 찾기/원문 페이지 읽기, 범위 표시, 후속 질문, 게시 전 근거 검사 | 전체 보고서 완독을 주장하지 않음. SEC 원문 검색/Item 1 요약/두 해 Item 7 비교/10-Q Part I Item 1·2 확인 |
| 6-2 다중 보고서 비교 승계 | 준비 CLI·검색·페이지 출처·SQLite 이력·/comparison 유지. NVIDIA/AMD/Intel 비교 및 수치 정정 검증 | 모델 기반 근거 검사는 정확성 보증이 아님 |
| 같은 기업 다년 분석 | 공식 NVIDIA FY2025/FY2026 PDF 비교. FY2024~2026 확대와 FY2025 제외, 같은 ID/배치·출처·reload 확인 | 3년 PDF 기반 확대·제외는 확인됨. 공식 IR 10-Q PDF의 분기 차트는 확인됨. SEC 직접 수집·갱신도 확인. 모델 요약의 일반적 정확성은 보장하지 않음 |
| 6-5 OpenUI 승계 | 기존137 구성요소/59 함수/CopyToClipboard 유지, DashboardArtifact/YearOverYear/FocusPanel 추가 | 모든 조합의 전수 모델 생성 성공을 주장하지 않음 |
| Headless Chat / Canvas | 자체 화면·선택 맥락·뷰 전환·대화 CRUD·중단·복원·도구 활동 | 원시 도구 inspector는 /comparison에 유지, 주 화면은 요약 활동 표시 |
| 6-4 Canvas UX | 24열·탭·등록·버튼/드래그 추가·입력 복사·영속성·패널 선택 | 합성 DuckDB 엔진 복사가 아니라 SEC/PDF 경로와 UX 통합 |
| Grafana 방식 배치 | 실제 이동·리사이즈·충돌·Escape 취소·핀·키보드·좁은 폭 투영·다른 탭 포커스 확인 | 공식 소스 참고/적용 차이는 [Grafana UX](grafana-ux.md) 참조 |
| AG-UI 에이전트 조작 | 공통 명령·서버 ID·revision·상태 snapshot/delta. 패널/탭 생성·수정·삭제 확인 | 의도 분류는 모델 기반. 실패/복구 이력 보존 |
| 생성·완료 판정 | 기존 대상 종류/ID·새 패널 수·실제 성공 도구·연쇄 삭제 검사, 중복 생성 방지 | 과거 과도한 조건 사례 있음. 최신 재현은 추가/삭제 missing=[]; 모든 표현의 안정성 보장 아님 |
| 삭제 확인 | 미승인 nonempty 탭 확인 정책, 서버 직접 질문 표시·저장, 승인 후 대상만 삭제 | 확인 필요 여부의 의도 분류는 모델에 의존 |
| 입력·출처 보존 | 대화별 순차 저장, 메모/체크/폼 reload, parser 출처→저장→JSON 다운로드 확인 | 기존 모든 패널의 소급 동기화는 하지 않음 |
| 갱신·Snapshot | 수동/1·5·15분 visible-only 갱신, Snapshot 동결, 실패 시 이전 결과 보존 | 격리 가정 데이터 UI/단위 검증. 실제 SEC 성공은 미확인 |
| 내보내기 | JSON 전체 탭·입력/가져오기, CSV 표·차트, PDF 인쇄. 40행 표·2계열 차트 검증 | 브라우저 다운로드/인쇄 동작 필요. 파일 저장을 모델 응답만으로 완료 처리하지 않음 |
| FSD/Steiger | pages/features/entities/shared, public API. 최신 npm run verify 통과 | 향후 변경 시 재검사 |
| SLAP | HTTP·도구·서비스·저장·계산·뷰 분리. workspace/canvas에서 메시지·시작 안내·분할 조절·패널·툴바·탭 책임 분리 | 분리 후 탭 생성/삭제·JSON·메모 reload·분할 드래그 Escape 회귀 확인 |
| HTML 온보딩·React Flow | /onboarding 최신 기능 반영, 9노드 확대/Fit View,390px overflow 부재 | 최신 전체 문서 지도는 docs/README.md |
| 사용자 시나리오·검토 이력 | US-01~16 전용 문서, 대표 실제 대화 보존 | 예시 목표와 구현 완료를 구분 |

## 최신 검사

- backend: 최근 전체 131 tests 및 Ruff 통과. 검사 모델의 실제 실패 사례는 아래 GROUNDING/SOURCE-KEY 항목에 구분한다.
- frontend: 최근 전체 440 tests·typecheck·변경 파일 ESLint·Steiger 통과. 출처 렌더러 변경 후 production build도 통과했다(output/completion-build.txt). 이후 온보딩 안내 문구 변경은 typecheck/ESLint/브라우저로 검증했다.
- 최신 승계 E2E: 실제 서버에서 4/4 통과(카탈로그 혼합 입력/함수/클립보드, 양쪽 테마 45예제, 실제 기업 비교/후속 질문/reload, 실제 카운터 생성/클릭/reload). 원본 명세 직접 대조와 프롬프트 동기화도 확인했다. `final-inheritance-e2e.txt`와 승계 감사 참조.
- 실행 계획 진단: 실제 계획·완료 효과·미충족 조건·실행 종료 상태를 로컬 SQLite에 대화별 최근100회 보관한다. 전체 메시지/원문/프로그램/키를 기록하지 않는다. 계획 요약에는 사용자 요청을 반영한 문구가 포함될 수 있다. 대화 삭제 시 함께 삭제된다.
- 화면 책임 분리 후 검증: `npm run verify` 통과. 실제 브라우저에서 탭 추가/삭제, JSON 파일, 기존 패널 전체 객체 보존, 다른 대화의 메모 편집→reload→원래 값 복원, 분할 드래그→Escape 복원을 확인했다. 증거는 flow의 화면 책임 분리 항목을 따른다.
- 브라우저 콘솔의 외부 favicon 404 등 별도 오류는 남아 있으며 console clean을 주장하지 않는다.

## 대표 검토 대화

| 대화 ID | 확인한 흐름 |
|---|---|
| 5cff361a-f605-4d80-959f-e14cf102255c | 기업 비교·원문 검토·수치 귀속 정정·동일 패널 갱신 |
| 41b4f318-03f5-4c85-93cc-0803dee07f3c | 두 NVIDIA 보고서·기간 확대/제외·출처 저장/JSON |
| 1b11da35-2a4d-4039-b4b2-3a7210c0c838 | 정확한 한국어 탭/패널 생성, 확인 질문, 연쇄 삭제, 기존 유지+추가/승인 삭제 진단 |
| 83057618-023c-436f-9e0b-9110d08883c2 | 메모/체크리스트·연속 입력·복원 |
| 421a24e5-0886-45d6-a0b9-f9002eed77f2 | 폼 입력·Select·클립보드·Canvas 복원 |
| 0a873d3e-bd7f-4fdc-a5cc-41dc61771074 | SEC403 후 같은 대화에서 준비 PDF 분석 재개 |
| f854d038-b615-4c42-8760-ac7ee1a8515a | 동명 패널 확인→정확한 탭의 패널만 수정 |

대표 실패도 대화에 남는다. 최신 성공을 과거 실패까지 성공한 것으로 해석하지 않는다. 개별 증거 파일과 수정 이력은 flow에 연결한다.

## 다음 완료 조건

1. 실제 SEC 원문 수집·3년 재무 조회/기간 수정/갱신 성공 증거 확보. 외부403이 지속되면 그 항목은 미완료로 유지한다.
2. SLAP 화면 책임 분리 및 주요 회귀 검증 완료. 이후 수정에서도 같은 저장/상호작용 경계를 유지한다.
3. 승계 명세·4개 통합 E2E·화면 책임 분리 회귀 감사는 완료했다. SEC 접근 복구 후 남은 실데이터 흐름을 검증하고 전체 요구를 다시 대조한다. 모델 판정 오류는 실행 당시 진단으로 추적한다.

## BLOCK-SEC-01 재개 조건

동일 SEC 403이 연속 세 목표 턴에서 남았으며 최신 직접 요청에서도 tickers/submissions/Company Facts 모두 실패했다. 설정에 사용자가 제공한 연락처가 포함됨을 값 노출 없이 확인했다. 추가 키가 필요하다는 증거는 없다. 현재 실행 환경에서 SEC의 정상 응답이 가능해지는 외부 상태 변화가 필요하다.

- 증거: `backend-langgraph/output/sec-blocker-audit.json`.
- 재개 후: 실제 기업 식별→10-K 수집 완료/원문 읽기→3년 재무 차트 생성→특정 연도 제외→갱신 성공→브라우저 reload/출처/이력 검증. 단위 테스트나 준비 PDF로 이 성공 증거를 대체하지 않는다.
- 보존: 대표 대화 7개의 메시지 존재를 다시 확인했다(`backend-langgraph/output/representative-history-audit.json`). 서비스와 로컬 데이터는 유지하며 승인되지 않은 배포·commit·push는 수행하지 않았다.

## SCOPE-03 사용자 범위 변경

기존 BLOCK-SEC-01은 실제 SEC 접근의 제약 기록으로 남기되 3년 기반 n년 변경 기능을 막는 조건으로 해석하지 않는다. n=1/2/3/5 연간 선택과 연도 제외, n=1/2/3 분기 보고 기간 수 및 지원 외 form 거절을 단위 검증했다. 기존 실제 NVIDIA FY2024~2026 확대/연도 제외 대화는 대표 n년 기능 증거로 사용한다.

최신 3년 재검증: 같은 NVIDIA 패널을 실제 대화로 FY2024~2026에 재확대하고 reload에서 세 값/출처를 확인했다. 패널 수1, ID와 요청 직전 너비13 유지. backend106 tests/Ruff, frontend typecheck/변경 파일 ESLint 통과. 10-Q는 수집 범위·개수의 단위 검증이며 실제 분기 원문 분석 성공까지 주장하지 않는다.

## CACHE-01 최신 검증

backend114 tests와 Ruff 통과. 동시 일반조회12개/갱신5개를 각각 한 번으로 합침, 취소 격리, 캐시 재사용, 잘못된 갱신의 기존 보존, 403/429/503 대기와 캐시 사용, Retry-After 날짜/초 및 순차 호출을 검증했다. 실제 NVIDIA submissions 한 건은 403이며 이어진 호출은 추가 HTTP 없이 60초 cooldown으로 억제됐다. 증거 backend-langgraph/output/sec-cache-tests.txt 및 sec-cache-live-check.json. 실제 수집 성공은 여전히 미확인이고 전체 목표는 진행 중이다.

## US-REPLAY-01 새 검토 이력

사용자 요청으로 [US-01~16 실데이터 검토 이력](scenario-review.md)을 새로 생성했다. 각 대화는 실제 에이전트 실행과 서버 이력 저장으로 구성되며 기존 이력은 보존한다. 16개 브라우저 재선택/렌더링, 입력 변경/복원, 포커스 버튼, 실제 JSON·CSV·PDF 다운로드를 확인했다. 최초 실행의 계획/표시/저장 실패는 같은 대화에서 보완했으며 무오류 첫 실행을 주장하지 않는다. SEC 신규 수집 실패는 그대로 드러낸다.


## GROUNDING-SCOPE-01 검증 범위

US-10의 실제 저장 원문 근거로 검사기를 직접 호출하여 정상 연도 제외 통과, 잘못된 금액 차단, 비연속 기간의 YoY 표기 차단을 확인했다. backend117 tests 및 Ruff 통과. 증거는 `backend-langgraph/output/grounding-scope-live-final.json`, `grounding-scope-tests.txt`다. 변경 후 실제 에이전트→동일 패널 저장→브라우저 reload를 확인했다. 회귀 대화 `05a0c606-5371-490e-928f-edf7f8f9120f`에서 3년 차트 생성 후 “같은 패널에서 FY2025만 제외해줘.” 요청으로 FY2024/FY2026만 표시됐다. 패널 ID와 배치 유지, revision2→3, 두 턴의 실행 계획 미충족 조건 없음. 첫 생성에서 OpenUI 구문 오류를 에이전트가 자체 수정했으며 실패 기록을 보존했다. SEC 신규 수집·실제 10-Q 분석과 전체 요구 감사는 남아 있다. 연구 요청의 Canvas 계획 오분류는 아래 PLAN-INTENT-01에서 수정·회귀 검증했다.


## PLAN-INTENT-01 최신 검증

실제 모델 기본 의도6개(요약/차트/채팅 전용/재사용 게시/Canvas 추가/두 패널), 선택 패널 후속5개(설명/기간 수정/고정/너비/불명확한 연도 제외)를 검증했다. backend118 tests/Ruff 통과. 실제 회귀 대화 `0e8b3943-39f7-47e2-816c-f9f054d22633`에서 채팅 차트만 생성 시 패널0, 명시적 Canvas 추가 시1, 설명 질문 후 패널 전체 객체와 revision 유지, 브라우저의 불명확한 연도 제외 요청에서 확인 질문 및 대시보드 전체 상태 유지·reload 복원을 확인했다. 첫 3턴 RUN_ERROR 및 missing 없음. 증거는 output/planner-intent-final.json, planner-followups.json, planner-intent-tests.txt, planner-e2e/ 및 frontend/output/playwright/planner-*.txt/png다.


## SEC-Q-PARTS-01 검증과 남은 경로

분기 보고서의 Part별 중복 Item 손실을 수정했다. 10-Q/A 모의 원문으로 수집→SQLite→Part별 읽기→모호한 요청 후보 반환→캐시 재사용 및 기존 Item-only 섹션/검색 인덱스 복구를 검증했다. backend119 tests/Ruff 통과(`output/quarterly-parts-tests.txt`). 실제 NVIDIA submissions 단일 요청은 계속403(`output/sec-quarterly-access.json`)이며 이후 요청을 반복하지 않았다. 실제 10-Q 원문·브라우저 분석 검증과 신규 SEC 수집 성공은 남아 있다.


## SEC-Q-REAL-01 실제 분기 PDF 검토 및 새 결함

공식 NVIDIA FY2027 Q2 PDF(61쪽)를 기존4개 문서와 함께 준비했다(5문서/2512구절). PDF 추출 텍스트의 Part I Item1과 Part II Item1 분리를 확인했다. 실제 대화 `3c5b1b38-446f-4bc2-811e-cd93185c26b3`에서 PDF3쪽 분기 매출46743/96221과6개월 누적90805/177837(백만USD), 최종1개 Canvas 패널과34쪽 요약 정정을 브라우저 reload에서 확인했다. 이는 IR PDF 기반이며 SEC 직접 원문 다운로드는 여전히 실패했다.

첫 시도 성공은 아니다. 긴 요청의 Canvas 오분류를 OutputScope 분리/서버 계획 제한으로 수정했고 같은 요청에서 패널0을 확인했다. 이후 명시적 Canvas 추가가 chat artifact로만 저장되어 미완료였고, 재시도 중 약간 달라진 프로그램을 재게시해 패널2개가 생겼다. 실제 삭제 요청으로1개를 남겼다. 최초 위험 요인 요약은 예외 조건을 빠뜨려 후속 원문 재확인으로 바로잡았다. 실패 대화 `394dfd8f-5444-48f0-9c93-a1363d652c08` 및 모든 실패/정정 턴을 보존했다.

출력 위치 분리 후 실제 모델 기본6개+선택후속5개 통과, backend121 tests/Ruff 통과. **남은 결함**: 게시 목적지 누락 방지, 답변 보완 재시도의 중복 패널 방지, 위험 요인의 예외/부정 조건 검사 강화. 전체 목표 완료가 아니다. 신규 SEC 수집 및 SEC HTML/XBRL 전체 경로도 미완료다. 증거 output/quarterly-e2e/, quarterly-e2e-before-scope/, quarterly-real-sections.json, quarterly-prepare.json, quarterly-real-tests.txt와 frontend/output/playwright/quarterly-*.txt/png.


## PUBLISH-POLICY-01 검증

계획 기반 목적지 처리와 정확한 요청 개수의 생성 상한을 추가했다. destination 생략/금지 목적지/혼합 목적지, 병렬 생성1개·2개 상한, 실패 시 허용량 보존, 동일 요청 재사용, 기존ID 수정, 새 사용자 실행의 허용량 분리, 응답 목적지 기반 완료 판정을 단위 검증했다. backend126 tests/Ruff 통과. 실제 모델 기본6개에서 목적지·개수·상한을 확인했고, 별도 “최소2개” 요청은 minimum2/maximumNone으로 검증했다(output/publication-at-least-plan.json).

새 실제 대화 `b759b659-58e7-4b98-b8df-3bf2dd8ec468`(`[회귀 검증] 단일 분기 패널 게시`)에서 PDF3쪽 분석→정확히1개 Canvas 추가→제목 변경을 실행했다. 패널 수0→1→1, add 계획 최소/최대1, 세 실행 RUN_ERROR/missing 없음, 게시 도구 실패 없음. 제목 변경 시 ID/프로그램/배치 동일이며 브라우저 reload에서1개 패널을 확인했다. 실제 모델은 목적지를 명시했으므로 생략 경로 자체의 증거는 단위 테스트다. 분석 카드의 분기 종료일을 Fiscal Year Ended로 표시한 문구 문제는 남아 있어 내용 정확성 전체 통과로 해석하지 않는다.

위험 요인 예외/부정 조건 및 기간 의미 검사 강화, SEC 신규 수집·HTML/XBRL 경로와 전체 요구 감사는 남아 있다. 증거 output/publication-policy-tests.txt, publication-plan-limits.json, publication-e2e/; frontend/output/playwright/publication-single-panel.txt/png.


## GROUNDING-QUALIFIER-01 검증과 미완료 사항

백엔드130 tests/Ruff 통과. 실제 원문 기반 직접 검사7사례(예외 누락/보존, 분기-연간 기간 표기, 근거 없는 법적 절차 주장/주석 참조 등)를 검증했다. 회귀 대화 c763a580-e535-4570-a4a9-90c06f27d750의 turn7은 근거2건으로 초안을 거절→재작성 승인하고 최종 TEXT_MESSAGE_CONTENT 한 건만 전달했다. Canvas 전체 상태는 turn2와 동일하며 브라우저 reload에서 최종 답변과 분기 차트1개를 확인했다.

완전한 내용 정확성 통과는 아니다. 최종 답변이 예외 범위를 언급하면서도 아래 위험 요인에 실제 변경이 있다고 단정한다. 예외 존재만으로 변경 사실까지 추론하지 않도록 보완이 필요하다. 같은 대화의 과거 카드에서 동일 출처 URL의 React key 중복 오류도 확인했다. turn6의 메시지 형식 변환 오류는 convert_to_messages로 수정했으며 실패 이력을 보존했다. SEC 신규 수집 및 전체 완료 감사는 여전히 남아 있다. 증거 output/qualifier-e2e/turn-7-*, output/qualifier-grounding-actual-final.json, output/qualifier-grounding-tests.txt(backend), frontend/output/playwright/qualifier-buffer-final.png.


## SOURCE-KEY-01 출처 중복 수정과 정확성 재검증

동일 URL의 두 출처를 가진 기존 회귀 대화에서 key 중복 오류를 수정했다. 실제 브라우저 재선택/reload에서 인용2개 보존, 두 번째 인용의 Enter→원문 PDF 새 창 열기, 콘솔 key 오류 없음 확인. frontend440 tests/typecheck/변경 파일 ESLint/Steiger, backend130 tests/Ruff 통과.

GROUNDING-QUALIFIER-01의 직접 모델7사례를 추가 지침으로 재실행한 결과5개 통과/2개 실패(분기를 연간으로 표기한 후보, 예외를 실제 변경으로 단정한 후보)였다. 과거7개 통과는 안정적 차단 보장이 아니다. 실제 turn8은 예외를 언급하지만 '아래에 추가된 위험 요인'으로 번역하여 신규 여부 추론 문제를 남겼다. 새 지침만으로 정확성 결함을 해결했다고 판정하지 않는다. SEC 신규 수집과 전체 완료 감사도 남아 있다. 증거 backend-langgraph/output/qualifier-grounding-converse.json, qualifier-converse-tests.txt, qualifier-e2e/turn-8-*; frontend/output/source-card-tests.txt, output/playwright/source-card-fixed.png.


## DISCLOSURE-01 현재 실제 응답

후속 검사 실험에서 기간 전용 검사는 오표기를 차단했지만 예외 추론 오판이 남았다(4사례 중3통과). gpt-4.1 비교도7사례 중6통과이며 과도한 추론을 승인했다. 모델 교체/추가 검사 호출은 도입하지 않았다. 생성 지침을 원문 예외 문장의 직역과 별도 추론 표시로 보완한 뒤 c763a580-e535-4570-a4a9-90c06f27d750의 turn9은 '아래 기술된 위험 요인을 제외하고는'이라는 범위를 보존하고 새 위험/실제 변경을 단정하지 않았다. Canvas 전체 상태는 turn2와 동일하다. 실제 브라우저 확인 및 Ruff 통과. 기존130/440 테스트 결과는 이전 코드 검증이며 이번 생성 품질의 근거는 실제 turn9다.

b759b659-58e7-4b98-b8df-3bf2dd8ec468의 기존 패널 d400f856-8406-430e-a128-b847ed865be0을 실제 수정 요청으로 Quarter Ended로 정정했다. ID/배치/출처/네 매출값 유지, 패널1개, RUN_ERROR/missing 없음. 설명/표 제목은 한국어로 다시 생성되어 단순 문자열 치환은 아니다. reload에서 현재 Canvas의 분기 표기를 확인했으며 과거 잘못된 채팅 답변은 이력으로 남긴다.

증거: backend-langgraph/output/focused-review-probe.json, qualifier-grounding-stronger.json, qualifier-e2e/turn-9-*, period-label-repair/; frontend/output/playwright/literal-disclosure.png, period-label-repaired.png. 일반적 의미 정확성은 여전히 보장하지 않으며 SEC 신규 수집·갱신과 전체 요구 최종 감사가 남아 있다.


## AUDIT-CURRENT-01 전체 대조

[전체 목표 완료 감사](completion-audit.md)에 목표별 구현·증거·미완료 경로를 대조했다. 최신 SEC submissions 단일 신규 요청403. 현재 US-01~16 이력 조회 모두 성공. 최신 승계 UI 회귀2/2와 production build/Steiger 통과. 온보딩의 준비 명령에 --include-quarterly 누락을 수정하여 현재 검토 자료를 유지하도록 안내했다. 타입/변경 파일 ESLint 및390px 브라우저 확인. 전체 완료를 선언하지 않는다.


## REFRESH-COOLDOWN-01 검증

캐시 요청 억제에서 발생하는 SecCooldownError가 갱신 경로에서 처리되지 않아500으로 끝나는 결함을 수정했다. 격리 SQLite/실제 HTTP 핸들러 테스트로 네트워크 미호출, 기존 데이터·성공 시각 보존, 시도 시각/대기 안내 저장, 잠금 해제, 동일 operation_id 재사용 확인. backend131 tests/Ruff 통과(output/refresh-cooldown-tests.txt).

브라우저는 격리 핸들러의 실제 JSON 응답을 route로 주입한 가정 데이터로 새로고침→대기 안내/차트 유지 렌더를 확인했다. SEC 실환경 성공 검증이 아니며 실제 저장 대화/Canvas에 가정 데이터를 넣지 않았다. 검사 후 실제 API 상태가 원래 openui 패널임을 확인했다. 증거 backend-langgraph/output/refresh-cooldown-ui.json, frontend/output/playwright/refresh-cooldown.txt/png.


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
