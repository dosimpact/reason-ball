"""Actual HTTP routers/graph/tools/engine; only paid model and Yahoo data are deterministic."""

import asyncio
from contextlib import asynccontextmanager
from datetime import date, timedelta
from types import SimpleNamespace

from fastapi import FastAPI
from langchain_core.messages import AIMessage, ToolMessage
from langgraph.checkpoint.memory import InMemorySaver

from server.assistants import router as assistants_router
from server.assistants.repository import InMemoryAssistantRepository
from server.assistants.router import configure_graph_registry, set_assistant_repository
from server.graph_registry import GraphRegistry
from server.run_manager import RunManager
from server.runs import router as runs_router
from server.runs import runtime
from server.streaming import router as streaming_router
from server.threads import router as threads_router


def prices(ticker, interval, count, adjusted):
    return SimpleNamespace(
        prices=[
            SimpleNamespace(
                trading_date=date(2025, 1, 1) + timedelta(days=i),
                open=100 + i * 0.3,
                high=103 + i * 0.3,
                low=99 + i * 0.3,
                close=101 + i * 0.3 + (i % 3),
                volume=1000 + i,
                is_partial=False,
                fetched_at=None,
                currency="USD",
            )
            for i in range(count)
        ]
    )


class ScriptedAgent:
    async def ainvoke(self, state):
        from graph.primary_graphs.talib_agent.tools import build_tools

        if "slow fixture" in str(state["messages"][-1].content):
            await asyncio.sleep(30)
        tools = {t.name: t for t in build_tools(fetcher=prices)}
        local = dict(state)
        messages = []
        second = len([m for m in state["messages"] if m.type == "human"]) > 1
        calls = []
        if not second:
            calls.extend(
                [
                    ("list_talib_functions", {}),
                    ("describe_talib_function", {"name": "RSI"}),
                ]
            )
            calls.append(("get_price_ohlcv", {"ticker": "AAPL", "count": 60}))
        function = "SMA" if second else "RSI"
        calls.append(
            (
                "run_talib_functions",
                {
                    "requests": [
                        {
                            "id": function.lower(),
                            "function": function,
                            "parameters": {"timeperiod": 20 if second else 14},
                            "inputs": {"price": {"dataset": "AAPL", "field": "close"}},
                        }
                    ]
                },
            )
        )
        updates = {}
        for index, (name, args) in enumerate(calls):
            call_id = f"fixture-{second}-{index}"
            messages.append(
                AIMessage(
                    content="", tool_calls=[{"name": name, "args": args, "id": call_id}]
                )
            )
            response = tools[name].invoke(
                {
                    "type": "tool_call",
                    "id": call_id,
                    "name": name,
                    "args": {**args, "state": local},
                }
            )
            if isinstance(response, ToolMessage):
                messages.append(response)
                continue
            for key, value in response.update.items():
                if key == "messages":
                    messages.extend(value)
                else:
                    local[key] = value
                    updates[key] = value
        return {
            **updates,
            "messages": [
                *messages,
                AIMessage(content=f"AAPL {function} 계산을 완료했습니다."),
            ],
        }


async def fixed_followups(*args):
    return {"followUps": ["같은 종목의 SMA20도 분석해 줘."], "followUpsStatus": "ready"}


@asynccontextmanager
async def lifespan(app):
    from graph.primary_graphs.talib_agent.workflow import build_talib_agent

    runtime.reset()
    repository = InMemoryAssistantRepository()
    set_assistant_repository(repository)
    exported = build_talib_agent(
        agent=ScriptedAgent(), fetcher=prices, followups=fixed_followups
    )
    graph = exported.builder.compile(checkpointer=InMemorySaver())
    registry = GraphRegistry(graphs={"talib_agent": graph, "fixture_other_graph": graph})
    configure_graph_registry(registry.schemas())
    await registry.seed(repository)
    runtime.manager = RunManager(runtime, registry)
    try:
        yield
    finally:
        await runtime.manager.close()
        runtime.manager = None
        runtime.reset()


app = FastAPI(lifespan=lifespan)
for router in (assistants_router, threads_router, runs_router, streaming_router):
    app.include_router(router)
