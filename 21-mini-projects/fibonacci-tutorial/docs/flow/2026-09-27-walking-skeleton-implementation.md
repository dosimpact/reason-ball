# Walking Skeleton 구현·검증

- 날짜: 2026-09-27
- 맥락: 실제 동작하는 최소 사용자 흐름 구현·검증 요청. GPT Sol 에이전트로 도메인/API와 UI를 병렬 작업.
- 범위 WS-01: 더미 Wave 3 연습 유닛 1개. 시작점·1파·2파 선택 → 계획 확정·파일 보존 → 서버에서 다음 캔들 공개 → 순수 평가 → 새로고침 시 복원.
- 이후 확장: 전체 1–5파 validator, 이론 모드, Binance·캐시, 장기 사후 평가는 이번 첫 경로 다음 단계.
- 구현 결정: 서버 전용 고정 OHLC fixture, 로컬 JSON 저장소(환경변수 FIBONACCI_DATA_DIR), 원자적 저장과 단일 프로세스 직렬 mutation. 세션 ID는 임의 UUID. 공개 서비스 인증은 이후 과제.
- 모의 체결: long 지정 가격 접촉 시 진입, 갭으로 건너뛴 경우 첫 open으로 체결. 동일 봉에서 진입 후 청산 선후가 불명확하거나 SL·Target을 동시에 건드리면 indeterminate. 수수료·슬리피지 0의 명시적 학습 정책.
- API 계약: GET /api/catalog; POST /api/sessions {unitId:"wave-three"}; GET /api/sessions/:id; POST /api/sessions/:id/plan {waveIndices:[0,3,6],entry:114,stopLoss:99,target:142.36,rationale:"..."}; POST /api/sessions/:id/replay {expectedCursor:7}. 상태 변경은 서버가 결정하며 임의 cursor와 미래 포인트는 거부.
- 공유 응답 SessionView: {id,unitId,cursor,visibleCandles:Candle[],totalCandles,plan:TradePlan|null,evaluations:TradeEvaluation[],complete:boolean}. Candle {time:number(UTC seconds),open,high,low,close}. cursor는 마지막 공개 배열 index. catalog {chapters:[{id,title,units:[{id,title,mode,description}]}]}.
- TradePlan: {schemaVersion:"1",id,sessionId,unitId,createdAt,asOf:number,snapshotId,source:"dummy",wavePoints:[{wave:0|1|2,candleIndex,time,price}],entry,stopLoss,target,rationale,fibonacci:{retracement:number,extension1618:number},policyVersion:"touch-v1"}. 서버가 시각·ID·가격 근거 생성. 0·2는 low, 1은 high. 공개된 순서 있는 점만 허용.
- TradeEvaluation: {id,planId,evaluatedAt,observedThrough:number,status:"pending"|"open"|"target"|"stop"|"indeterminate"|"expired",entryPrice:number|null,exitPrice:number|null,resultR:number|null,reason:string}. 평가 호출의 부작용(식별자·시각)은 use case에서 공급. 확정 계획 재저장은 409.
- 초기 fixture: 8개 공개 캔들, Wave0 index0 low100, Wave1 index3 high120, Wave2 index6 low110. 총 12개 이상. 기본 계획 entry114/stop99/target142.36로 재현 가능한 수익 시나리오.
- Given/When/Then WS-API: 새 세션을 만들면 초기 8개 캔들만 전달; 미래 index로 계획 확정하면 400; 유효 계획 확정 후 재저장하면 409; 다음 공개 시 1개만 증가; stale expectedCursor는 409; 저장 후 재조회는 원본 동일.
- Given/When/Then WS-UI: 유닛 진입 → 포인트 선택 → 계획 입력·확정 → Replay → 평가; 새로고침해도 계획과 공개 범위 복원. 차트 클릭과 키보드 가능한 캔들 선택 UI를 함께 검증.
- 검증 상태: 완료. 순수 단위 9/9, Bruno 요청 18/18 (tests 18/18, assertions 18/18), Playwright UI 3/3, Storybook 상태 5/5, lint/FSD·typecheck·프로덕션 앱/Storybook build 통과. [상세 증거](../validation/walking-skeleton.md).
- 영향 stock: 시스템·비즈니스·검증 문서를 WS-01 구현과 동기화했습니다. README·AGENTS·문서 지도도 갱신했습니다. 전체 MVP와 후속 범위를 분리했습니다.

## 통합 중 보강과 결정

- 시작 시점의 고정 fixture만 참조하면 이후 파일 변경이 기존 Replay를 바꾸는 문제가 있었습니다. 서버 JSON에 `{view,snapshot}`을 저장하고 전체 캔들의 SHA-256 ID를 계획에 고정했습니다. 응답은 `view`만 반환합니다.
- 유닛 ID의 하드코딩된 literal을 제거하고 카탈로그와 서버 시나리오 registry를 연결했습니다. 새 연습 유닛은 콘텐츠·시나리오 등록으로 추가할 수 있습니다. 이론 진행기는 후속 구현입니다.
- 체결 정책은 `touch-v1` 상승 buy-stop입니다. 시가 진입/갭 청산을 구분하고, OHLC 내부 선후가 모호하면 임의 손익을 만들지 않습니다.
- 실제 MCP에서 차트 클릭·키보드 선택·기본 계획 확정·4봉 Replay·목표 도달(+1.89R)·새로고침을 확인했습니다. 이후 해당 흐름을 Playwright로 고정했습니다.
- 최초 E2E 중 작업자가 재빌드한 `.next`를 실행 중 서버가 참조하여 hydration이 되지 않는 실패가 발생했습니다. 빌드와 서버 실행을 순서대로 소유하는 통합 runner로 해결했습니다. 최종 검증은 앱·Storybook을 새로 빌드한 뒤 수행했습니다.
- 모바일 CSS가 챕터 목록을 숨기는 문제를 E2E에서 발견해 작은 화면에서는 상단 탐색 영역으로 표시하도록 수정했습니다. 최종 390px 화면의 오버플로와 실제 조작을 검증했습니다.
- Bruno 이후 동일 cursor의 동시 요청 2건이 200/409로 갈리고 한 번만 진행하는지 확인했습니다. 서버를 종료하고 같은 임시 디렉터리로 재시작해 전체 세션이 동일한지 비교했습니다.
- 루트 lockfile은 프로젝트 추가와 함께 갱신했습니다. 기존 workspace의 다른 manifest와 lockfile 간 drift 때문에 전체 resolution 변경도 포함됐습니다. 다른 프로젝트 manifest는 수정하지 않았으며 scoped frozen install을 재실행해 통과했습니다. 다른 앱의 런타임은 이번 검증 대상이 아닙니다.
- Storybook/Vite의 `use client` 지시문·chunk 크기 및 Node 26 deprecation 경고는 남아 있으나 build와 브라우저 상태 테스트는 통과합니다. workspace 타 앱 peer 경고는 이번 앱의 검증과 구분합니다.
- 테스트 서버와 MCP 브라우저를 종료했고 소유 PID·포트·임시 데이터 잔여를 확인했습니다. 다른 Next.js 15 개발 서버는 유지했습니다.
