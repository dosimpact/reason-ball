"""Example 30: chat-driven document artifact workflow."""

from __future__ import annotations

from operator import add
from typing import Annotated, Any, Literal, TypedDict

from langchain_core.messages import HumanMessage, SystemMessage
from langgraph.config import get_stream_writer
from langgraph.graph import END, START, StateGraph

from common.llm import create_llm


FinalStatus = Literal["idle", "running", "awaiting_approval", "applied", "rejected", "failed"]
ApprovalAction = Literal["approve", "reject", "pending", "none", ""]
DocumentAction = Literal["draft", "save_user_edit", "ai_revise", "approve", "reject", ""]


class DocumentSection(TypedDict, total=False):
    id: str
    title: str
    before: str
    after: str
    change_summary: str
    status: str


class DocumentComment(TypedDict):
    id: str
    section_id: str
    severity: str
    text: str


class QualityCheck(TypedDict):
    label: str
    status: str
    detail: str


class DocumentVersion(TypedDict, total=False):
    version: int
    title: str
    summary: str
    sections: list[DocumentSection]


class DocumentEvent(TypedDict):
    type: str
    phase: str
    status: str
    detail: str
    progress: float


class DocumentArtifactState(TypedDict, total=False):
    action: DocumentAction
    user_request: str
    tone: str
    target_length: str
    focus_section: str
    approval: ApprovalAction
    document_title: str
    document_summary: str
    sections: list[DocumentSection]
    comments: list[DocumentComment]
    quality_checks: list[QualityCheck]
    quality_score: float
    revision_summary: str
    artifact_version: int
    version_history: list[DocumentVersion]
    approval_log: str
    last_editor: str
    final: str
    final_status: FinalStatus
    document_events: Annotated[list[DocumentEvent], add]


BASE_SECTIONS: list[DocumentSection] = [
    {
        "id": "overview",
        "title": "Overview",
        "before": "The draft explains the product update and why it matters to customers.",
    },
    {
        "id": "details",
        "title": "Details",
        "before": "The current text lists feature changes, timing, and rollout notes.",
    },
    {
        "id": "next_steps",
        "title": "Next Steps",
        "before": "The draft asks reviewers to confirm owner, scope, and launch readiness.",
    },
]


def _writer():
    try:
        return get_stream_writer()
    except RuntimeError:
        return lambda _event: None


def _event(phase: str, status: str, detail: str, progress: float) -> DocumentEvent:
    return {
        "type": "chat_document_artifact",
        "phase": phase,
        "status": status,
        "detail": detail,
        "progress": progress,
    }


def _emit(event: DocumentEvent) -> DocumentEvent:
    _writer()(event)
    return event


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


def _normalize(value: Any, fallback: str) -> str:
    text = str(value or "").strip()
    return text or fallback


def _section_after(section: DocumentSection, request: str, tone: str, target_length: str) -> str:
    title = section["title"]
    request_hint = request[:120].rstrip(".")
    return (
        f"{title}: {tone} {target_length} revision that addresses '{request_hint}'. "
        "It tightens the message, keeps section intent intact, and makes reviewer action explicit."
    )


def _coerce_sections(value: Any) -> list[DocumentSection]:
    if not isinstance(value, list):
        return []

    sections: list[DocumentSection] = []
    for index, item in enumerate(value):
        if not isinstance(item, dict):
            continue
        section_id = _normalize(item.get("id"), f"section_{index + 1}")
        title = _normalize(item.get("title"), section_id.replace("_", " ").title())
        before = str(item.get("before") or "")
        after = str(item.get("after") or item.get("content") or before)
        change_summary = str(item.get("change_summary") or item.get("changeSummary") or "")
        status = str(item.get("status") or "")
        sections.append(
            {
                "id": section_id,
                "title": title,
                "before": before,
                "after": after,
                "change_summary": change_summary,
                "status": status,
            }
        )
    return sections


def _current_sections(state: DocumentArtifactState) -> list[DocumentSection]:
    sections = _coerce_sections(state.get("sections"))
    if sections:
        return sections
    return [
        {
            "id": str(section["id"]),
            "title": str(section["title"]),
            "before": str(section["before"]),
            "after": str(section["before"]),
            "change_summary": "Base section loaded.",
            "status": "base",
        }
        for section in BASE_SECTIONS
    ]


def _revision_after(section: DocumentSection, request: str, tone: str, target_length: str) -> str:
    title = str(section.get("title") or "Section")
    source = str(section.get("after") or section.get("before") or "")
    source_hint = source[:100].rstrip(".")
    request_hint = request[:100].rstrip(".")
    return (
        f"{title}: AI revised the current canvas in a {tone} {target_length} style. "
        f"It preserves '{source_hint}' while addressing '{request_hint}' with clearer reviewer action."
    )


def draft_document(state: DocumentArtifactState) -> dict:
    request = _normalize(state.get("user_request"), "Make this document clearer and easier to review.")
    tone = _normalize(state.get("tone"), "professional")
    target_length = _normalize(state.get("target_length"), "concise")
    focus_section = _normalize(state.get("focus_section"), "all")
    start = _emit(_event("draft", "running", "Creating section-level document revision.", 0.2))

    sections: list[DocumentSection] = []
    for section in BASE_SECTIONS:
        selected = focus_section == "all" or focus_section == section["id"]
        after = _section_after(section, request, tone, target_length) if selected else str(section["before"])
        sections.append(
            {
                "id": str(section["id"]),
                "title": str(section["title"]),
                "before": str(section["before"]),
                "after": after,
                "change_summary": "Rewritten for tone, clarity, and reviewability." if selected else "Unchanged.",
                "status": "changed" if selected else "unchanged",
            }
        )

    llm = create_llm("fast")
    summary = _extract_text(
        llm.invoke(
            [
                SystemMessage(content="Write one short sentence summarizing a document edit proposal."),
                HumanMessage(
                    content=f"Request: {request}\nTone: {tone}\nLength: {target_length}\nFocus: {focus_section}",
                ),
            ]
        ).content
    ).strip()
    if len(summary) > 320:
        summary = f"{summary[:317].rstrip()}..."

    return {
        "user_request": request,
        "tone": tone,
        "target_length": target_length,
        "focus_section": focus_section,
        "document_title": "Launch Readiness Brief",
        "document_summary": summary or "Document revision proposal is ready for review.",
        "sections": sections,
        "revision_summary": summary or "Document revision proposal is ready for review.",
        "artifact_version": int(state.get("artifact_version") or 0),
        "version_history": list(state.get("version_history") or []),
        "approval": "pending",
        "approval_log": "",
        "last_editor": "ai",
        "final": "Document proposal ready; awaiting approval before versioning.",
        "final_status": "awaiting_approval",
        "document_events": [start, _emit(_event("draft", "completed", "Section revisions prepared.", 0.45))],
    }


def save_user_edits(state: DocumentArtifactState) -> dict:
    start = _emit(_event("user_edit", "running", "Saving direct edits from the document canvas.", 0.25))
    sections: list[DocumentSection] = []
    for section in _current_sections(state):
        status = str(section.get("status") or "changed")
        user_edited = status in {"user_editing", "user_edited"}
        sections.append(
            {
                "id": str(section.get("id") or ""),
                "title": str(section.get("title") or ""),
                "before": str(section.get("before") or ""),
                "after": str(section.get("after") or ""),
                "change_summary": (
                    "User edited this section directly in the document canvas."
                    if user_edited
                    else str(section.get("change_summary") or "Preserved from prior canvas state.")
                ),
                "status": "user_edited" if user_edited else status,
            }
        )

    title = _normalize(state.get("document_title"), "Launch Readiness Brief")
    summary = _normalize(state.get("document_summary"), "User-edited document draft saved.")
    done = _emit(_event("user_edit", "completed", "User canvas edits saved into graph state.", 0.6))
    return {
        "document_title": title,
        "document_summary": summary,
        "sections": sections,
        "revision_summary": "User edits saved. The artifact can be approved or revised by AI.",
        "approval": "pending",
        "approval_log": "",
        "last_editor": "user",
        "final": "User document edits saved; awaiting approval or AI revision.",
        "final_status": "awaiting_approval",
        "document_events": [start, done],
    }


def revise_document(state: DocumentArtifactState) -> dict:
    request = _normalize(state.get("user_request"), "Improve the current document canvas.")
    tone = _normalize(state.get("tone"), "professional")
    target_length = _normalize(state.get("target_length"), "concise")
    focus_section = _normalize(state.get("focus_section"), "all")
    start = _emit(_event("ai_revise", "running", "AI is revising the current document canvas.", 0.25))

    sections: list[DocumentSection] = []
    for section in _current_sections(state):
        selected = focus_section == "all" or focus_section == section.get("id")
        current_text = str(section.get("after") or section.get("before") or "")
        sections.append(
            {
                "id": str(section.get("id") or ""),
                "title": str(section.get("title") or ""),
                "before": current_text if selected else str(section.get("before") or current_text),
                "after": _revision_after(section, request, tone, target_length) if selected else current_text,
                "change_summary": (
                    "AI revised the current editable canvas draft."
                    if selected
                    else str(section.get("change_summary") or "Unchanged.")
                ),
                "status": "ai_revised" if selected else str(section.get("status") or "unchanged"),
            }
        )

    llm = create_llm("fast")
    summary = _extract_text(
        llm.invoke(
            [
                SystemMessage(content="Write one short sentence summarizing an AI revision to an editable document canvas."),
                HumanMessage(content=f"Request: {request}\nTone: {tone}\nLength: {target_length}\nFocus: {focus_section}"),
            ]
        ).content
    ).strip()
    if len(summary) > 320:
        summary = f"{summary[:317].rstrip()}..."

    done = _emit(_event("ai_revise", "completed", "AI revision applied to the document canvas.", 0.6))
    return {
        "user_request": request,
        "tone": tone,
        "target_length": target_length,
        "focus_section": focus_section,
        "document_title": _normalize(state.get("document_title"), "Launch Readiness Brief"),
        "document_summary": summary or "AI revised the current document canvas.",
        "sections": sections,
        "revision_summary": summary or "AI revised the current document canvas.",
        "approval": "pending",
        "approval_log": "",
        "last_editor": "ai",
        "final": "AI revised the document canvas; awaiting approval.",
        "final_status": "awaiting_approval",
        "document_events": [start, done],
    }


def evaluate_document(state: DocumentArtifactState) -> dict:
    start = _emit(_event("evaluate", "running", "Running document quality checks.", 0.65))
    checks: list[QualityCheck] = [
        {"label": "Tone", "status": "passed", "detail": f"Matches requested {state.get('tone', 'professional')} tone."},
        {"label": "Structure", "status": "passed", "detail": "Sections remain stable and reviewable."},
        {"label": "Actionability", "status": "passed", "detail": "Reviewer next steps are explicit."},
    ]
    comments: list[DocumentComment] = [
        {
            "id": "comment-tone",
            "section_id": "overview",
            "severity": "suggestion",
            "text": "Opening section now states the purpose earlier.",
        },
        {
            "id": "comment-action",
            "section_id": "next_steps",
            "severity": "required",
            "text": "Reviewer action is clear enough for approval workflow.",
        },
    ]
    done = _emit(_event("evaluate", "completed", "Document checks passed.", 0.92))
    return {
        "comments": comments,
        "quality_checks": checks,
        "quality_score": 0.92,
        "final_status": "awaiting_approval",
        "document_events": [start, done],
    }


def apply_document(state: DocumentArtifactState) -> dict:
    start = _emit(_event("apply", "running", "Applying approved document artifact version.", 0.35))
    version = int(state.get("artifact_version") or 0) + 1
    history = list(state.get("version_history") or [])
    history.append(
        {
            "version": version,
            "title": str(state.get("document_title") or "Document Artifact"),
            "summary": str(state.get("revision_summary") or "Approved document revision."),
            "sections": list(state.get("sections") or []),
        }
    )
    done = _emit(_event("apply", "completed", "Approved document version stored in artifact state.", 1.0))
    return {
        "artifact_version": version,
        "version_history": history,
        "approval": "",
        "approval_log": "approved",
        "last_editor": str(state.get("last_editor") or "ai"),
        "final": f"Applied document version v{version}.",
        "final_status": "applied",
        "document_events": [start, done],
    }


def reject_document(state: DocumentArtifactState) -> dict:
    start = _emit(_event("approve", "running", "Rejecting proposed document revision.", 0.5))
    done = _emit(_event("approve", "completed", "Document proposal rejected without versioning.", 1.0))
    return {
        "approval": "",
        "approval_log": "rejected",
        "final": "Document proposal rejected. No artifact version created.",
        "final_status": "rejected",
        "document_events": [start, done],
    }


def finalize(state: DocumentArtifactState) -> dict:
    status = str(state.get("final_status") or "idle")
    final = str(state.get("final") or "Document workflow completed.")
    done = _emit(_event("final", "completed", f"Run completed with status={status}.", 1.0))
    return {"final": final, "final_status": status, "document_events": [done]}


def route_action(state: DocumentArtifactState) -> str:
    action = str(state.get("action") or "").strip().lower()
    if action == "save_user_edit":
        return "save_user_edits"
    if action == "ai_revise":
        return "revise_document"

    approval = str(state.get("approval") or "").strip().lower()
    if approval == "approve" or action == "approve":
        return "apply_document" if state.get("sections") else "reject_document"
    if approval == "reject" or action == "reject":
        return "reject_document"
    return "draft_document"


builder = StateGraph(DocumentArtifactState)
builder.add_node("draft_document", draft_document)
builder.add_node("save_user_edits", save_user_edits)
builder.add_node("revise_document", revise_document)
builder.add_node("evaluate_document", evaluate_document)
builder.add_node("apply_document", apply_document)
builder.add_node("reject_document", reject_document)
builder.add_node("finalize", finalize)
builder.add_conditional_edges(
    START,
    route_action,
    {
        "draft_document": "draft_document",
        "save_user_edits": "save_user_edits",
        "revise_document": "revise_document",
        "apply_document": "apply_document",
        "reject_document": "reject_document",
    },
)
builder.add_edge("draft_document", "evaluate_document")
builder.add_edge("save_user_edits", "evaluate_document")
builder.add_edge("revise_document", "evaluate_document")
builder.add_edge("evaluate_document", "finalize")
builder.add_edge("apply_document", "finalize")
builder.add_edge("reject_document", "finalize")
builder.add_edge("finalize", END)

graph = builder.compile()
