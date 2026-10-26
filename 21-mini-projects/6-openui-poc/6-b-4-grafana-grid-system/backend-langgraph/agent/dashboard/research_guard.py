"""Require actual original-reading evidence for requests that explicitly need it."""

import json

from langchain.agents.middleware import AgentMiddleware
from langchain.agents.middleware.types import hook_config
from langchain_core.messages import AIMessage, RemoveMessage, SystemMessage


def original_reads(messages):
    last_user = max(
        (i for i, message in enumerate(messages) if message.type == "human"), default=-1
    )
    calls, evidence = {}, set()
    for message in messages[last_user + 1 :]:
        if message.type == "ai":
            calls.update({call["id"]: call for call in message.tool_calls})
        if message.type != "tool":
            continue
        call = calls.get(message.tool_call_id)
        if not call or call["name"] not in {"read_document_page", "read_sec_section"}:
            continue
        try:
            result = json.loads(message.content)
        except (TypeError, ValueError):
            continue
        if (
            not isinstance(result, dict)
            or result.get("error")
            or not result.get("text", "").strip()
        ):
            continue
        args = call["args"]
        key = (
            call["name"],
            args.get("document_id", args.get("filing_id")),
            args.get("page", args.get("section", "")),
        )
        evidence.add(key)
    return evidence


class ResearchEvidenceGuard(AgentMiddleware):
    def __init__(self, mode):
        self.mode = mode
        self.retries = 0

    @hook_config(can_jump_to=["model"])
    async def aafter_model(self, state, runtime):
        message = state["messages"][-1]
        if self.mode == "none" or message.type != "ai" or message.tool_calls:
            return None
        evidence = original_reads(state["messages"])
        minimum = 4 if self.mode == "overview" else 1
        if len(evidence) >= minimum:
            return None
        if self.retries >= 2:
            return {
                "messages": [
                    AIMessage(
                        id=message.id,
                        content='root = Card([Callout("warning", "원문 확인 미완료", "요청한 원문 범위를 충분히 읽지 못했습니다. 기존 검색 구절만으로 전체 보고서를 검토했다고 안내할 수 없습니다. 확인할 페이지나 준비된 보고서를 지정해 다시 요청해 주세요.")])',
                    )
                ]
            }
        self.retries += 1
        return {
            "messages": [
                RemoveMessage(id=message.id),
                SystemMessage(
                    content=f"Original-reading evidence is missing: this turn read {len(evidence)} distinct original pages/sections, minimum {minimum}. Call read_document_page(document_id, page) for prepared PDFs or read_sec_section for collected SEC filings. Search snippets and previous-turn reads do not satisfy a new request to verify originals. For overview, locate the table of contents then read business, risk, MD&A drivers and financial pages; read multiple pages when needed. Do not repeat already read pages. Then summarize with page-specific sources and an honest reviewed/unreviewed scope INSIDE visible UI, not program comments. Do not change Canvas panels unless requested."
                ),
            ],
            "jump_to": "model",
        }


def original_scope(messages):
    """Build visible scope from server tool results, never from model-written comments."""
    last_user = max(
        (i for i, message in enumerate(messages) if message["role"] == "user"),
        default=-1,
    )
    reads, sources = {}, {}
    for message in messages[last_user + 1 :]:
        if message["role"] != "tool":
            continue
        try:
            result = json.loads(message.get("content", ""))
        except (TypeError, ValueError):
            continue
        if (
            not isinstance(result, dict)
            or result.get("error")
            or not result.get("text")
        ):
            continue
        if "document_id" in result and "page" in result:
            label = f"{result.get('document', result['document_id'])} · {result['page']}페이지"
        elif "filing_id" in result and "section" in result:
            label = (
                f"{result.get('company', result['filing_id'])} · {result['section']}"
            )
        else:
            continue
        partial = bool(result.get("offset") or result.get("next_offset") is not None)
        reads[label] = reads.get(label, False) or partial
        url = result.get("url")
        if url:
            sources[url] = {"title": label, "sourceName": "확인한 원문", "url": url}
    if not reads:
        return None
    text = "이번 요청에서 확인한 원문: " + "; ".join(
        label + (" (부분 범위)" if partial else "") for label, partial in reads.items()
    )
    text += ". 위 목록은 이번 요청에서 직접 읽은 범위입니다. 이전 대화의 검색 구절과는 구분되며, 전체 보고서와 모든 주석을 검토했다는 뜻은 아닙니다."
    return (
        'root = Card([Callout("info", "확인한 원문 범위", '
        + json.dumps(text, ensure_ascii=False)
        + ")], "
        + json.dumps(list(sources.values()), ensure_ascii=False)
        + ")"
    )
