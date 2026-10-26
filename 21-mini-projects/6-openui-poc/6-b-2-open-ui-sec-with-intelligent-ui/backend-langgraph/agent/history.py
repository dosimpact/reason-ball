# 대화 목록과 모델·도구 메시지를 SQLite에 보관하는 저장 계층입니다.
# 브라우저가 보낸 과거 이력 대신 서버 기록을 사용하고, 재실행 전에 미완성 도구 호출을 정리합니다.
"""Durable local conversations. Only server-produced model/tool messages are trusted."""

import json
import sqlite3
from contextlib import contextmanager
from datetime import UTC, datetime
from uuid import UUID, uuid4

from agent.documents import data_directory


class ThreadNotFound(LookupError):
    pass


# 대화 DB 연결과 트랜잭션 수명을 한곳에서 관리하고 작업 후 연결을 닫습니다.
@contextmanager
def connect():
    directory = data_directory()
    directory.mkdir(parents=True, exist_ok=True)
    db = sqlite3.connect(directory / "conversations.sqlite", timeout=10)
    db.execute("""CREATE TABLE IF NOT EXISTS threads (
        id TEXT PRIMARY KEY, title TEXT NOT NULL, created_at TEXT NOT NULL,
        messages TEXT NOT NULL DEFAULT '[]')""")
    try:
        with db:
            yield db
    finally:
        db.close()


def checked_id(value):
    if not isinstance(value, str):
        raise TypeError("Invalid thread id")
    return str(UUID(value))


# 사이드바에 표시할 대화를 생성 시각의 역순으로 읽습니다.
def list_threads():
    with connect() as db:
        return [
            {"id": i, "title": t, "createdAt": c}
            for i, t, c in db.execute(
                "SELECT id,title,created_at FROM threads ORDER BY created_at DESC"
            )
        ]


# 새 대화의 식별자와 제목을 만들고 메시지 이력을 저장할 자리를 준비합니다.
def create_thread(title):
    thread = {
        "id": str(uuid4()),
        "title": title[:100] or "New chat",
        "createdAt": datetime.now(UTC).isoformat(),
    }
    with connect() as db:
        db.execute(
            "INSERT INTO threads(id,title,created_at) VALUES (?,?,?)",
            (thread["id"], thread["title"], thread["createdAt"]),
        )
    return thread


# 브라우저 복원과 다음 모델 호출이 사용할 서버 보관 이력을 읽습니다.
def get_messages(thread_id):
    with connect() as db:
        row = db.execute(
            "SELECT messages FROM threads WHERE id=?", (checked_id(thread_id),)
        ).fetchone()
    if row is None:
        raise ThreadNotFound("Thread not found")
    return json.loads(row[0])


# 한 대화의 이력을 트랜잭션으로 갱신합니다. 모델 실행 완료 또는 취소 처리에서 호출합니다.
def save_messages(thread_id, messages):
    with connect() as db:
        result = db.execute(
            "UPDATE threads SET messages=? WHERE id=?",
            (json.dumps(messages, ensure_ascii=False), checked_id(thread_id)),
        )
        if not result.rowcount:
            raise ThreadNotFound("Thread not found")


# 메시지 이력은 유지하고 사용자에게 보이는 대화 제목만 갱신합니다.
def update_thread(thread_id, title):
    with connect() as db:
        result = db.execute(
            "UPDATE threads SET title=? WHERE id=?",
            (title[:100], checked_id(thread_id)),
        )
        if not result.rowcount:
            raise ThreadNotFound("Thread not found")
    return next(t for t in list_threads() if t["id"] == checked_id(thread_id))


# 선택한 대화 레코드만 삭제하며 문서 검색 DB는 건드리지 않습니다.
def delete_thread(thread_id):
    with connect() as db:
        result = db.execute("DELETE FROM threads WHERE id=?", (checked_id(thread_id),))
        if not result.rowcount:
            raise ThreadNotFound("Thread not found")


# 완료된 도구 호출과 결과만 짝지어 모델에 재전달합니다. 고립된 결과와 미완성 호출은 제외합니다.
def trusted_history(messages):
    """Remove unfinished calls and orphan results before sending to the model."""
    clean = []
    index = 0
    while index < len(messages):
        message = messages[index]
        index += 1
        if message["role"] == "tool":
            continue
        if message["role"] != "assistant" or not message.get("tool_calls"):
            clean.append(message)
            continue
        results = []
        while index < len(messages) and messages[index]["role"] == "tool":
            results.append(messages[index])
            index += 1
        ids = {r["tool_call_id"] for r in results}
        calls = [c for c in message["tool_calls"] if c["id"] in ids]
        item = {k: v for k, v in message.items() if k != "tool_calls"}
        if calls:
            item["tool_calls"] = calls
        if calls or item.get("content"):
            clean.append(item)
        valid = {c["id"] for c in calls}
        clean.extend(r for r in results if r["tool_call_id"] in valid)
    return clean


# 스트림 이벤트를 대화 메시지로 누적해 실행 실패·취소 때도 완료된 부분을 보존합니다.
class TurnRecorder:
    """Retain completed/partial streamed turns even if a request is cancelled."""

    def __init__(self, question):
        self.messages = [question]
        self.texts = {}
        self.calls = {}

    def observe(self, event):
        kind = event["type"]
        if kind == "TEXT_MESSAGE_START":
            item = {"role": "assistant", "content": ""}
            self.messages.append(item)
            self.texts[event["messageId"]] = item
        elif kind == "TEXT_MESSAGE_CONTENT":
            self.texts[event["messageId"]]["content"] += event["delta"]
        elif kind == "TOOL_CALL_START":
            call = {
                "id": event["toolCallId"],
                "type": "function",
                "function": {"name": event["toolCallName"], "arguments": ""},
            }
            # All parallel calls must precede their tool results in replay.
            if self.messages[-1]["role"] == "assistant" and self.messages[-1].get(
                "tool_calls"
            ):
                self.messages[-1]["tool_calls"].append(call)
            else:
                self.messages.append(
                    {"role": "assistant", "content": "", "tool_calls": [call]}
                )
            self.calls[event["toolCallId"]] = call
        elif kind == "TOOL_CALL_ARGS":
            self.calls[event["toolCallId"]]["function"]["arguments"] += event["delta"]
        elif kind == "TOOL_CALL_RESULT":
            self.messages.append(
                {
                    "role": "tool",
                    "tool_call_id": event["toolCallId"],
                    "content": event["content"],
                }
            )
