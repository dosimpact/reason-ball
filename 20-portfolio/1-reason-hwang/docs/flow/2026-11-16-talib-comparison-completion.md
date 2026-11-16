# TALIB-COMPARE-001: TA-Lib 일봉·주봉 비교 완료 보강

- 날짜: 2026-11-16
- 배경: 사용자 회귀 보고서에서 AAPL 일봉 RSI/SMA만 계산한 뒤 주봉 계산을 예고하고 최종 종료한 사례가 확인됐다. 보고서와 증거는 읽기 전용으로 보존했다.
- 원인: 업무 에이전트 한 번 실행 뒤 무조건 출력 단계로 이동했다. 가격 데이터도 ticker 하나를 키로 사용하여 주봉 조회가 일봉 데이터와 의존 결과를 교체할 수 있었다.
- 변경: 주기별 canonical dataset 키와 기존 ticker 별칭을 함께 유지하고, 계산 의존 참조는 canonical 키로 고정한다. 명시적인 일봉·주봉 계산/비교 요청에만 제한된 완료 검사를 적용하고 누락 시 한 번 보완한다. 실제 데이터 실패는 반복하지 않으며 미완료를 명시한다.
- 설명 정합: 실제 출력 선택형 단일 시리즈 UI와 전체 계산 이력의 lookback 범위를 시스템 지침에 명시하고, 요약에 origin·입력 metadata를 포함한다. 별칭 때문에 중복 표시되던 출처는 종목·주기로 묶는다.
- 영향 stock: [기술적 분석 시스템 설계의 TALIB-COMPARE-001](../stock/technical-analysis/system-design.md#talib-compare-001-일봉주봉-비교-완료와-데이터-보존).
- 검증: 단위 회귀와 scoped 정적 검사를 실행했다. 최종 검사 수와 HTTP 검증은 아래 후속 기록으로 남긴다. 브라우저 검증은 사용자 지시에 따라 실행하지 않았다. 실제 모델/Yahoo 응답의 반복 안정성을 단위 fixture 통과만으로 주장하지 않는다.

## 구현 단위·정적 검증

- `uv run pytest tests/test_talib_comparison.py tests/test_talib_agent_graph.py -q`: **14 passed**. 원문 시작 질문의 `RSI14`/`SMA20` 표기, 두 주기 결과 동시 보존, 누락 시 한 번 보완, 계속 누락될 때 미완료 표시, 실제 조회 실패 재시도 금지, 다른 주기 갱신·실패 후 기존 결과 보존을 확인했다.
- 변경된 `completion.py`, `workflow.py`, `tools.py`, `presentation.py`, 신규 회귀 테스트의 scoped Ruff 통과. 해당 Python 구현 파일의 Pyright는 **0 errors / 0 warnings**, `git diff --check` 통과.
- HTTP fixture 검증은 별도 QA가 수행하며 아래에 결과를 추가한다. 이 단위 검사에서는 실제 모델·Yahoo·브라우저를 호출하지 않았다. 이 작업이 생성한 서버·브라우저·DB 자원은 없다.
- 기존 사용자 변경이 있던 `system-design.md`의 본문을 보존하고 `TALIB-COMPARE-001`만 끝에 추가했다. 해당 혼합 문서는 이번 커밋 범위에서 제외한다는 root 결정에 따라 현재 상태 근거도 이 flow에 함께 남긴다.

## 추가 HTTP 통합 증거

2026-11-16 Bruno 28-talib-comparison-regression: 6 requests/6 tests/6 assertions PASS(856ms). 실제 routers/RunManager/compiled graph를 통해 일봉·주봉4개결과와 두 canonical datasets, RSI14/SMA20, 보완호출1회(총2회), state 보존, SystemMessage 비노출, 실제 Host parser valid=true, thread삭제204를 확인했다. ComparisonAgent·고정 OHLC fixture이며 외부 모델/Yahoo0이다. workflow validator는 fake이지만 별도 HTTP 실제 parser 검증은 통과했다. 소유3981/3194 서버와 Next 임시 dist/config 참조를 정리했고 listener잔존없음 확인. 결과 /tmp/talib-comparison-http-final.json은 커밋하지 않는다.
