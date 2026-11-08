"""오프라인은 모델 결정만 고정한다. tools/middleware/backend는 실제 라이브러리다."""

from __future__ import annotations

import os
import sys
from pathlib import Path
from typing import Any

from dotenv import load_dotenv
from langchain_core.language_models.chat_models import BaseChatModel
from langchain_core.messages import AIMessage, BaseMessage, ToolMessage
from langchain_core.outputs import ChatGeneration, ChatResult
from pydantic import Field

ROOT = Path(__file__).resolve().parents[2]
load_dotenv(ROOT / ".env", override=False)


class ScriptedModel(BaseChatModel):
    """호출 횟수 대신 대화 속 tool round 수로 진행하므로 새 실행마다 독립적이다.

    seen은 테스트용 관찰 기록이며 판단 입력이 아니다. 멀티 tool round도 지원한다.
    도구 실패는 결과에서 확인해야 하며 고정 final 문장은 성공 증거가 아니다.
    """

    steps: list[list[dict[str, Any]]] = Field(default_factory=list)
    answer: str = "학습 실행 완료. 도구 결과와 상태를 확인하세요."
    seen: list[list[BaseMessage]] = Field(default_factory=list, exclude=True)
    bound_tools: list[str] = Field(default_factory=list, exclude=True)

    @property
    def _llm_type(self) -> str:
        return "deep-agents-scripted-learning"

    def bind_tools(self, tools: Any, **kwargs: Any):
        self.bound_tools[:] = [
            t.name if hasattr(t, "name") else t.get("name", "unknown") for t in tools
        ]
        return self

    def _generate(self, messages, stop=None, run_manager=None, **kwargs):
        self.seen.append(list(messages))
        turn = sum(isinstance(m, AIMessage) and bool(m.tool_calls) for m in messages)
        if turn < len(self.steps):
            calls = [
                {"name": c["name"], "args": c["args"], "id": f"call-{turn}-{i}"}
                for i, c in enumerate(self.steps[turn])
            ]
            message = AIMessage(content="", tool_calls=calls)
        else:
            results = [str(m.content) for m in messages if isinstance(m, ToolMessage)]
            detail = "\n".join(results)[-1200:]
            message = AIMessage(content=self.answer + ("\n" + detail if detail else ""))
        return ChatResult(generations=[ChatGeneration(message=message)])


def call(name: str, **args: Any) -> dict[str, Any]:
    return {"name": name, "args": args}


def create_model(steps=None, answer="학습 실행 완료. 도구 결과와 상태를 확인하세요."):
    if "--live" in sys.argv or os.getenv("DEEP_AGENTS_MODE", "scripted") == "live":
        from langchain_openai import ChatOpenAI

        if not os.getenv("OPENAI_API_KEY"):
            raise ValueError("실제 모델 실행에는 .env의 OPENAI_API_KEY가 필요합니다.")
        from common.llm import resolve_model

        model_id = resolve_model()
        return ChatOpenAI(
            model=model_id,
            use_responses_api=True if model_id == "gpt-6.1-terra" else None,
            timeout=60,
            max_retries=1,
        )
    return ScriptedModel(steps=steps or [], answer=answer)
