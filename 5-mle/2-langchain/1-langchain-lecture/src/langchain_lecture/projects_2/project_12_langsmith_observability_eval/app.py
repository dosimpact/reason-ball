"""LangSmith 관측성과 평가 루프를 함께 다루는 예제입니다. 콘솔에서 바로 실행할 수 있는 예제 진입점입니다."""

from __future__ import annotations

import os
from collections.abc import Callable, Mapping
from dataclasses import dataclass
from time import perf_counter
from typing import Any
from uuid import uuid4

from langchain_core.documents import Document

from langchain_lecture.shared.documents import build_document, rank_documents


@dataclass(frozen=True)
class LangSmithEnvironment:
    tracing_enabled: bool
    api_key_present: bool
    project: str
    endpoint: str
    usable: bool
    reason: str


@dataclass(frozen=True)
class TraceEvent:
    name: str
    inputs: dict[str, Any]
    outputs: dict[str, Any]
    metadata: dict[str, Any]
    latency_ms: float


@dataclass(frozen=True)
class ObservedAnswer:
    question: str
    answer: str
    sources: list[str]
    trace_id: str
    events: list[TraceEvent]
    langsmith: LangSmithEnvironment
    latency_ms: float


class LocalTraceRecorder:
    def __init__(self, trace_id: str | None = None) -> None:
        self.trace_id = trace_id or f"local-{uuid4().hex[:12]}"
        self._events: list[TraceEvent] = []

    @property
    def events(self) -> list[TraceEvent]:
        return list(self._events)

    def record(
        self,
        name: str,
        inputs: dict[str, Any],
        operation: Callable[[], dict[str, Any]],
        *,
        metadata: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        start = perf_counter()
        outputs = operation()
        latency_ms = (perf_counter() - start) * 1000
        self._events.append(
            TraceEvent(
                name=name,
                inputs=inputs,
                outputs=outputs,
                metadata=metadata or {},
                latency_ms=latency_ms,
            )
        )
        return outputs


OBSERVABILITY_DOCS: list[Document] = [
    build_document(
        "LangSmith observability captures traces for chains, model calls, tools, "
        "retrievers, inputs, outputs, latency, and token metadata.",
        source="observability.md",
        topic="trace",
    ),
    build_document(
        "A LangSmith dataset stores repeatable inputs with reference outputs so "
        "the same application can be evaluated after prompt, model, or retrieval changes.",
        source="datasets.md",
        topic="dataset",
    ),
    build_document(
        "Rule-based evaluators can check required sources, answer format, latency "
        "budgets, tool success, and simple reference keyword coverage.",
        source="evaluators.md",
        topic="evaluator",
    ),
    build_document(
        "Experiments run an application over a dataset and compare aggregate scores, "
        "pass rates, and case-level regressions between versions.",
        source="experiments.md",
        topic="experiment",
    ),
    build_document(
        "LangSmith failed runs should be analyzed with failed run analysis that "
        "classifies failures by prompt, retrieval, model, tool, format, or latency "
        "cause so the next fix is targeted.",
        source="failure-analysis.md",
        topic="debug",
    ),
]


def detect_langsmith_environment(env: Mapping[str, str] | None = None) -> LangSmithEnvironment:
    values = env if env is not None else os.environ
    tracing_value = values.get("LANGSMITH_TRACING") or values.get("LANGCHAIN_TRACING_V2") or ""
    tracing_enabled = tracing_value.lower() in {"1", "true", "yes", "on"}
    api_key_present = bool(values.get("LANGSMITH_API_KEY"))
    project = values.get("LANGSMITH_PROJECT") or values.get("LANGCHAIN_PROJECT") or "langchain-projects-2"
    endpoint = values.get("LANGSMITH_ENDPOINT", "https://api.smith.langchain.com")

    if tracing_enabled and api_key_present:
        return LangSmithEnvironment(
            tracing_enabled=True,
            api_key_present=True,
            project=project,
            endpoint=endpoint,
            usable=True,
            reason="LangSmith tracing environment is configured.",
        )
    if tracing_enabled:
        reason = "Tracing is enabled but LANGSMITH_API_KEY is missing; using local trace recorder."
    else:
        reason = "LangSmith tracing is disabled; using local trace recorder."
    return LangSmithEnvironment(
        tracing_enabled=tracing_enabled,
        api_key_present=api_key_present,
        project=project,
        endpoint=endpoint,
        usable=False,
        reason=reason,
    )


def retrieve_context(question: str, *, top_k: int = 2) -> list[Document]:
    ranked = rank_documents(question, OBSERVABILITY_DOCS, top_k=top_k)
    return [item.document for item in ranked]


def _source_names(documents: list[Document]) -> list[str]:
    return [str(document.metadata.get("source", "unknown")) for document in documents]


def _first_sentence(text: str) -> str:
    return text.split(".", 1)[0].strip() + "."


def compose_answer(question: str, documents: list[Document], *, prompt_variant: str = "baseline") -> str:
    if not documents:
        return "I do not have enough local context to answer. Sources: []"

    if prompt_variant == "weak":
        return "LangSmith helps teams inspect and evaluate LLM applications."

    evidence = " ".join(_first_sentence(document.page_content) for document in documents)
    sources = ", ".join(_source_names(documents))
    return f"{evidence} Sources: {sources}"


def answer_question(question: str, *, prompt_variant: str = "baseline", top_k: int = 2) -> ObservedAnswer:
    langsmith = detect_langsmith_environment()
    recorder = LocalTraceRecorder()
    start = perf_counter()

    retrieval_outputs = recorder.record(
        "retriever",
        {"question": question, "top_k": top_k},
        lambda: {
            "documents": [
                {
                    "page_content": document.page_content,
                    "source": document.metadata.get("source"),
                    "topic": document.metadata.get("topic"),
                }
                for document in retrieve_context(question, top_k=top_k)
            ]
        },
        metadata={"kind": "local_keyword_retriever"},
    )
    documents = [
        build_document(
            str(item["page_content"]),
            source=str(item["source"]),
            topic=str(item.get("topic", "")),
        )
        for item in retrieval_outputs["documents"]
    ]

    generation_outputs = recorder.record(
        "answer_chain",
        {
            "question": question,
            "sources": _source_names(documents),
            "prompt_variant": prompt_variant,
        },
        lambda: {"answer": compose_answer(question, documents, prompt_variant=prompt_variant)},
        metadata={"kind": "deterministic_local_chain"},
    )

    latency_ms = (perf_counter() - start) * 1000
    return ObservedAnswer(
        question=question,
        answer=str(generation_outputs["answer"]),
        sources=_source_names(documents),
        trace_id=recorder.trace_id,
        events=recorder.events,
        langsmith=langsmith,
        latency_ms=latency_ms,
    )


# 예제 실행 진입점입니다.
def main() -> None:
    from langchain_lecture.projects_2.project_12_langsmith_observability_eval.run_eval import (
        analyze_failed_runs,
        compare_experiments,
        run_experiment,
    )

    observed = answer_question("How should failed LangSmith runs be analyzed?")
    print(observed.answer)
    print(f"trace_id={observed.trace_id} langsmith_usable={observed.langsmith.usable}")

    baseline = run_experiment("baseline")
    weak = run_experiment("weak-prompt", prompt_variant="weak")
    comparison = compare_experiments(baseline, weak)
    print(f"baseline score={baseline.average_score:.2f} weak score={weak.average_score:.2f}")
    print(f"regressions={comparison.regressions}")
    for failed in analyze_failed_runs(weak):
        print(f"{failed.case_id}: {failed.category}")


if __name__ == "__main__":
    main()
