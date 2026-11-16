# TALIB-EVIDENCE-001 / TA-QUERY-DEADLINE-001: 시계열 근거와 조회 종료 경계

- 날짜: 2026-11-16
- 배경: 사용자 회귀 보고서의 SQZMOM 상태 설명 부족, OBV·AD에 추가한 ROC 실패, 최신값만으로 끝난 다중 지표 해석, Canvas 로딩 완료 미확인을 검토했다. `human-docs`와 증거 파일은 수정하지 않았다.

## 현재 구현

- 고정된 [TA-Lib v0.8.3 SQZMOM C 소스](https://github.com/TA-Lib/ta-lib/blob/v0.8.3/src/ta_func/ta_SQZMOM.c)의 strict 비교를 확인했다. squeeze는 정수 상태다. `-1`은 두 Bollinger 밴드가 wide Keltner 채널 바깥인 해제 상태, `0`은 부분 겹침·경계 접촉, `1/2/3`은 각각 wide/normal/narrow 내부 압축 단계다. 모멘텀 방향은 별도 momentum 출력으로 해석한다. 이 의미와 출처를 descriptor·계산 출력·모델 요약에 전달한다. 계산 공식을 바꾸지 않았다.
- 네이티브 ROC 계열의 전체 이력 양수 제약을 명시한다. OBV·AD의 부호 있는 누적값에 요청하지 않은 백분율 ROC를 덧붙이지 않도록 지침을 추가했다. 자유 함수 호출을 금지하거나 입력을 abs/shift로 변조하지 않는다. 유효한 양수 입력의 명시적 ROC는 그대로 허용한다.
- TA 공통 `summarize_series`를 재사용해 최근 최대120 계산 봉의 실제 시작·끝·유효 개수·min/max·절대 변화와 종목 가격·거래량 근거를 제공한다. 누적·정수 상태의 백분율은 제시하지 않는다. 전체 배열은 모델 요약에 복사하지 않으며 종합 점수·인과·예측을 만들지 않는다.
- HTTP 검증 중 canonical 데이터와 ticker 별칭이 독립 입력 두 개로 오인되어 단일 데이터의 기본 함수 호출이 실패하는 경계를 발견했다. 동일 데이터는 하나의 canonical operand로 고정하고, 실제 다중 데이터의 생략된 입력은 계속 오류로 처리한다.
- chart/catalog fetch에30초 제한을 추가했다. 헤더 수신뿐 아니라 JSON 본문 처리까지 포함한다. 외부 abort를 전파하고 완료·실패·취소 때 타이머와 listener를 정리하여 Query가 무기한 pending으로 남지 않게 한다.

## Canvas·개발 graph 확인 범위

현재 `langgraph.json`에는 `technical_analysis_canvas_agent`가 등록되어 있다. 설치 SDK1.0.1은 `isStreaming` 동안 Query effect를 차단하며 Canvas의 provisional/ready 전달은 이 경계에 맞는다. 이 경계에서 소스 결함은 확인하지 못했다. 오래 실행된2982 프로세스의 등록 상태는 현재 소스와 별개이며 서비스 재시작 뒤 API 검색으로 확인해야 한다. 차트 완전 로딩의 브라우저 증거를 이번 작업에서 새로 확보했다고 주장하지 않는다.

## 검증·정리

- Python: `uv run pytest tests/test_talib_evidence.py tests/test_talib_comparison.py tests/test_talib_agent_graph.py tests/domains/talib_agent -q` → **276 passed**. SQZMOM1200봉의 native 합성 채널 비교, 경계값0, 양수 ROC 허용·부호 입력 오류, 가격·거래량 근거, 별칭 기본 입력 회귀를 포함한다.
- Python 변경 파일 scoped Ruff 통과, Pyright **0 errors / 0 warnings**. 설치 TA-Lib stub에 빠진 실제 `abstract.Function` factory는 명시적 타입 경계로 처리했다.
- Host: `pnpm -C 1-fe-host test:generative-ui -- src/shared/ui/intelligent-ui/financial-query.test.ts` → 프로젝트 전체 **60 passed**. chart/catalog 본문 정지30초 종료, 이미 취소된 요청 미전송, 실행 중 외부 취소, 성공 후 타이머·listener 정리를 확인했다. 전체 Host typecheck와 변경 파일 ESLint 통과.
- HTTP: 소유 fixture3987에서 `29-talib-evidence` Bruno **5 requests / 5 tests / 5 assertions PASS**(92ms). 실제 router·compiled graph·native library를 사용했고 model/Yahoo는 fixture이며 OpenUI validator는 stub이다. UI 또는 실제 시장 데이터의 안정성을 증명하는 검사는 아니다.
- 소유 thread는 DELETE204 후 GET404로 확인했다. 소유3987 서버와 자식 프로세스를 종료하고 listener 부재를 확인했다. 브라우저·사용자 서비스·DB를 생성하거나 재시작하지 않았다. `/tmp/talib-evidence-bruno.json` 실행 보고서는 커밋 대상이 아니다.
- 관련 stock: [기술적 분석 시스템 설계](../stock/technical-analysis/system-design.md)의 TALIB-EVIDENCE-001. 기존 사용자 변경이 있는 stock 본문은 보존하고 끝에 짧은 현재 상태만 추가했다.
