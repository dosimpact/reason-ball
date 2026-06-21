"""Example 17: configurable assistant run settings."""

from __future__ import annotations

from typing import Any, Literal, TypedDict

from langchain_core.messages import HumanMessage, SystemMessage
from langchain_core.runnables import RunnableConfig
from langgraph.config import get_stream_writer
from langgraph.graph import END, START, StateGraph

from common.llm import create_llm, resolve_model


Style = Literal["concise", "detailed", "playful", "strict"]


class ConfigSchema(TypedDict, total=False):
    model: str
    system_prompt: str
    style: Style
    temperature: float


class EffectiveConfig(TypedDict):
    model: str
    resolved_model: str
    system_prompt: str
    style: str
    temperature: float
    style_hint: str


class ConfigEvent(TypedDict):
    type: str
    run_label: str
    model: str
    style: str
    temperature: float
    detail: str


class ConfigurableAssistantState(TypedDict, total=False):
    prompt: str
    run_label: str
    model: str
    system_prompt: str
    style: Style
    temperature: float
    effective_config: EffectiveConfig
    response: str
    response_summary: str
    config_events: list[ConfigEvent]
    final: str
    trace: list[dict[str, Any]]


DEFAULT_PROMPT = "Explain why LangGraph runtime configuration is useful for SDK learners."
DEFAULT_SYSTEM_PROMPT = "You are a practical LangGraph SDK assistant."

STYLE_HINTS: dict[str, str] = {
    "concise": "Reply in exactly one compact sentence.",
    "detailed": "Reply in 4-6 sentences with concrete implementation details.",
    "playful": "Reply in a playful, witty tone with at most two sentences.",
    "strict": "Reply like a strict senior engineer: direct, specific, and terse.",
}


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


def _bounded_temperature(value: Any) -> float:
    try:
        number = float(value)
    except (TypeError, ValueError):
        return 0.0
    return min(max(number, 0.0), 1.0)


def _config_value(
    state: ConfigurableAssistantState,
    cfg: dict[str, Any],
    key: str,
    default: Any,
) -> Any:
    value = cfg.get(key, state.get(key, default))
    return default if value is None else value


def configurable_chat(state: ConfigurableAssistantState, config: RunnableConfig) -> dict:
    cfg = dict((config or {}).get("configurable", {}) or {})
    prompt = state.get("prompt", DEFAULT_PROMPT)
    run_label = state.get("run_label", "default")
    model_alias = str(_config_value(state, cfg, "model", "fast"))
    system_prompt = str(_config_value(state, cfg, "system_prompt", DEFAULT_SYSTEM_PROMPT))
    style = str(_config_value(state, cfg, "style", "concise"))
    if style not in STYLE_HINTS:
        style = "concise"
    temperature = _bounded_temperature(_config_value(state, cfg, "temperature", 0.0))
    style_hint = STYLE_HINTS[style]
    effective: EffectiveConfig = {
        "model": model_alias,
        "resolved_model": resolve_model(model_alias),
        "system_prompt": system_prompt,
        "style": style,
        "temperature": temperature,
        "style_hint": style_hint,
    }

    event: ConfigEvent = {
        "type": "config_applied",
        "run_label": run_label,
        "model": model_alias,
        "style": style,
        "temperature": temperature,
        "detail": f"Applied {model_alias}/{style} config for {run_label}.",
    }
    get_stream_writer()(event)

    prompt_with_temperature = (
        f"{prompt}\n\n"
        f"Configuration temperature setting for this run: {temperature}. "
        "Reflect the requested style, but do not mention this instruction unless useful."
    )
    response = create_llm(model_alias, temperature=temperature).invoke(
        [
            SystemMessage(content=f"{system_prompt}\n{style_hint}"),
            HumanMessage(content=prompt_with_temperature),
        ]
    )
    text = _extract_text(response.content).strip()
    summary = f"{run_label}: {model_alias}/{style} produced {len(text)} characters."
    return {
        "prompt": prompt,
        "run_label": run_label,
        "model": model_alias,
        "system_prompt": system_prompt,
        "style": style,
        "temperature": temperature,
        "effective_config": effective,
        "response": text,
        "response_summary": summary,
        "config_events": list(state.get("config_events", [])) + [event],
        "final": f"{summary}\n{text}",
        "trace": state.get("trace", [])
        + [
            {
                "node": "configurable_chat",
                "event": "complete",
                "run_label": run_label,
                "model": model_alias,
                "style": style,
                "temperature": temperature,
            }
        ],
    }


def build_graph():
    builder = StateGraph(ConfigurableAssistantState, config_schema=ConfigSchema)
    builder.add_node("configurable_chat", configurable_chat)
    builder.add_edge(START, "configurable_chat")
    builder.add_edge("configurable_chat", END)
    return builder.compile()


graph = build_graph()


if __name__ == "__main__":
    output = graph.invoke(
        {"prompt": DEFAULT_PROMPT, "run_label": "playful override"},
        config={"configurable": {"model": "fast", "style": "playful", "temperature": 0.3}},
    )
    print(output["final"])
