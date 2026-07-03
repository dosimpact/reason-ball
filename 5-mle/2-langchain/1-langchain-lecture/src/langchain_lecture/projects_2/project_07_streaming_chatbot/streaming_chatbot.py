"""토큰과 이벤트를 스트리밍하는 챗봇 예제입니다. 스트리밍 응답을 이벤트 단위로 생성하는 챗봇 핵심 로직입니다."""

from __future__ import annotations

from collections.abc import Generator, Iterable, Iterator, Sequence
from dataclasses import dataclass
from typing import Literal

from langchain_lecture.projects_2.project_07_streaming_chatbot.tools import (
    ToolExecutionError,
    ToolResult,
    run_tool,
)
from langchain_lecture.shared.events import AppEvent, EventType
from langchain_lecture.shared.safety import mask_pii

StreamMode = Literal["messages", "updates", "custom"]

DEFAULT_STREAM_MODES: tuple[StreamMode, ...] = ("messages", "updates", "custom")


@dataclass(frozen=True)
class ChatbotResponse:
    question: str
    answer: str
    events: tuple[AppEvent, ...] = ()
    error: str = ""


class StreamingChatbot:
    """Small offline chatbot that demonstrates LangChain-style streaming modes."""

    def invoke(self, question: str) -> ChatbotResponse:
        """Return the final answer in one object, without exposing intermediate tokens."""

        events = tuple(self.stream(question, stream_modes=()))
        error = next((event.content for event in events if event.type == EventType.ERROR), "")
        answer = _answer_from_events(events)
        return ChatbotResponse(question=question, answer=answer, events=events, error=error)

    def stream(
        self,
        question: str,
        stream_modes: Sequence[StreamMode] | StreamMode | None = None,
    ) -> Iterator[AppEvent]:
        modes = _normalize_modes(stream_modes)
        safe_question = mask_pii(question.strip())
        yield from _maybe_emit(
            AppEvent(EventType.CUSTOM, "stream started", {"mode": ",".join(modes) or "none"}),
            "custom",
            modes,
        )

        partial_answer: list[str] = []
        try:
            if _needs_tool(safe_question):
                tool_answer = yield from self._stream_tool_answer(safe_question, modes)
                partial_answer.append(tool_answer)
            else:
                partial_answer.append(_offline_answer(safe_question))

            answer = " ".join(partial_answer).strip()
            for token in _tokenize(answer):
                yield from _maybe_emit(AppEvent(EventType.TOKEN, token), "messages", modes)
            yield AppEvent(EventType.DONE, answer, {"status": "ok"})
        except (ToolExecutionError, KeyboardInterrupt) as exc:
            partial = " ".join(partial_answer).strip()
            message = f"{type(exc).__name__}: {exc}"
            if partial:
                message = f"{message} | partial={partial}"
            yield AppEvent(EventType.ERROR, message, {"partial_answer": partial})
            yield AppEvent(EventType.DONE, partial, {"status": "error"})

    def _stream_tool_answer(
        self,
        question: str,
        modes: tuple[StreamMode, ...],
    ) -> Generator[AppEvent, None, str]:
        yield from _maybe_emit(
            AppEvent(EventType.TOOL_START, "current_time", {"tool": "current_time"}),
            "updates",
            modes,
        )
        current_time = run_tool("current_time")
        yield from _tool_result_events(current_time, modes)

        yield from _maybe_emit(
            AppEvent(EventType.CUSTOM, "building plan from tool result", {"step": "plan"}),
            "custom",
            modes,
        )
        yield from _maybe_emit(
            AppEvent(EventType.TOOL_START, "daily_planner", {"tool": "daily_planner"}),
            "updates",
            modes,
        )
        planner_input = "fail" if "tool-error" in question.lower() else current_time.content
        plan = run_tool("daily_planner", planner_input)
        yield from _tool_result_events(plan, modes)
        return f"{plan.content} Streaming에서는 tool 진행 상황과 최종 답변을 분리해서 볼 수 있습니다."


def collect_stream(
    question: str,
    stream_modes: Sequence[StreamMode] | StreamMode | None = None,
    chatbot: StreamingChatbot | None = None,
) -> ChatbotResponse:
    resolved_chatbot = chatbot or StreamingChatbot()
    events = tuple(resolved_chatbot.stream(question, stream_modes=stream_modes))
    error = next((event.content for event in events if event.type == EventType.ERROR), "")
    return ChatbotResponse(
        question=question,
        answer=_answer_from_events(events),
        events=events,
        error=error,
    )


def _needs_tool(question: str) -> bool:
    lowered = question.lower()
    return any(keyword in lowered for keyword in ("현재 시간", "오늘", "time", "today", "tool-error"))


def _offline_answer(question: str) -> str:
    if "rag" in question.lower():
        return (
            "RAG 문제 해결은 입력 분석, 검색 품질 점검, 근거 압축, 답변 검증의 순서로 진행합니다. "
            "각 단계의 중간 상태를 stream event로 노출하면 긴 작업도 사용자가 따라갈 수 있습니다."
        )
    return (
        f"{question or 'LangChain streaming'}에 대한 답변입니다. "
        "invoke는 완성된 답변만 반환하지만 stream은 token, custom event, update를 즉시 전달합니다."
    )


def _tokenize(answer: str) -> Iterable[str]:
    for word in answer.split(" "):
        if word:
            yield f"{word} "


def _answer_from_events(events: Sequence[AppEvent]) -> str:
    done_events = [event for event in events if event.type == EventType.DONE]
    if done_events:
        return done_events[-1].content
    return "".join(event.content for event in events if event.type == EventType.TOKEN).strip()


def _normalize_modes(
    stream_modes: Sequence[StreamMode] | StreamMode | None,
) -> tuple[StreamMode, ...]:
    if stream_modes is None:
        return DEFAULT_STREAM_MODES
    if isinstance(stream_modes, str):
        return (stream_modes,)
    return tuple(stream_modes)


def _maybe_emit(event: AppEvent, mode: StreamMode, modes: tuple[StreamMode, ...]) -> Iterator[AppEvent]:
    if mode in modes:
        yield event


def _tool_result_events(result: ToolResult, modes: tuple[StreamMode, ...]) -> Iterator[AppEvent]:
    yield from _maybe_emit(
        AppEvent(
            EventType.TOOL_RESULT,
            result.content,
            {"tool": result.name, **result.metadata},
        ),
        "updates",
        modes,
    )
