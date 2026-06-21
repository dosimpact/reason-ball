"""Example 26: multimodal image input analysis."""

from __future__ import annotations

import base64
import binascii
import re
from operator import add
from typing import Annotated, Any, Literal, TypedDict

from langchain_core.messages import HumanMessage, SystemMessage
from openai import BadRequestError
from langgraph.config import get_stream_writer
from langgraph.graph import END, START, StateGraph

from common.llm import create_llm


FinalStatus = Literal["running", "completed", "failed"]


class ImagePayload(TypedDict, total=False):
    data_url: str
    name: str
    mime_type: str
    size: int


class ImageMetadata(TypedDict, total=False):
    name: str
    mime_type: str
    size: int
    width: int
    height: int
    source: str


class Observation(TypedDict):
    label: str
    detail: str
    confidence: float


class RegionNote(TypedDict):
    id: str
    label: str
    x: float
    y: float
    width: float
    height: float
    note: str
    confidence: float


class ImageEvent(TypedDict):
    type: str
    phase: str
    status: str
    detail: str
    progress: float


class MultimodalImageState(TypedDict, total=False):
    prompt: str
    image: ImagePayload
    image_data_url: str
    image_metadata: ImageMetadata
    observations: list[Observation]
    region_notes: list[RegionNote]
    validation_status: str
    image_events: Annotated[list[ImageEvent], add]
    answer: str
    final: str
    final_status: FinalStatus


DEFAULT_PROMPT = "Analyze this image and describe the important visual details for a UI reviewer."
MAX_IMAGE_BYTES = 1_500_000
SUPPORTED_MIME_TYPES = {"image/png", "image/jpeg", "image/webp"}


def _writer():
    try:
        return get_stream_writer()
    except RuntimeError:
        return lambda _event: None


def _event(phase: str, status: str, detail: str, progress: float) -> ImageEvent:
    return {
        "type": "multimodal_image_input",
        "phase": phase,
        "status": status,
        "detail": detail,
        "progress": progress,
    }


def _emit(event: ImageEvent) -> ImageEvent:
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


def _image_payload(state: MultimodalImageState) -> ImagePayload:
    image = state.get("image") or {}
    data_url = state.get("image_data_url") or image.get("data_url", "")
    return {
        "data_url": str(data_url),
        "name": str(image.get("name") or "uploaded-image.png"),
        "mime_type": str(image.get("mime_type") or ""),
        "size": int(image.get("size") or 0),
    }


def _parse_data_url(data_url: str) -> tuple[str, bytes]:
    match = re.match(r"^data:(image/[a-z0-9.+-]+);base64,(.+)$", data_url, flags=re.IGNORECASE | re.DOTALL)
    if not match:
        raise ValueError("Image input must be a base64 data URL.")
    mime_type = match.group(1).lower()
    try:
        decoded = base64.b64decode(match.group(2), validate=True)
    except binascii.Error as exc:
        raise ValueError("Image data URL is not valid base64.") from exc
    return mime_type, decoded


def _dimensions(mime_type: str, data: bytes) -> tuple[int, int]:
    if mime_type == "image/png" and data.startswith(b"\x89PNG\r\n\x1a\n") and len(data) >= 24:
        return int.from_bytes(data[16:20], "big"), int.from_bytes(data[20:24], "big")
    if mime_type == "image/jpeg":
        index = 2
        while index + 9 < len(data):
            if data[index] != 0xFF:
                break
            marker = data[index + 1]
            length = int.from_bytes(data[index + 2 : index + 4], "big")
            if marker in {0xC0, 0xC2} and index + 8 < len(data):
                return int.from_bytes(data[index + 7 : index + 9], "big"), int.from_bytes(data[index + 5 : index + 7], "big")
            index += 2 + max(length, 2)
    return 0, 0


def validate_image(state: MultimodalImageState) -> dict:
    prompt = str(state.get("prompt") or DEFAULT_PROMPT).strip() or DEFAULT_PROMPT
    payload = _image_payload(state)
    events: list[ImageEvent] = [_emit(_event("validate_image", "running", "Validating image upload.", 0.15))]
    try:
        mime_type, decoded = _parse_data_url(payload["data_url"])
        if mime_type not in SUPPORTED_MIME_TYPES:
            raise ValueError(f"Unsupported image type: {mime_type}. Use PNG, JPEG, or WebP.")
        if len(decoded) > MAX_IMAGE_BYTES:
            raise ValueError("Image is too large for this example.")
    except ValueError as exc:
        events.append(_emit(_event("validate_image", "failed", str(exc), 1.0)))
        return {
            "prompt": prompt,
            "validation_status": "failed",
            "answer": str(exc),
            "final": str(exc),
            "final_status": "failed",
            "image_events": events,
        }

    width, height = _dimensions(mime_type, decoded)
    metadata: ImageMetadata = {
        "name": payload["name"],
        "mime_type": mime_type,
        "size": len(decoded),
        "width": width,
        "height": height,
        "source": "browser-upload",
    }
    events.append(_emit(_event("validate_image", "completed", f"Accepted {mime_type} image.", 0.35)))
    return {
        "prompt": prompt,
        "image": {**payload, "mime_type": mime_type, "size": len(decoded)},
        "image_data_url": payload["data_url"],
        "image_metadata": metadata,
        "validation_status": "completed",
        "final_status": "running",
        "image_events": events,
    }


def analyze_image(state: MultimodalImageState) -> dict:
    if state.get("validation_status") == "failed":
        return {}
    prompt = state.get("prompt", DEFAULT_PROMPT)
    data_url = state.get("image_data_url") or (state.get("image") or {}).get("data_url", "")
    metadata = state.get("image_metadata", {})
    start = _emit(_event("analyze_image", "running", "Sending image to OpenAI vision model.", 0.55))
    try:
        response = create_llm("fast").invoke(
            [
                SystemMessage(
                    content=(
                        "You are a careful vision analyst for a LangGraph SDK example. Give a concise, "
                        "grounded analysis of visible content, layout, colors, and any readable text. "
                        "Do not invent details that are not visible."
                    )
                ),
                HumanMessage(
                    content=[
                        {
                            "type": "text",
                            "text": (
                                f"USER PROMPT:\n{prompt}\n\n"
                                f"IMAGE METADATA:\n{metadata}\n\n"
                                "Return 2 short paragraphs suitable for a UI analysis panel."
                            ),
                        },
                        {"type": "image_url", "image_url": {"url": data_url}},
                    ]
                ),
            ]
        )
    except BadRequestError as exc:
        detail = getattr(exc, "message", str(exc))
        failure = _emit(_event("analyze_image", "failed", f"OpenAI could not parse this image: {detail}", 1.0))
        message = "OpenAI could not parse this image. Use the sample image or upload a larger PNG, JPEG, or WebP."
        return {
            "answer": message,
            "final": message,
            "final_status": "failed",
            "image_events": [start, failure],
        }
    answer = _extract_text(response.content).strip()
    observations: list[Observation] = [
        {
            "label": "Model-backed analysis",
            "detail": answer[:260],
            "confidence": 0.86,
        },
        {
            "label": "Upload metadata",
            "detail": f"{metadata.get('mime_type', 'image')} image, {metadata.get('width', 0)}x{metadata.get('height', 0)} pixels.",
            "confidence": 0.95,
        },
    ]
    region_notes: list[RegionNote] = [
        {
            "id": "region-center",
            "label": "Primary visual area",
            "x": 0.12,
            "y": 0.18,
            "width": 0.76,
            "height": 0.58,
            "note": "Review the main subject and any visible labels in this central region.",
            "confidence": 0.78,
        },
        {
            "id": "region-footer",
            "label": "Lower detail band",
            "x": 0.08,
            "y": 0.72,
            "width": 0.84,
            "height": 0.18,
            "note": "Check lower supporting details, controls, or captions if present.",
            "confidence": 0.66,
        },
    ]
    done = _emit(_event("analyze_image", "completed", "OpenAI returned image analysis.", 0.9))
    return {
        "observations": observations,
        "region_notes": region_notes,
        "answer": answer,
        "final": answer,
        "image_events": [start, done],
    }


def finalize(state: MultimodalImageState) -> dict:
    if state.get("final_status") == "failed":
        return {}
    event = _emit(_event("finalize", "completed", "Image analysis final state is ready.", 1.0))
    return {"final_status": "completed", "image_events": [event]}


def build_graph():
    builder = StateGraph(MultimodalImageState)
    builder.add_node("validate_image", validate_image)
    builder.add_node("analyze_image", analyze_image)
    builder.add_node("finalize", finalize)
    builder.add_edge(START, "validate_image")
    builder.add_edge("validate_image", "analyze_image")
    builder.add_edge("analyze_image", "finalize")
    builder.add_edge("finalize", END)
    return builder.compile()


graph = build_graph()
