# TA-Lib 시작 질문 그룹화

- 날짜: 2026-11-16
- 요구: 기능 범위에 맞춰 시작 질문을 늘리고 그룹으로 탐색한다.
- 변경: TALIB-STARTERS-001. 8개 주제 × 4개 질문으로 32개 예시를 추가하고 첫 그룹을 펼치는 접이식 목록을 제공한다. 전용 채팅의 중복 제목을 제거한다.
- 근거: 기존 두 질문으로는 237개 함수와 다양한 입력·분석 목적을 발견하기 어려웠다.
- stock: [시스템 설계](../stock/technical-analysis/system-design.md#talib-starters-001-주제별-시작-질문).
- 검증: Host typecheck 및 변경 범위 ESLint PASS. 설치된 TA-Lib에서 예시에 포함한 신규 함수 VWAP·VWMA·ROGERSSATCHELL·SQZMOM·KVO 지원을 확인했다. 브라우저·Storybook 실행은 기존 사용자 요청에 따라 제외한다. API 변경은 없다.
