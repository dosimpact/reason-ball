"""Example 11: parallel fan-out workers with a reducer summary."""

from __future__ import annotations

import operator
import time
from typing import Annotated, Any, TypedDict

from langchain_core.messages import HumanMessage, SystemMessage
from langgraph.config import get_stream_writer
from langgraph.graph import END, START, StateGraph
from langgraph.types import Send

from common.llm import create_llm


class WorkerSpec(TypedDict):
    id: str
    index: int
    label: str
    item: str


class WorkerStatus(TypedDict):
    id: str
    index: int
    label: str
    item: str
    status: str
    detail: str


class WorkerResult(TypedDict):
    id: str
    index: int
    label: str
    item: str
    status: str
    result: str


class WorkerEvent(TypedDict):
    worker_id: str
    index: int
    phase: str
    status: str
    detail: str


class ParallelMapReduceState(TypedDict, total=False):
    topic: str
    items: list[WorkerSpec]
    worker_statuses: list[WorkerStatus]
    worker_results: Annotated[list[WorkerResult], operator.add]
    worker_events: Annotated[list[WorkerEvent], operator.add]
    reducer_inputs: list[WorkerResult]
    reducer_output: str
    final: str
    map_trace: Annotated[list[dict[str, Any]], operator.add]


DEFAULT_TOPIC = (
    "Evaluate a product launch plan for a LangGraph SDK learning workspace and "
    "combine market, customer, and operations findings."
)

DEFAULT_ITEMS = [
    {
        "id": "market",
        "index": 0,
        "label": "Market Worker",
        "item": "Market positioning and competitive risk",
    },
    {
        "id": "customer",
        "index": 1,
        "label": "Customer Worker",
        "item": "Customer adoption signals and onboarding risk",
    },
    {
        "id": "operations",
        "index": 2,
        "label": "Operations Worker",
        "item": "Delivery readiness, support load, and launch sequencing",
    },
]


def _extract_text(content: Any) -> str:
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts: list[str] = []
        for block in content:
            if isinstance(block, str):
                parts.append(block)
            elif isinstance(block, dict):
                text = block.get("text") or block.get("content")
                if isinstance(text, str):
                    parts.append(text)
        return "".join(parts)
    return str(content)


def _normalize_items(raw_items: Any) -> list[WorkerSpec]:
    if not isinstance(raw_items, list) or not raw_items:
        return DEFAULT_ITEMS

    normalized: list[WorkerSpec] = []
    for index, item in enumerate(raw_items[:5]):
        if isinstance(item, dict):
            label = str(item.get("label") or item.get("id") or f"Worker {index + 1}")
            body = str(item.get("item") or item.get("prompt") or label)
            worker_id = str(item.get("id") or label.lower().replace(" ", "_"))
        else:
            body = str(item)
            label = f"Worker {index + 1}"
            worker_id = f"worker_{index + 1}"
        normalized.append(
            {
                "id": worker_id,
                "index": index,
                "label": label,
                "item": body,
            }
        )
    return normalized or DEFAULT_ITEMS


def _status_for(item: WorkerSpec, status: str, detail: str) -> WorkerStatus:
    return {
        "id": item["id"],
        "index": item["index"],
        "label": item["label"],
        "item": item["item"],
        "status": status,
        "detail": detail,
    }


def prepare_items(state: ParallelMapReduceState) -> dict:
    topic = state.get("topic", DEFAULT_TOPIC)
    items = _normalize_items(state.get("items"))
    statuses = [_status_for(item, "pending", "Waiting for fan-out dispatch.") for item in items]
    return {
        "topic": topic,
        "items": items,
        "worker_statuses": statuses,
        "worker_results": [],
        "worker_events": [
            {
                "worker_id": "dispatcher",
                "index": -1,
                "phase": "prepared",
                "status": "done",
                "detail": f"Prepared {len(items)} worker inputs.",
            }
        ],
        "map_trace": [
            {
                "node": "prepare_items",
                "phase": "prepared",
                "worker_count": len(items),
                "item_ids": [item["id"] for item in items],
            }
        ],
    }


def fan_out(state: ParallelMapReduceState) -> list[Send]:
    return [Send("map_worker", {"topic": state.get("topic", DEFAULT_TOPIC), **item}) for item in state["items"]]


def map_worker(payload: dict[str, Any]) -> dict:
    writer = get_stream_writer()
    worker_id = payload["id"]
    index = int(payload["index"])
    label = payload["label"]
    item = payload["item"]
    topic = str(payload.get("topic", DEFAULT_TOPIC))
    start_event: WorkerEvent = {
        "worker_id": worker_id,
        "index": index,
        "phase": "map_worker",
        "status": "running",
        "detail": f"{label} started: {item}",
    }
    writer(start_event)
    time.sleep(0.05 * (index + 1))

    try:
        response = create_llm().invoke(
            [
                SystemMessage(
                    content=(
                        "You are one worker in a parallel map-reduce graph. Analyze only "
                        "your assigned item. Return 2 concise bullet points, each under "
                        "18 words. Do not mention hidden reasoning."
                    )
                ),
                HumanMessage(content=f"OVERALL TOPIC:\n{topic}\n\nASSIGNED ITEM:\n{item}"),
            ]
        )
        result = _extract_text(response.content).strip()
        status = "done"
        detail = "OpenAI worker result received."
    except Exception as exc:  # pragma: no cover - exercised only on provider failure
        result = f"Worker failed: {exc}"
        status = "failed"
        detail = "Worker failed but reducer can still inspect the partial result."

    done_event: WorkerEvent = {
        "worker_id": worker_id,
        "index": index,
        "phase": "map_worker",
        "status": status,
        "detail": detail,
    }
    writer(done_event)
    return {
        "worker_results": [
            {
                "id": worker_id,
                "index": index,
                "label": label,
                "item": item,
                "status": status,
                "result": result,
            }
        ],
        "worker_events": [start_event, done_event],
        "map_trace": [
            {
                "node": "map_worker",
                "worker_id": worker_id,
                "index": index,
                "status": status,
                "result_preview": result[:120],
            }
        ],
    }


def reduce_results(state: ParallelMapReduceState) -> dict:
    results = sorted(state.get("worker_results", []), key=lambda item: item["index"])
    input_lines = "\n".join(
        f"- {result['label']} ({result['status']}): {result['result']}" for result in results
    )
    if results:
        response = create_llm().invoke(
            [
                SystemMessage(
                    content=(
                        "You are the reducer in a map-reduce graph. Combine worker outputs "
                        "into one concise launch recommendation with one risk and one next action. "
                        "Keep the answer under 80 words."
                    )
                ),
                HumanMessage(
                    content=(
                        f"TOPIC:\n{state.get('topic', DEFAULT_TOPIC)}\n\n"
                        f"WORKER OUTPUTS:\n{input_lines}"
                    )
                ),
            ]
        )
        reducer_output = _extract_text(response.content).strip()
    else:
        reducer_output = "No worker results were produced."

    statuses = [
        _status_for(
            {
                "id": result["id"],
                "index": result["index"],
                "label": result["label"],
                "item": result["item"],
            },
            result["status"],
            "Included in reducer input.",
        )
        for result in results
    ]
    return {
        "worker_statuses": statuses,
        "reducer_inputs": results,
        "reducer_output": reducer_output,
        "final": f"Reducer output: {reducer_output}",
        "map_trace": [
            {
                "node": "reduce_results",
                "phase": "reduced",
                "input_count": len(results),
                "worker_ids": [result["id"] for result in results],
            }
        ],
    }


def build_graph():
    builder = StateGraph(ParallelMapReduceState)
    builder.add_node("prepare_items", prepare_items)
    builder.add_node("map_worker", map_worker)
    builder.add_node("reduce_results", reduce_results)
    builder.add_edge(START, "prepare_items")
    builder.add_conditional_edges("prepare_items", fan_out, ["map_worker"])
    builder.add_edge("map_worker", "reduce_results")
    builder.add_edge("reduce_results", END)
    return builder.compile()


graph = build_graph()


if __name__ == "__main__":
    output = graph.invoke({"topic": DEFAULT_TOPIC}, config={"recursion_limit": 30})
    print(output["final"])
