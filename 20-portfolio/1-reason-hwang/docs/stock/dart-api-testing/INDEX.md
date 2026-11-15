# DART API Testing

한국 금융감독원 Open DART 핵심 API를 NestJS 독립 업무 모듈과 Host 수동 요청 화면으로 제공하는 도메인이다. SEC EDGAR 수집·모델링과 식별자·키·외부 호출을 분리한다.

- [업무 설계](business-design.md): 목적, 제공 기능, 수동 실행과 결과 해석.
- [시스템 설계](system-design.md): 패키지 경계, 요청 경로, 키·응답 처리와 사용자 확인 절차.
- [구현 기록](../../flow/2026-11-15-dart-api-testing-implementation.md): 구현 범위와 미검증 상태.

구현 작성은 완료했고 실행 검증은 미실행 상태다. 사용자 요청으로 테스트·typecheck·lint·build·브라우저·실제 API 호출을 실행하지 않았다.
