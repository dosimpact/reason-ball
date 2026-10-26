# 전체 목표 완료 감사

기준: 2026-10-25, `goal.md` 전체 범위와 사용자 확정 사항. **요청 범위 구현 및 대표 시나리오 검증 완료.** 실제 SEC 접근 차단은 SEC-NATIVE-01에서 복구했고, SEC-NATIVE-02에서 원문 분석과 자동 갱신까지 검증했다. 모든 자연어 요청이나 모델 출력의 무오류를 뜻하지 않는다.

| 요구 | 현재 구현과 검증 | 판정 |
|---|---|---|
| 1.1 Deep Agent·SEC 수집 subagent/subgraph | 독립 Python의 sec-collector와 discover→download. 실제 Apple10-K3건/10-Q3건, 반복 수집 네트워크0건 | 확인 |
| 1.2 요약·섹션·온디맨드 분석 | PDF 전체 개요/섹션/후속 질문, SEC 원문 검색·인덱싱·Item1 요약·Item7 비교·10-Q Part I Item1/2 분석 | 대표 흐름 확인 |
| 1.3 6-2 다중 보고서 비교 승계 | PDF 준비/검색/페이지 출처/비교/SQLite 이력과 기존 경로 유지. 실제 NVIDIA/AMD/Intel 비교·후속 질문·복원 | 확인 |
| 1.4 다년·전년 대비·매출 | PDF2→3년 확대/연도 제외, SEC Company Facts3년/연도 제외/동일 패널 갱신. n=1/2/3/5 단위 검증, 상한20·기본3 | 확인 |
| 2.1 6-5 OpenUI·함수·액션 | 기존137구성요소/59함수/1액션 보존,138/60/2로 확장. defineFunction/defineAction 계산·입력·클립보드·포커스 예제 | 계약/브라우저 확인 |
| 2.2 프롬프트 동기화 | generate→명시적 복사→백엔드 재시작. 프런트 생성 프롬프트와 백엔드 자산 바이트 일치 | 확인 |
| 2.3 inline/canvas·6-4 UX | headless 채팅·버튼/드래그 게시·선택·부분 변경·탭·입력/대화 복원. 합성 DuckDB 엔진 대신 SEC 조회 경로 사용 | UX 승계 확인 |
| 3.1 Grafana 방식 패널 | 자체24열 grid, 이동/크기/고정/포커스/삭제·키보드·좁은 화면·충돌/Escape 처리 | 브라우저 확인 |
| 3.2 AG-UI 에이전트 조작 | 서버 명령·revision·snapshot/delta, 실제 대화로 생성/변경/삭제. 임의 DOM 실행 방식 아님 | 확인 |
| 3.3 기간 변경·다운로드 | 실제 연도 제외/동일ID 유지, US-14 JSON/CSV/2페이지PDF | 확인 |
| 4.1 HTML 온보딩 | /onboarding·React Flow9노드·실행/데이터/프롬프트 설명·390px 확인 | 확인 |
| 4.2 FSD/Steiger | pages/features/entities/shared·공개 API, production build/Steiger 통과 | 확인 |
| 4.3 SLAP | HTTP/도구/저장/계산/뷰 책임 분리, workspace/canvas 하위 책임 분리 | 구조 감사/회귀 확인 |
| 4.4 사용자 시나리오 | user-scenarios.md의 US-01~16 및 대화 이력·브라우저 검토 | 확인 |
| SQLite·캐시·요청 억제 | 정적 원문 재사용, 메타데이터TTL, 동일요청 합류·1초 제한·403/429 cooldown, 반복 다운로드0건 | 확인 |
| 수동·자동 갱신·Snapshot | 실제 SEC 수동/1분 자동 갱신200. Snapshot230초 refresh0건 및 수동/자동 컨트롤 비활성. Live/자동끔 복원 | 확인 |

## 최신 검증 근거

- `backend-langgraph/output/native-sec-tools-success.json`: 직접 수집/재무/캐시 반복 검증.
- `backend-langgraph/output/native-sec-e2e/`: 실제 에이전트7턴 SSE/진단/상태/메시지. turn2 갱신의 동기DB 차단 오류는 수정 후 turn4 성공; 실패 이력 보존.
- `frontend/output/playwright/native-sec-{excluded-refreshed,auto-refresh,snapshot,quarterly,annual-comparison}.png`: 직접 확인한 화면.
- `frontend/output/playwright/native-sec-snapshot-check.txt`:230,663ms, 요청0건, 컨트롤 비활성.
- `backend-langgraph/output/sec-native-settings-tests.txt`:131 backend tests 통과. Ruff 통과.
- `frontend/output/source-card-tests.txt`:440 frontend tests 통과.
- `frontend/output/completion-build.txt`:Steiger/production build 통과. 이후 온보딩 문구는 typecheck/ESLint/브라우저 확인.
- `frontend/output/completion-ui-regression.txt`:카탈로그/45개 갤러리 양쪽 테마2/2. 전체 승계4/4 근거는 inheritance-audit 참조.
- `backend-langgraph/output/scenario-history-current-audit.json`:US-01~16 저장 이력 조회 확인.

## 범위와 한계

BFF는 참고 코드/승인된 SEC 설정의 출처이며 런타임 서비스 의존성이 아니다. 실제 검증은3년이고3년을 최대치로 고정하지 않는다. 모든 보고서 완독, 전체 카탈로그 조합의 모델 생성, 모든 자연어 표현의 정확성, 다중worker 분산 rate limit은 보장 범위가 아니다. 근거 검사도 모델을 사용하므로 출처 확인이 필요하며 과거 실패/정정 이력을 보존한다. 연간 비교의 제품별 성장률과 분기 매출·기간·단위는 원문 대조했지만 모든 정성 해석의 정확성을 전수 인증한 것은 아니다.

과거403·보완 이력은 [flow](../flow/2026-10-25-dashboard-implementation.md), 원본별 계약은 [승계 감사](inheritance-audit.md), 검토 대화는 [시나리오 검토](scenario-review.md)에 연결한다.
