# 2026-09-29 TodoListMiddleware 예제 확장

## 맥락과 결정

기존 `12_agent_middleware`는 custom lifecycle 훅을 보여줬다. 기본 제공
middleware가 도구와 state를 agent에 추가하는 예도 같은 디렉터리에 독립적인
`todo_graph`로 더했다. 기존 `graph`의 출력과 Studio ID는 유지한다.

## 변경

- `TodoListMiddleware()`와 `LifecycleMiddleware`를 함께 사용한다.
- 결정론적 모델이 `write_todos` → `multiply` → `write_todos` 순서로 호출해
  todo 목록 생성과 전체 교체를 재현한다.
- Studio 그래프 ID `advanced_12_todo_list_middleware`와 상태 검증 테스트를 추가한다.
- 현재 학습 범위와 실행 방법은 예제 및 상위 README에 반영한다.

## 검증

- 예제 스크립트 실행: 기존 lifecycle 순서를 유지하고, todo graph에서
  `write_todos` → `multiply` → `write_todos` 호출 후 두 항목이 `completed`.
- `uv run --frozen pytest`: 46개 통과. 기존 Python 3.14 의존성 경고 2개.
- `test_agent_middleware.py`: 상태 교체와 한 모델 응답의 중복 `write_todos`
  호출 거절을 검증.
- `langgraph-advanced.json` JSON 파싱과 `git diff --check` 통과.
