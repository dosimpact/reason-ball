# 2026-10-02 — push_ui_message 예제 추가

- 요구사항 UI-001: 공식 push_ui_message API를 실행 가능한 단일 예제로 학습한다.
- 근거: 공식 API 문서와 설치된 langgraph.graph.ui 구현의 signature/state 쓰기를 확인했다.
- 변경: graph-basic/47_push_ui_message.py에서 카드 생성, 동일 ID props 병합,
  AIMessage 연결, custom/values 스트림을 API 키 없이 보여준다.
- 이유: LLM 호출 없이 UI 이벤트와 reducer의 동작을 구분해 관찰할 수 있다.
- 현재 상태 문서: ../graph-basic-curriculum.md의 UI-001, README.md 실행 목록.
  기존 기준 문서 경로를 유지하며 새로운 stock 문서를 중복 생성하지 않았다.
- 등록: langgraph.json과 scripts/validate_curriculum.py에 47번을 동기화했다.
- 검증: CLI 직접 실행 성공. test_push_ui_message.py는 실제 이벤트 2개,
  최종 카드 1개, title 유지, 완료 상태, message_id 연결 및 잘못된 삭제 오류를 확인한다.
- 테스트 실행: 기본 환경에는 pytest가 없어 uv run --extra dev pytest -q를 사용했다.
- 범위: 프런트엔드 렌더러는 포함하지 않는다. task_card를 화면에 표시하려면
  해당 컴포넌트 등록과 이벤트 처리가 추가로 필요하다.
- 최종 결과: 전체 pytest 50 passed (의존성 deprecation warning 2개),
  git diff --check 통과. 실제 브라우저 렌더링은 검증 대상에 포함하지 않았다.
