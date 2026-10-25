# 2026-10-25 등록 함수 디버깅 로그

- 맥락: 사용자가 등록된 모든 fn의 실행을 console.log로 확인하도록 요청했다.
- 변경: functions/debug.ts의 defineDebugFunction이 기존 defineFunction을 감싸고, 6개 함수 모듈의 59개 정의에서 사용한다. 함수 이름·입력·결과·오류를 로그로 기록한다.
- 판단: 원래 fn은 한 번만 호출하고 결과를 그대로 반환한다. 예외는 기록 후 다시 던져 기존 런타임 처리를 유지한다. 함수 계약과 프롬프트는 바꾸지 않는다.
- 관련 stock: system.md IUI-104에 로그의 위치와 범위를 명시한다. 기존 사용자 수정과 다른 프로젝트는 보존한다.
- 검증: 프런트엔드 타입 검사와 기존 함수 테스트를 실행한다. 결과는 아래에 기록한다.
- 검증 결과: npm run typecheck PASS, 기존 함수 테스트 4 files / 271 tests PASS, 변경 함수 모듈과 debug.ts의 ESLint PASS. 브라우저 UI와 실제 provider 호출은 재실행하지 않았다.
