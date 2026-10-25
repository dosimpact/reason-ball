"""Frontend 카탈로그 parser에 HTTP로 검증을 요청합니다. 실패 시 저장하지 않습니다."""

import os

import httpx


async def validate_program(program, *, allow_artifacts=False):
    async with httpx.AsyncClient(timeout=30) as client:
        response = await client.post(
            os.getenv("DASHBOARD_FRONTEND_URL", "http://127.0.0.1:3049")
            + "/api/validate",
            json={"program": program, "allow_artifacts": allow_artifacts},
        )
        response.raise_for_status()
        result = response.json()
        if not result.get("valid"):
            raise ValueError(
                "Invalid OpenUI program: "
                + str(
                    result.get("errors")
                    or result.get("unresolved")
                    or result.get("error")
                )
            )

        return result


from langchain.agents.middleware import AgentMiddleware
from langchain.agents.middleware.types import hook_config
from langchain_core.messages import AIMessage, RemoveMessage, SystemMessage


class ResponseValidationGuard(AgentMiddleware):
    """Repair final chat programs that parse but cannot render their content."""

    def __init__(self):
        self.retries = 0

    @hook_config(can_jump_to=["model"])
    async def aafter_model(self, state, runtime):
        message = state["messages"][-1]
        if message.type != "ai" or message.tool_calls:
            return None
        content = message.content
        if isinstance(content, list):
            content = "".join(
                block.get("text", "")
                for block in content
                if isinstance(block, dict) and block.get("type") == "text"
            )
        try:
            result = await validate_program(content, allow_artifacts=True)
            from agent.dashboard.execution import successful_calls

            required = {
                outcome["artifact_id"]
                for call, outcome in successful_calls(state["messages"])
                if call["name"] in {"publish_ui_panel", "publish_financial_chart"}
                and outcome.get(
                    "destination", call["args"].get("destination") or "chat"
                )
                == "chat"
                and outcome.get("artifact_id")
            }
            missing = required - set((result or {}).get("artifact_ids", []))
            if missing:
                raise ValueError(
                    "Render these published chat artifacts inside root using DashboardArtifact(id), instead of duplicating their raw UI: "
                    + ", ".join(sorted(missing))
                )
            return None
        except (ValueError, httpx.HTTPError) as exc:
            if self.retries >= 2:
                return {
                    "messages": [
                        AIMessage(
                            id=message.id,
                            content='root = Card([Callout("warning", "답변 표시 미완료", "답변 화면을 구성하지 못했습니다. 저장된 자료는 유지됩니다. 다시 요청해 주세요.")])',
                        )
                    ]
                }
            self.retries += 1
            return {
                "messages": [
                    RemoveMessage(id=message.id),
                    SystemMessage(
                        content="Repair ONLY the final OpenUI response; do not repeat tools or change saved panels. Validation: "
                        + str(exc)[:2000]
                        + ". Use valid Card visual children. SectionItem must be inside SectionBlock; Series only inside its chart. Keep retrieved facts and exact source URLs."
                    ),
                ],
                "jump_to": "model",
            }
