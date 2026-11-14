# TA Dynamic Canvas 구현과 API 검증

날짜: 2026-11-15. 결정 ID: `TA-CANVAS-001`.

## 승인 범위와 검증 역할

Host `/chat` 기술적 분석을 서버 report ID별 여러 보고서 탭과 AI 구성 OpenUI 보고서로 확장한다. open/reset/delta/validating/ready/error custom event, 선택 보고서 문맥과 구조화 재분석, 기존 모델 없는 Query 차트 API를 사용한다. quote/PDF/share/보고서 복원은 범위 밖이다.

사용자는 브라우저 검증을 직접 수행한다. 이번 작업은 API 수준 검증을 실행하며 브라우저를 열지 않는다. API 검증은 Bruno skill Inspect→Author→Run 원칙과 기존 `3-langgraph-fast/bruno-api-tests` 컬렉션을 사용한다. 기존 사용자 변경과 human-docs, 이전 flow를 보존하고 커밋하지 않는다.

## API 시나리오

| ID | Given/When | 기대 결과 |
| --- | --- | --- |
| TA-CANVAS-API-01 | 격리 thread에서 일반 지표 설명 | 분석 report를 만들지 않음 |
| TA-CANVAS-API-02 | bounded 실제 Yahoo TA 요청 | 서버 UUID, custom 이벤트 순서와 검증 완료 ready, 계산/프로그램 snapshot |
| TA-CANVAS-API-03 | 같은 thread의 두 번째 분석 | 별도 report ID, 이전 report 불변·두 snapshot 유지 |
| TA-CANVAS-API-04 | 선택 report ID로 후속 설명 | 선택 snapshot 문맥 사용, 자동 재분석·추가 report 없음 |
| TA-CANVAS-API-05 | 구조화 ticker/주기/봉 수/지표 재분석 | 서버 검증한 조건으로 새 report 생성 |
| TA-CANVAS-API-06 | 잘못된 구조화 조건·없는 report ID·가능한 실패 | 오류를 성공 ready로 표시하지 않음, 이전 report 유지 |
| TA-CANVAS-API-07 | 동일 조건 chart HTTP 조회 | thread/run/model 없이 정렬된 가격·지표 반환 |

구체 wire 계약 확정 후 request/assertion을 작성한다. 실제 모델·Yahoo·Host validator prerequisite과 실패는 숨기지 않는다.

## 소유 자원과 진행 상태

검증 담당은 필요 시 runtime3982, Host validator3183(`.next-ta-canvas-validation`)만 시작하고 종료한다. 사용자·공유 서비스는 종료하지 않는다. backend/frontend는 코드와 패키지 stock, 검증 담당은 TA 도메인 stock·이 flow·docs/INDEX와 API 테스트를 소유한다. 현재 구현·검증 준비 중이며 실행 결과는 아직 없다.

## API 준비 중 발견과 수정

- 실제 Host validator HTTP preflight에서 root가 뒤의 taLayout을 참조하면 `valid:false/errors:[taLayout]`가 반환됐다. 서버 prefix에서 root를 제거하고 모델 layout 뒤 마지막 root assignment를 server delta로 붙이는 방식으로 수정했다. FE는 root 전에는 준비 상태만 표시하고 ready 전 preview의 Query/action을 비활성화한다.
- 선택 report 설명에 summary만 제공하면 ticker/주기/기준일 문맥이 빠지는 것을 읽기 검토로 발견했다. backend가 title/request/asOf/signals를 설명 근거에 추가했다.
- 최초 실제 Bruno 요청은 thread 생성과 일반 RSI 설명2개 PASS 후 AAPL 분석에서 Yahoo/TA-Lib 계산은 성공했지만 composer가 `No generation chunks were returned`로 실패했다. custom error와 error report가 남고 ready를 보내지 않는 것을 확인했다. 로그: `3-langgraph-fast/bruno-api-tests/reports/ta-canvas-20261115.{log,json}`.
- backend는 정확한 provider empty-stream 오류에 한해 한 번의 ainvoke/full delta fallback을 추가했다. root가 해당 환경 제약을 숨기지 않고 기능 API 검증을 이어 가도록 승인했다. 실제 astream 토큰 수신과 fallback의 전체 layout delta, 마지막 server root delta를 구분한다.
- 독립 chart API Bruno2개 PASS: 실제60개 정렬 봉·지표 응답과 count201의422. 조회 전후 소유 thread run 수는2→2로 유지했다. `reports/ta-canvas-chart-20261115.{log,json}`.

기존 실패 report를 보존한 같은 thread에서 성공 report와 후속 조건을 검증하는 재시도를 진행 중이다. 아직 전체 성공으로 표시하지 않는다.

## 최종 API 결과와 범위

요청 파일은 `3-langgraph-fast/bruno-api-tests/22-ta-dynamic-canvas/*.bru` 13개다. 시나리오는 분할 실행해 확인했으며 단일 전체-suite 실행 성공으로 보고하지 않는다.

| 결과 | 실제 증거 |
| --- | --- |
| thread 생성·일반 지표 설명 | initial 로그의2개 PASS. 설명은 report/open 없음 |
| 실제 AAPL60 분석·선택 설명 | retry 로그의2개 PASS. report `da8c172f-4373-4f4c-809b-96423afd8f68`, 가격·세 지표·최종 프로그램, AAPL 선택 근거 확인 |
| 구조화 MSFT 주봉60/RSI7/SMA10, 오류, chart, run 수, 정리 | remaining 로그7/7 PASS(32.2초). 별도 report `cdce8a62-d203-4f01-b305-6f336c3d9704`; AAPL program SHA-256 불변; count201/unknown report는 open 없이 오류와 기존2개 report 보존; chart GET 뒤 예상7개 graph run만 존재; thread DELETE204 |
| 미지원 지표 clarification | clarification 로그2/2 PASS(8.8초). 볼린저 요청은 tool/open/report 없이 RSI/SMA/MACD 지원 설명 |
| 선택한 이전 report와 최신 report 구분 | context 로그2/2 PASS(9.8초). 실제 AAPL/MSFT 응답 snapshot을 새 소유 thread state에 HTTP seed한 명시적 API fixture에서, 최신 MSFT 대신 선택한 AAPL 설명·두 report/program hash 불변·DELETE204 확인. UI 복원 기능이나 새로운 실시간 Yahoo 실행 증거로 세지 않음 |
| 별도 chart 경계 | chart 로그2/2 PASS; 별도 조회 전후 run 수2→2 |
| 최종 실제 프로그램 parser | owned validator3183에 AAPL/MSFT 프로그램 각각 POST,2/2 valid=true/errors=[] (`ta-canvas-owned-validator-20261115.json`) |

리포트는 ignored `3-langgraph-fast/bruno-api-tests/reports/ta-canvas*-20261115.{log,json}`에 보존한다. 실제 Yahoo/TA-Lib 계산과 실제 모델의 구성 프로그램을 확인했으나 현재 provider는 astream empty-generation 오류 후 full-layout fallback을 사용했다. 두 delta는 전체 layout과 서버 root suffix이며 token streaming 성공이 아니다. fallback으로도 validating→ready와 최종 parser가 확인됐다.

초기 실패 후 autoreload가 상태/연결을 교체해 structured 요청이 socket hang up으로 한 번 중단됐다. 진행 중 run이 없음을 조회한 뒤 소유 runtime을 `--no-reload`로 재시작해 남은7개를 통과했다. 첫 error report는 최초 최종 values에서 확인했지만 다음 재시도 시작 state에는 없었으므로 error report의 재시작 간 보존을 검증했다고 주장하지 않는다. canvas 복원 자체는 범위 밖이다.

## FE 최종 계약과 사용자 브라우저 확인

최종 FE는 canonical root 전에도 taLayout draft를 SDK autoClose+preview 전용 root로 disposable projection한다. 실제 누적 프로그램은 변경하지 않고 Query provider·action·포인터 입력을 차단한다. prefix만 있으면 준비 문구를 표시한다. 서버가 ready를 보낸 검증된 프로그램만 실제 Query를 연결한다. 브라우저를 열어 이 동작을 검증하지 않았다.

사용자는 `/chat`에서 TA 선택→설명 요청(보고서 없음)→분석(새 탭)→두 번째 분석(기존 탭 유지)→이전 탭 선택 후 설명→Query 조건 편집/refresh→구조화 재분석을 확인한다. 전환·닫기·접기 시 polling/조회 정리, 오류 탭·재시도, 모바일·다크 테마, provisional preview의 action 차단도 직접 확인한다. quote/PDF/share/보고서 복원은 제공하지 않는다.

## 자원 정리와 인계

소유 thread2개는 DELETE204 후 GET404를 확인했다. 소유 runtime3982와 validatorHost3183을 exact session의 정상 종료로 닫았고 두 포트 LISTEN 부재 및 PID34443/42877/44456 부재를 확인했다. `.next-ta-canvas-validation` 및 이번 자동 tsconfig include를 제거하고 next-env 참조는 기존 `.next/types/routes.d.ts`로 복원했다. 브라우저·Playwright·공유 MCP를 시작하지 않았고 사용자 기본 서비스는 종료하지 않았다.

TA domain stock과 docs/INDEX를 최종 계약에 동기화했다. 사용자 후속 요청으로 커밋·기본4서비스 준비가 승인되어 frontend 담당에게 task-owned 파일과 API 결과를 인계한다. 검증 담당은 커밋하지 않는다. unrelated/human-docs/이전 flow 변경은 포함하지 않는다.
