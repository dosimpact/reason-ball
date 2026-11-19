# DART API Testing 업무 설계

## DART-TESTING-001: 목적과 범위

Host `/dart-collector`는 Open DART 핵심 5개 기능을 직접 선택해 요청하고 응답을 확인하는 내부 도구다. SEC Collector의 API Testing 사용 방식을 참고하며 Agent/LLM을 거치지 않는다. 한국 DART 고유번호·접수번호와 미국 SEC CIK·accession number는 별개다.

고유번호 ZIP, 공시 검색, 공시 원문 ZIP, 기업개황, 단일회사 전체 재무제표를 제공한다. 정확한 endpoint는 [시스템 설계](system-design.md)를 따른다. 전체 85개 API 카탈로그 구현이나 DB 수집·동기화·모델링으로 범위를 확대하지 않는다.

## 수동 실행과 응답

화면 진입·API 선택만으로 외부 요청을 실행하지 않는다. 사용자가 조건을 편집한 뒤 명시적으로 전송한다. 인증키는 서버 설정에만 두며 화면이나 복사한 요청에 포함하지 않는다. HTTP 결과와 DART 본문 status를 구분하고, 조회 없음·인증/한도 오류·네트워크 실패를 성공으로 표시하지 않는다. ZIP 응답은 JSON/XML 텍스트 응답과 구분한다.

## 인수 기준

5개 경로에서 입력과 응답 형식을 확인하고, ZIP 오류 XML·DART 업무 오류·요청 중단을 구분한다. [수동 확인 절차](system-design.md#사용자-수동-확인-절차)를 따른다.
