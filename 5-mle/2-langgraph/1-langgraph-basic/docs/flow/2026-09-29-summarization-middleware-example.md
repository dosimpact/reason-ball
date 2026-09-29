# 2026-09-29 SummarizationMiddleware 예제

## 맥락과 결정

Agent middleware 학습에 긴 대화의 자동 요약을 추가한다. 기존 `12`번 예제의
lifecycle·TodoListMiddleware 내용은 유지하고, 별도 `13`번 예제로 구성한다.
결정론적 모델로 요약 발동과 최근 메시지 보존을 확인하며, 같은 파일에 실모델
설정(`4000 tokens`, 최근 `20`개 메시지)을 제공한다.

## 변경

- `InMemorySaver`와 동일 `thread_id`로 여러 턴의 대화를 누적한다.
- `SummarizationMiddleware`의 token trigger와 message keep 동작을 검증한다.
- Studio ID `advanced_13_summarization_middleware`를 등록하고 상위/예제
  README에 실행 방법과 로컬 모델의 한계를 기록한다.

## 검증

- 로컬 예제 실행: 요약 호출 수 `0, 0, 0, 1`, 저장 메시지 수 `2, 4, 6, 4`.
- `uv run --frozen pytest`: 48개 통과. 기존 Python 3.14 의존성 경고 2개.
- `langgraph-advanced.json` JSON 파싱과 `git diff --check` 통과.
- `--openai` 경로는 API 키를 사용하는 선택 실행 경로이며 이번 검증에는
  포함하지 않았다.
