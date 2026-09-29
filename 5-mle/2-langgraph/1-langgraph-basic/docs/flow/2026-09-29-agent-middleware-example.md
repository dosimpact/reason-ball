# 2026-09-29 Agent Middleware 예제 추가

## 맥락과 결정

기존 `graph-basic/16_create_agent.py`는 agent factory를 소개하지만 middleware가
어느 시점에 실행되는지 보여주지 않았다. 기초 과정 `01~46`의 번호를 유지하고
독립적인 고급 예제 `graph-advanced/12_agent_middleware`를 추가했다.

## 변경

- 고정된 tool call을 만드는 로컬 모델과 계산 도구로 agent/model/tool 훅 전체의
  순서를 재현한다.
- `langgraph-advanced.json`에 그래프를 등록하고 상위 및 예제 README에 실행
  방법과 학습 범위를 기록한다.
- `test_agent_middleware.py`에서 실제 agent loop의 훅 순서와 도구 결과를 검증한다.

현재 상태는 `graph-advanced/README.md`와 해당 예제 README에 반영했다.

## 검증

- `uv run --frozen python graph-advanced/12_agent_middleware/graph.py`: 훅 12개가
  예상 순서로 출력되고 답변은 `42`.
- `uv run --frozen pytest`: 44개 통과. Python 3.14의 `asyncio.iscoroutinefunction`
  사용에 관한 기존 의존성 경고 2개만 발생.
- `langgraph-advanced.json` JSON 파싱 및 `git diff --check` 통과.
