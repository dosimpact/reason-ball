# 전체 네이티브 TA-Lib 에이전트

- 날짜: 2026-11-16
- 결정: TALIB-AGENT-001. 승인된 구현 계획에 따라 기존 TA20/Canvas와 분리된 `/talib-chat`와 `talib_agent`를 추가했다.
- 관련 stock: [비즈니스](../stock/technical-analysis/business-design.md#talib-agent-001-전체-함수-탐색과-자유-계산), [시스템](../stock/technical-analysis/system-design.md#talib-agent-001-전체-네이티브-ta-lib-에이전트), [문서 지도](../stock/technical-analysis/INDEX.md).
- 현재 상태: 구현·회귀·API 검증 및 자원 정리 완료. 브라우저는 사용자 요청으로 제외했다.

## 변경과 이유

Python/native TA-Lib 0.8.3과 실제 237종 카탈로그를 사용한다. 기존 인프라 패키지 아래 native adapter를
두고 도메인 facade, 독립 그래프, 기존 Host native chat을 연결했다. 기존 TA20·Canvas는 유지한다.
카탈로그 탐색/함수 설명/OHLCV 조회/자유 batch 실행 네 도구를 제공한다. 함수 이름·입력 키·파라미터를
실제 메타데이터에서 찾고 수학/통계/패턴과 명시적 상수·사용자 배열·여러 데이터셋·이전 출력의 조합을
지원한다. 설치되지 않은 7개 함수는 지원한다고 표시하거나 대체하지 않는다.

외부 MessagesState와 내부 DeepAgentState를 명시적으로 변환하고 add_messages ID를 보존한다.
배열은 상태에 두고 도구 메시지는 요약만 모델로 전달한다. private files/todos는 외부로 보내지 않는다.
가격 갱신의 의존성 무효화, 실제 파라미터 lookback 기반 추가 이력, 마지막 봉 null/과거 유효 날짜,
정수·인덱스 출력과 표시 shift의 의미를 구분한다. 매 턴 새 결과 ID와 UI를 초기화하며 설명만 하는
후속 질문에 이전 차트가 다시 노출되지 않게 한다. 생산 모델은 parallel_tool_calls=false를 사용한다.

수치는 서버가 계산하고 결정적인 OpenUI 표와 선택형 상세 차트로 보여준다. indexed member와 Select
프로그램은 실제 Host parser/catalog로 확인했다. 출력이 많으면 표시 봉 수를 명시적으로 제한하되
모든 출력 선택과 상태 배열은 보존한다. 검증 실패/표시 크기 초과는 답변·계산 결과를 버리지 않는다.

## 검증

- `pnpm -C 3-langgraph-fast test:talib-agent`: engine 250개, graph 8개로 258개 PASS. warmup provider 오류도 tool 오류로 처리하고 graph 실행을 버리지 않음을 확인했다.
- native 237개 함수의 모든 출력과 동일 입력 native 호출을 1e-12 tolerance로 비교했다. 날짜 교집합,
  상수/사용자 배열/이전 출력, MAVP 기간 배열, 개별 오류, NaN/null, 정수/인덱스/shift, 입력 불변성을 확인했다.
- 기존 TA20·기존 graph·chart·인프라·가격/cache·thread API 91개 회귀 PASS. 아키텍처 검사 PASS로
  native import가 기존 인프라 경계를 벗어나지 않음을 확인했다. 중복 실행을 합산하지 않는다.
- graph 검사는 messages-only input schema, 명시적 adapter ID/비공개 필드 격리, persistence 기반
  다중 턴·새 thread 격리, 실제 도구/엔진 chaining, SMA800의 lookback799+표시120+1=920봉 추가 조회,
  독립 티커 보존과 의존성 무효화, 요청 ID 생략, oversized UI fallback을 확인했다.
- 실제 HTTP+Bruno는 최종 worker에서 10개 요청/11개 tests/10개 assertions PASS. schema, thread,
  다중 턴, 전체 state, 설명 턴 stale UI 방지, 새 thread 격리를 실제 그래프·도구·엔진·Host parser로 확인했다.
- 실제 설정 모델+Yahoo+Host validator smoke PASS: AAPL 120개 완료 일봉(2026-05-27~11-13),
  RSI14=60.8973, SMA20=345.9147, 두 계산 성공과 presentation 반환을 확인했다. 이 실행은 초기
  count120 조회 구현 시점의 증거이며 최종 warmup600 동작은 별도 도구 회귀에서 검증했다.
- Host typecheck PASS. Ruff는 변경 graph/테스트 범위 PASS. 브라우저를 열거나 Storybook을 실행하지 않았다. 사용자 명시
  제외 범위이며 HTTP/API·parser 검증을 사용자 브라우저 검증 통과로 표현하지 않는다.

## 자원·한계

최종 HTTP 검증의 소유 PID 57426/57427은 종료했고 포트 32984/32985는 해제했다. 생성 thread도
삭제했다. 기존 사용자/공유 서버를 종료하지 않았고 브라우저 자원은 생성하지 않았다.

OHLCV는 Yahoo의 수정 완료 봉이며 장중 실시간 데이터가 아니다. 누적 함수는 조회 window origin의
영향을 받을 수 있어 메타데이터와 경고로 남긴다. 모든 출력은 상태에 보존하지만 inline 표시량과 DSL
크기는 제한된다. 정수 패턴은 확률이 아니며 계산 성공이 매매 정확도를 보장하지 않는다. Native parity는
라이브러리 재현성을 검증하며 투자 성과를 검증하지 않는다. human-docs와 관련 없는 사용자 변경은 유지했다.
