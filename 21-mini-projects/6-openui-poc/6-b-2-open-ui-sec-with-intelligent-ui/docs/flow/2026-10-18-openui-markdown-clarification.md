# 2026-10-18 OpenUI 모드의 Markdown 설명 보완

- 맥락: 사용자가 Report.md의 OpenUI/Markdown 질문 항목에 순수 UI 모드만으로도 Markdown 텍스트를 충분히 표시할 수 있음을 명확히 적도록 요청했다.
- 변경: 응답의 외부 문법과 화면 표시 내용을 구분하고 일반 인사, Markdown 블록, 텍스트와 UI 조합, 원문 기호 표시의 차이를 예시와 함께 설명했다. 기존 모드 비교표도 같은 의미로 정리했다.
- 근거: frontend/src/generated/spec.json에 TextContent와 MarkDownRenderer 지원이 정의되어 있다. 실제 Document Comparison 인사 기록도 Card/TextContent 형태였음을 앞선 조사에서 확인했다.
- 검증: 해당 항목과 예시 및 Markdown 구성을 확인했다. 문서만 수정했으며 실행 코드, 프롬프트 자산, 환경변수 및 서비스 상태는 변경하지 않았다.
- stock 동기화: 시스템 설계 PY-009에 동일 개념을 반영했다.
