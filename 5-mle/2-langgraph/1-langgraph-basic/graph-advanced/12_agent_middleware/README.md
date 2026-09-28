# 12 — Agent Middleware lifecycle

`graph-basic/16_create_agent.py`에서 만든 agent에 custom middleware를 붙여
agent, model, tool 경계의 호출 순서를 관찰합니다. `create_agent`는 LangGraph
그래프를 반환하며 middleware는 그 내부 agent loop에서 실행됩니다.

`LifecycleMiddleware`의 node-style 훅은 `before_agent`, `before_model`,
`after_model`, `after_agent`입니다. wrap-style 훅은 `wrap_model_call`,
`wrap_tool_call`이며 `handler(request)`의 앞뒤를 감쌉니다. 도구를 쓰는
질문에서는 model이 두 번 호출되므로 model 훅도 두 번 실행됩니다.

```bash
uv sync --extra dev --frozen
uv run --frozen python graph-advanced/12_agent_middleware/graph.py
uv run --frozen pytest test_agent_middleware.py
```

예제 모델은 항상 `multiply(6, 7)`을 한 번 요청하고 도구 결과를 답변에
사용합니다. OpenAI 키나 외부 서비스가 필요 없습니다. 출력은 아래 순서입니다.

```text
before_agent
before_model
wrap_model_call:before
wrap_model_call:after
after_model
wrap_tool_call:before:multiply
wrap_tool_call:after:multiply
before_model
wrap_model_call:before
wrap_model_call:after
after_model
after_agent
answer: 계산 결과는 42입니다.
```

LangGraph Studio에서는 `langgraph-advanced.json`의
`advanced_12_agent_middleware` 그래프로 등록되어 있습니다. ScriptedModel은
호출마다 같은 계산을 선택하므로 이 예제는 실제 LLM의 도구 선택 능력을
검증하는 용도가 아닙니다.

참고: [LangChain middleware overview](https://docs.langchain.com/oss/python/langchain/middleware/overview),
[custom middleware hooks](https://docs.langchain.com/oss/python/langchain/middleware/custom).
