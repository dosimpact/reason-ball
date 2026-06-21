"""Example 27: multimodal voice input transcription and response."""

from __future__ import annotations

import base64
import binascii
import io
import os
import re
from operator import add
from typing import Annotated, Any, Literal, TypedDict

from langchain_core.messages import HumanMessage, SystemMessage
from langgraph.config import get_stream_writer
from langgraph.graph import END, START, StateGraph
from openai import BadRequestError, OpenAI

from common.llm import create_llm


FinalStatus = Literal["idle", "running", "completed", "failed"]


class AudioPayload(TypedDict, total=False):
    data_url: str
    name: str
    mime_type: str
    size: int
    duration_ms: int


class AudioMetadata(TypedDict, total=False):
    name: str
    mime_type: str
    size: int
    duration_ms: int
    source: str


class VoiceEvent(TypedDict):
    type: str
    phase: str
    status: str
    detail: str
    progress: float


class VoiceNote(TypedDict):
    label: str
    detail: str
    confidence: float


class MultimodalVoiceState(TypedDict, total=False):
    prompt: str
    audio: AudioPayload
    audio_data_url: str
    audio_metadata: AudioMetadata
    reviewed_transcript: str
    transcript: str
    transcript_source: str
    transcript_confidence: float
    key_phrases: list[str]
    response_notes: list[VoiceNote]
    validation_status: str
    voice_events: Annotated[list[VoiceEvent], add]
    answer: str
    final: str
    final_status: FinalStatus


DEFAULT_PROMPT = "Summarize this voice note and call out any action-relevant details."
MAX_AUDIO_BYTES = 5_000_000
TRANSCRIPTION_MODEL = os.environ.get("OPENAI_TRANSCRIPTION_MODEL", "gpt-4o-mini-transcribe")
SUPPORTED_MIME_TYPES = {
    "audio/aac",
    "audio/flac",
    "audio/m4a",
    "audio/mp4",
    "audio/mpeg",
    "audio/mpga",
    "audio/ogg",
    "audio/wav",
    "audio/webm",
    "audio/x-m4a",
    "audio/x-wav",
}


def _writer():
    try:
        return get_stream_writer()
    except RuntimeError:
        return lambda _event: None


def _event(phase: str, status: str, detail: str, progress: float) -> VoiceEvent:
    return {
        "type": "multimodal_voice_input",
        "phase": phase,
        "status": status,
        "detail": detail,
        "progress": progress,
    }


def _emit(event: VoiceEvent) -> VoiceEvent:
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


def _audio_payload(state: MultimodalVoiceState) -> AudioPayload:
    audio = state.get("audio") or {}
    data_url = state.get("audio_data_url") or audio.get("data_url", "")
    return {
        "data_url": str(data_url),
        "name": str(audio.get("name") or "uploaded-voice.m4a"),
        "mime_type": str(audio.get("mime_type") or ""),
        "size": int(audio.get("size") or 0),
        "duration_ms": int(audio.get("duration_ms") or 0),
    }


def _parse_data_url(data_url: str) -> tuple[str, bytes]:
    match = re.match(r"^data:(audio/[a-z0-9.+-]+);base64,(.+)$", data_url, flags=re.IGNORECASE | re.DOTALL)
    if not match:
        raise ValueError("Audio input must be a base64 data URL.")
    mime_type = match.group(1).lower()
    try:
        decoded = base64.b64decode(match.group(2), validate=True)
    except binascii.Error as exc:
        raise ValueError("Audio data URL is not valid base64.") from exc
    return mime_type, decoded


def _confidence_for(transcript: str) -> float:
    words = re.findall(r"[A-Za-z0-9']+", transcript)
    if len(words) >= 6:
        return 0.92
    if len(words) >= 3:
        return 0.82
    return 0.68


def _key_phrases(transcript: str) -> list[str]:
    candidates = re.findall(r"\b[A-Za-z][A-Za-z0-9'-]{3,}\b", transcript)
    seen: set[str] = set()
    phrases: list[str] = []
    for candidate in candidates:
        normalized = candidate.lower()
        if normalized in seen:
            continue
        seen.add(normalized)
        phrases.append(candidate)
        if len(phrases) >= 6:
            break
    return phrases


def validate_audio(state: MultimodalVoiceState) -> dict:
    prompt = str(state.get("prompt") or DEFAULT_PROMPT).strip() or DEFAULT_PROMPT
    reviewed_transcript = str(state.get("reviewed_transcript") or "").strip()
    payload = _audio_payload(state)
    events = [_emit(_event("validate_audio", "running", "Validating voice input.", 0.15))]

    if reviewed_transcript and not payload["data_url"]:
        events.append(_emit(_event("validate_audio", "completed", "Using reviewed transcript without audio upload.", 0.35)))
        return {
            "prompt": prompt,
            "reviewed_transcript": reviewed_transcript,
            "transcript": reviewed_transcript,
            "transcript_source": "reviewed_transcript",
            "transcript_confidence": 1.0,
            "audio_metadata": {
                "name": "reviewed-transcript",
                "mime_type": "text/plain",
                "size": len(reviewed_transcript.encode("utf-8")),
                "duration_ms": 0,
                "source": "reviewed-transcript",
            },
            "validation_status": "completed",
            "final_status": "running",
            "voice_events": events,
        }

    try:
        mime_type, decoded = _parse_data_url(payload["data_url"])
        if mime_type not in SUPPORTED_MIME_TYPES:
            raise ValueError(f"Unsupported audio type: {mime_type}. Use WAV, MP3, M4A, OGG, FLAC, or WebM.")
        if len(decoded) > MAX_AUDIO_BYTES:
            raise ValueError("Audio is too large for this example.")
    except ValueError as exc:
        events.append(_emit(_event("validate_audio", "failed", str(exc), 1.0)))
        return {
            "prompt": prompt,
            "validation_status": "failed",
            "answer": str(exc),
            "final": str(exc),
            "final_status": "failed",
            "voice_events": events,
        }

    metadata: AudioMetadata = {
        "name": payload["name"],
        "mime_type": mime_type,
        "size": len(decoded),
        "duration_ms": payload["duration_ms"],
        "source": "browser-upload",
    }
    events.append(_emit(_event("validate_audio", "completed", f"Accepted {mime_type} audio.", 0.35)))
    return {
        "prompt": prompt,
        "audio": {**payload, "mime_type": mime_type, "size": len(decoded)},
        "audio_data_url": payload["data_url"],
        "audio_metadata": metadata,
        "validation_status": "completed",
        "final_status": "running",
        "voice_events": events,
    }


def transcribe_audio(state: MultimodalVoiceState) -> dict:
    if state.get("validation_status") == "failed":
        return {}
    if state.get("transcript_source") == "reviewed_transcript":
        return {
            "key_phrases": _key_phrases(str(state.get("transcript") or "")),
            "voice_events": [_emit(_event("transcribe_audio", "completed", "Reviewed transcript accepted.", 0.65))],
        }

    payload = _audio_payload(state)
    metadata = state.get("audio_metadata") or {}
    start = _emit(_event("transcribe_audio", "running", f"Sending audio to OpenAI {TRANSCRIPTION_MODEL}.", 0.55))
    try:
        mime_type, decoded = _parse_data_url(payload["data_url"])
        transcript_result = OpenAI().audio.transcriptions.create(
            model=TRANSCRIPTION_MODEL,
            file=(payload["name"], io.BytesIO(decoded), mime_type),
            response_format="text",
            prompt="The note may mention LangGraph SDK example terms and the keyword cobalt.",
        )
    except (BadRequestError, ValueError) as exc:
        detail = getattr(exc, "message", str(exc))
        failure = _emit(_event("transcribe_audio", "failed", f"OpenAI could not transcribe this audio: {detail}", 1.0))
        message = "OpenAI could not transcribe this audio. Use the sample voice note or upload a clear WAV, MP3, M4A, OGG, FLAC, or WebM file."
        return {
            "answer": message,
            "final": message,
            "final_status": "failed",
            "voice_events": [start, failure],
        }

    transcript = str(transcript_result).strip()
    if not transcript:
        failure = _emit(_event("transcribe_audio", "failed", "OpenAI returned an empty transcript.", 1.0))
        message = "The audio was accepted, but the transcription was empty."
        return {
            "answer": message,
            "final": message,
            "final_status": "failed",
            "voice_events": [start, failure],
        }

    confidence = _confidence_for(transcript)
    done = _emit(_event("transcribe_audio", "completed", "OpenAI returned a transcript.", 0.7))
    return {
        "audio_metadata": metadata,
        "transcript": transcript,
        "transcript_source": "openai_audio_transcription",
        "transcript_confidence": confidence,
        "key_phrases": _key_phrases(transcript),
        "voice_events": [start, done],
    }


def generate_response(state: MultimodalVoiceState) -> dict:
    if state.get("final_status") == "failed":
        return {}
    prompt = str(state.get("prompt") or DEFAULT_PROMPT)
    transcript = str(state.get("transcript") or "").strip()
    if not transcript:
        return {}

    start = _emit(_event("generate_response", "running", "Generating a response from the transcript.", 0.82))
    response = create_llm("fast").invoke(
        [
            SystemMessage(
                content=(
                    "You are a concise assistant for a LangGraph SDK voice-input example. "
                    "Ground the answer only in the transcript and make the transcript-response relationship clear."
                )
            ),
            HumanMessage(
                content=(
                    f"USER PROMPT:\n{prompt}\n\n"
                    f"VOICE TRANSCRIPT:\n{transcript}\n\n"
                    "Return a short answer and mention one or two concrete details from the transcript."
                )
            ),
        ]
    )
    answer = _extract_text(response.content).strip()
    notes: list[VoiceNote] = [
        {
            "label": "Transcript",
            "detail": transcript[:220],
            "confidence": float(state.get("transcript_confidence") or 0.8),
        },
        {
            "label": "Input source",
            "detail": f"Source: {state.get('transcript_source', 'unknown')}; audio file: {(state.get('audio_metadata') or {}).get('name', 'none')}.",
            "confidence": 0.95,
        },
    ]
    done = _emit(_event("generate_response", "completed", "Generated response from voice transcript.", 0.95))
    return {
        "answer": answer,
        "response_notes": notes,
        "voice_events": [start, done],
    }


def finalize(state: MultimodalVoiceState) -> dict:
    if state.get("final_status") == "failed":
        return {}
    transcript = str(state.get("transcript") or "").strip()
    answer = str(state.get("answer") or "").strip()
    final = answer or f"Transcript captured: {transcript}"
    done = _emit(_event("finalize", "completed", "Voice input final state is ready.", 1.0))
    return {
        "final": final,
        "final_status": "completed",
        "voice_events": [done],
    }


builder = StateGraph(MultimodalVoiceState)
builder.add_node("validate_audio", validate_audio)
builder.add_node("transcribe_audio", transcribe_audio)
builder.add_node("generate_response", generate_response)
builder.add_node("finalize", finalize)
builder.add_edge(START, "validate_audio")
builder.add_edge("validate_audio", "transcribe_audio")
builder.add_edge("transcribe_audio", "generate_response")
builder.add_edge("generate_response", "finalize")
builder.add_edge("finalize", END)

graph = builder.compile()
