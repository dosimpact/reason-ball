# DART API Testing

한국 금융감독원 Open DART 핵심 API를 NestJS 독립 업무 모듈과 Host 수동 요청 화면으로 제공하는 도메인이다. SEC EDGAR 수집·모델링과 식별자·키·외부 호출을 분리한다.

- [업무 설계](business-design.md): 목적, 제공 기능, 수동 실행과 결과 해석.
- [시스템 설계](system-design.md): 패키지 경계, 요청 경로, 키·응답 처리와 사용자 확인 절차.

Host 타입 검사와 lint는 통과했다. 실제 DART 호출·ZIP 다운로드 및 브라우저 상호작용 검증은 미완료다.
