# 2026-10-25 Intelligent UI 통합 과정 문서화

- 맥락: Report.md에 OpenUI에 Intelligent UI가 추가되는 과정을 append해 달라는 요청.
- 변경: 기존 본문을 보존하고 카탈로그 교체, 라이브러리 등록, 일반/보고서 프롬프트 생성·Python 자산 동기화, 의도 라우팅, 스트림 변환, 렌더링·상태·액션, 검증 절차를 추가했다.
- 근거: frontend/src/lib/library.ts, src/library.ts, src/app/page.tsx, src/app/api/chat/route.ts, src/reporting/report-library.ts, backend-langgraph/agent/graph.py 및 기존 이관 기록을 대조했다.
- 판단: 앞선 기본 OpenUI의 Stack/openuiLibrary 설명을 역사적 설명으로 보존하고 추가 절에서 현재 Col/로컬 library 계약을 명시했다. 보고서 생성 검증과 일반 채팅의 보장 범위를 구분했다.
- 관련 stock: IUI-102에 Report.md의 통합 과정 읽기 링크를 추가했다. 제품 동작과 시스템 계약 변경은 없다.
- 검증: 문서 diff 공백 검사, 추가 문서의 로컬 링크 확인. 코드 테스트·실제 provider·브라우저 검증은 재실행하지 않았다.
