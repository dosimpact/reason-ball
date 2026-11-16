# 모델링 변경 작업 버튼 색상 — 2026-11-16

사용자 요청으로 모델링 1·2·3 실행, 실행 취소, 실패 작업 재시도에 기존 파란색 primary 토큰을 적용했다. hover·disabled 스타일과 기존 실행 조건을 유지한다. 현재 설계는 [SEC 모델링](../stock/us-corporate-filings/sec-modeling.md)에 반영했다. 기존 사용자 API 중심 검증 예외를 유지해 Storybook·브라우저는 실행하지 않는다.

검증: 모델링 단위 12/12 PASS, 변경 파일 ESLint PASS, diff whitespace 검사 PASS. 새 서버·브라우저 자원 없음.
