# 13 — SummarizationMiddleware

긴 대화가 누적되면 `SummarizationMiddleware`가 **모델 호출 직전** 오래된
메시지를 요약하고 최근 메시지를 남깁니다. `create_agent`가 반환한 LangGraph
agent에 적용하며, 같은 `thread_id`로 여러 번 호출해야 대화가 누적됩니다.

이 예제의 기본 그래프는 `trigger=("tokens", 100)`, `keep=("messages", 2)`를
사용합니다. 네 번의 대화를 짧게 재현하기 위한 값입니다. 첫 세 턴에는 요약이
없고, 네 번째 턴에 요약 모델이 한 번 호출됩니다. 최종 state는 요약 메시지,
최근 두 메시지, 새 답변을 포함합니다. 실제 보존 경계는 tool call/response
쌍을 분리하지 않도록 조정될 수 있습니다.

```bash
uv sync --extra dev --frozen
uv run --frozen python graph-advanced/13_summarization_middleware/graph.py
uv run --frozen pytest test_summarization_middleware.py
```

기본 그래프의 `DemoSummaryModel`은 요약 문장을 고정 반환합니다. 이 모델은
요약 품질을 시연하지 않고, middleware의 호출 시점과 state 교체를 재현합니다.
`DemoResponseModel`도 실제 생성 모델 대신 고정 답변을 반환합니다.
`OPENAI_API_KEY`를 설정한 뒤 실제 모델로 연습하려면 `build_openai_graph()`를
사용하세요. 이 함수는 질문의 설정대로 `trigger=("tokens", 4000)`,
`keep=("messages", 20)`과 `openai:gpt-5` / `openai:gpt-5-mini`를 사용합니다.

```bash
export OPENAI_API_KEY=...
uv run --frozen python graph-advanced/13_summarization_middleware/graph.py --openai
```

같은 터미널에서 여러 질문을 입력하면 `thread_id`를 공유합니다. 요약을
확인하려면 대화가 4,000 token 임계값에 도달할 만큼 길어져야 합니다.
`stored_messages`가 줄어드는 시점이 요약이 적용된 시점입니다. 이 CLI의
체크포인트는 메모리에 저장되므로 프로세스를 종료하면 대화가 사라집니다.

Studio ID는 `advanced_13_summarization_middleware`이며, API 키 없이 작동하는
기본 그래프를 등록했습니다.

참고: [SummarizationMiddleware API](https://reference.langchain.com/python/langchain/agents/middleware/summarization/SummarizationMiddleware).
