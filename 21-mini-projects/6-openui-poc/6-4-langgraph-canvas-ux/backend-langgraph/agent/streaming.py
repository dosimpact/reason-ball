# LangGraph의 모델·도구 이벤트를 OpenUI가 읽는 AG-UI 이벤트로 변환합니다.
# 메시지별 상태를 추적해 텍스트와 도구 인자를 이어 붙이고, 종료·결과의 중복 전송을 막습니다.
"""Project Python protocol events onto the existing custom:openui AG-UI channel."""

import json
from dataclasses import asdict, is_dataclass
from uuid import uuid4

from langgraph.stream import StreamChannel, StreamTransformer


# 문자열·Pydantic·dataclass 도구 결과를 UI로 보낼 수 있는 문자열로 직렬화합니다.
def serialize_output(value):
    """Serialize built-in DeepAgents Command/Pydantic results as well as strings."""

    def encode(item):
        if hasattr(item, "model_dump"):
            return item.model_dump(mode="json")
        if is_dataclass(item) and not isinstance(item, type):
            return asdict(item)
        return str(item)

    return (
        value
        if isinstance(value, str)
        else json.dumps(value, ensure_ascii=False, default=encode)
    )


# 메시지·도구 호출별 진행 상태를 보관하는 스트림 변환기입니다.
class OpenUIStreamTransformer(StreamTransformer):
    supports_sync = True
    required_stream_modes = ("messages", "tools")

    def __init__(self, scope=()):
        super().__init__(scope)
        self.channel = StreamChannel("openui")
        self.messages = {}
        self.results = set()
        self.failed = False

    def init(self):
        return {"openui": self.channel}

    def emit(self, event_type, **fields):
        self.channel.push({"type": event_type, **fields})

    def end_message(self, state):
        for tool in state["tools"].values():
            self.end_tool(tool)
        if state["text_started"] and not state["text_ended"]:
            self.emit("TEXT_MESSAGE_END", messageId=state["id"])
            state["text_ended"] = True

    def end_tool(self, tool):
        if tool["started"] and not tool["ended"]:
            self.emit("TOOL_CALL_END", toolCallId=tool["id"])
            tool["ended"] = True

    def text(self, state, delta):
        if not delta:
            return
        if not state["text_started"]:
            self.emit("TEXT_MESSAGE_START", messageId=state["id"], role="assistant")
            state["text_started"] = True
        self.emit("TEXT_MESSAGE_CONTENT", messageId=state["id"], delta=delta)

    def tool(self, state, index, block, *, final=False):
        entry = state["tools"].setdefault(
            str(index),
            {
                "id": block.get("id") or str(uuid4()),
                "name": "",
                "args": "",
                "started": False,
                "ended": False,
            },
        )
        if entry["ended"]:
            return
        if not entry["started"]:
            entry["id"] = block.get("id") or entry["id"]
            entry["name"] = block.get("name") or entry["name"]
            if entry["name"]:
                self.emit(
                    "TOOL_CALL_START",
                    toolCallId=entry["id"],
                    toolCallName=entry["name"],
                )
                entry["started"] = True
        args = block.get("args", "")
        if not isinstance(args, str):
            args = json.dumps(args, ensure_ascii=False)
        if args and entry["started"] and (not final or not entry["args"]):
            delta = args.removeprefix(entry["args"])
            if delta:
                self.emit("TOOL_CALL_ARGS", toolCallId=entry["id"], delta=delta)
                entry["args"] += delta
        if final:
            self.end_tool(entry)

    # 루트 변환기에서만 이벤트를 처리하고 namespace와 실행 ID로 서로 다른 응답을 구분합니다.
    def process(self, event):
        # The root transformer handles all nested namespaces exactly once.
        if self.scope:
            return True
        method = event["method"]
        data = event["params"]["data"]
        if method == "tools":
            self.process_tool(data)
        elif method == "messages":
            metadata = {}
            if isinstance(data, (tuple, list)) and len(data) == 2:
                data, metadata = data
            if isinstance(data, dict) and "event" in data:
                run_id = metadata.get("run_id", data.get("run_id", ""))
                namespace = (*event["params"]["namespace"], str(run_id))
                self.process_message(namespace, {**data, "run_id": run_id})
        return True

    # 모델 메시지의 시작·본문 조각·도구 인자·종료를 AG-UI 이벤트로 투영합니다.
    def process_message(self, namespace, data):
        kind = data.get("event")
        if kind == "message-start":
            if namespace in self.messages:
                self.end_message(self.messages[namespace])
            self.messages[namespace] = {
                "id": data.get("id") or data.get("message_id") or str(uuid4()),
                "accept": data.get("role") in ("ai", "assistant")
                or (data.get("role") is None and bool(data.get("run_id"))),
                "text_started": False,
                "text_ended": False,
                "tools": {},
            }
            return
        state = self.messages.get(namespace)
        if not state or not state["accept"]:
            return
        if kind in ("content-block-start", "content-block-finish"):
            block = data["content"]
            if block.get("type") == "text" and kind == "content-block-start":
                self.text(state, block.get("text", ""))
            elif block.get("type") in ("tool_call", "tool_call_chunk"):
                self.tool(
                    state, data["index"], block, final=kind == "content-block-finish"
                )
        elif kind == "content-block-delta":
            delta = data["delta"]
            if delta.get("type") == "text-delta":
                self.text(state, delta.get("text", ""))
            elif delta.get("type") == "block-delta":
                fields = delta.get("fields", {})
                if str(data["index"]) in state["tools"] or fields.get("type") in (
                    "tool_call",
                    "tool_call_chunk",
                ):
                    self.tool(state, data["index"], fields)
        elif kind == "message-finish":
            self.end_message(state)
        elif kind == "error":
            self.fail(RuntimeError(data.get("message", "Model stream failed")))

    # 도구 결과에서 Python 메시지 포장을 벗기고, 같은 호출 결과가 두 번 나가지 않게 합니다.
    def process_tool(self, data):
        kind = data.get("event")
        if kind not in ("tool-finished", "tool-error"):
            return
        call_id = data["tool_call_id"]
        if call_id in self.results:
            return
        self.results.add(call_id)
        for state in self.messages.values():
            for tool in state["tools"].values():
                if tool["id"] == call_id:
                    self.end_tool(tool)
        output = data.get("output", data.get("message", ""))
        # Python's tool handler supplies a ToolMessage, not just its content.
        if hasattr(output, "content"):
            output = output.content
        elif isinstance(output, dict) and output.get("type") == "tool":
            output = output.get("content", "")
        content = serialize_output(output)
        error = {"isError": True, "error": content} if kind == "tool-error" else {}
        self.emit(
            "TOOL_CALL_RESULT",
            messageId=f"tool-result-{call_id}",
            toolCallId=call_id,
            content=content,
            role="tool",
            **error,
        )

    # 정상 종료 시 아직 열린 텍스트와 도구 호출을 마무리합니다.
    def finalize(self):
        for state in self.messages.values():
            self.end_message(state)

    # 실패 시 열린 이벤트를 정리하고 실행 오류를 한 번만 전달합니다.
    def fail(self, err):
        if self.scope:
            return
        self.finalize()
        if not self.failed:
            self.emit("RUN_ERROR", message=str(err))
            self.failed = True
