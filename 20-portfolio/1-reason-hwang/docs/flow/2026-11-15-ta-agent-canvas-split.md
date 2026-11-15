# 기존 TA와 Canvas TA 그래프 분리

날짜: 2026-11-15. 결정 ID: `TA-CANVAS-002`.

## 요청과 범위

기존 `technical_analysis_agent`를 채팅 inline deterministic presentation으로 복원하고, `technical_analysis_canvas_agent`를 별도 등록해 Dynamic Canvas 기능을 유지한다. Canvas wire·계산·Query 계약은 기존 TA-CANVAS-001을 재사용한다. 브라우저 검증은 사용자 수행이며 이번 작업은 API만 검증한다. 이전 flow·human-docs·관련 없는 변경은 보존하고 검증 담당은 커밋하지 않는다.

## API 확인 계획

- runtime discovery에 두 graph ID가 모두 존재한다.
- 기존 TA 실제 bounded 분석은 `presentation.program`을 반환하고 canvas custom event/report를 만들지 않는다.
- 신규 Canvas 실제 bounded 분석은 custom open/reset/delta/validating/ready와 서버 report UUID를 반환하며 inline presentation을 중복 제공하지 않는다.
- 별도 thread의 inline/Canvas snapshot과 두 프로그램의 parser validation을 확인한다.
- 직전 전체 Canvas 검증을 전부 재실행하지 않고 분리로 바뀐 경계에 한정한다. provider full-layout fallback은 실제 token streaming과 구분한다.

소유 runtime3982는 `--no-reload`, validatorHost3183은 `.next-ta-split-validation`으로 격리하고 종료한다. 현재 구현 freeze를 기다리며 아직 실행 결과는 없다.

## 최종 구현과 API 결과

기존 `primary_graphs/technical_analysis_agent`는 원래 inline workflow/state로 복원했다. 별도 `technical_analysis_canvas_agent/{__init__,state,workflow}.py`를 등록하고 기존 계산 상태를 상속한 Canvas state와 Dynamic Canvas 기능을 이동했다. Host의 custom event·canvas_context·탭·재분석은 신규 ID에만 연결하고 기존 ID는 본문+OutputView를 유지한다. `22-ta-dynamic-canvas`의 모든 요청 ID도 신규 graph로 변경했다. 이번에는 기존 전체22 suite를 다시 실행하지 않고 변경된 분리 경계만 검증했다.

실행: `3-langgraph-fast/bruno-api-tests`에서 `../node_modules/.bin/bru run 23-ta-agent-split --env local --env-var baseUrl=http://127.0.0.1:3982`.

- Bruno9개 요청·9개 테스트·9개 assertion 모두 PASS,62.3초.
- discovery에 두 graph ID가 모두 존재했다.
- 기존 TA의 실제 AAPL60 일봉 분석은15.6초, inline presentation의 Query/FinancialChart 및 분석 결과를 반환했고 canvas custom event/report는0개였다.
- 신규 Canvas의 실제 MSFT60 일봉 구조화 분석은46.6초, server report UUID `00776888-d9c6-4adb-8993-456bc6cd97b2`와 ready 프로그램을 반환했고 inline presentation은 없었다. delta2개는 provider full-layout fallback과 서버 root suffix이며 token streaming 성공으로 세지 않는다.
- 신규 실행 후 기존 inline 프로그램 SHA-256이 같았고 canvas state는 별도 thread에 report1개만 유지했다.
- 두 최종 프로그램을 소유 Host3183 validator에 각각 POST해2/2 valid=true/errors=[]를 확인했다.
- 두 소유 thread는 DELETE204 후 GET404로 확인했다.

증거: ignored `3-langgraph-fast/bruno-api-tests/reports/ta-agent-split-20261115.{log,json}`, `ta-agent-split-parser-20261115.json`. 기존 provider fallback 한계는 유지된다. 브라우저를 열거나 UI 동작을 검증하지 않았다. graph 선택·전환 시 탭 초기화와 inline/Canvas 시각 표시는 사용자가 확인한다.

## 정리와 문서 동기화

소유 runtime3982(`--no-reload`)와 validatorHost3183을 exact session으로 종료했고 두 포트 LISTEN 부재 및 PID57671/57695 부재를 확인했다. `.next-ta-split-validation`과 이번 자동 tsconfig include를 제거하고 next-env를 기존 `.next/types/routes.d.ts`로 복원했다. 사용자 기본 서버·브라우저·공유 MCP는 종료하지 않았다.

TA 도메인 INDEX/business/system과 docs/INDEX를 두 graph의 현행 계약에 동기화했다. 기존 flow와 human-docs는 수정하지 않았다. 검증 담당은 커밋하지 않았으며 관련 없는 staged/unstaged 변경을 보존했다.
