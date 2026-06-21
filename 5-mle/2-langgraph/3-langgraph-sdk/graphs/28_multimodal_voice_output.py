"""Example 28: multimodal voice output with OpenAI text-to-speech."""

from __future__ import annotations

import base64
import os
from operator import add
from typing import Annotated, Any, Literal, TypedDict

from langchain_core.messages import HumanMessage, SystemMessage
from langgraph.config import get_stream_writer
from langgraph.graph import END, START, StateGraph
from openai import OpenAI, OpenAIError

from common.llm import create_llm


FinalStatus = Literal["idle", "running", "completed", "audio_failed", "failed"]
SpeechFormat = Literal["mp3", "wav", "aac", "opus", "flac"]
SpeechVoice = Literal["alloy", "ash", "ballad", "coral", "echo", "fable", "nova", "onyx", "sage", "shimmer"]


class AudioOutput(TypedDict, total=False):
    data_url: str
    mime_type: str
    format: str
    size: int
    voice: str
    model: str
    filename: str


class AudioEvent(TypedDict):
    type: str
    phase: str
    status: str
    detail: str
    progress: float


class SpeechSettings(TypedDict, total=False):
    voice: str
    response_format: str
    instructions: str
    model: str


class MultimodalVoiceOutputState(TypedDict, total=False):
    prompt: str
    voice: str
    response_format: str
    speech_instructions: str
    text_answer: str
    audio_output: AudioOutput
    audio_data_url: str
    audio_events: Annotated[list[AudioEvent], add]
    speech_settings: SpeechSettings
    final: str
    final_status: FinalStatus


DEFAULT_PROMPT = "Create a short spoken update about LangGraph SDK voice output."
DEFAULT_VOICE = "coral"
DEFAULT_FORMAT = "mp3"
DEFAULT_INSTRUCTIONS = "Speak clearly, warmly, and at a measured pace."
SPEECH_MODEL = os.environ.get("OPENAI_TTS_MODEL", "gpt-4o-mini-tts")
SUPPORTED_VOICES = {"alloy", "ash", "ballad", "coral", "echo", "fable", "nova", "onyx", "sage", "shimmer"}
SUPPORTED_FORMATS = {"mp3", "wav", "aac", "opus", "flac"}
MIME_TYPES = {
    "mp3": "audio/mpeg",
    "wav": "audio/wav",
    "aac": "audio/aac",
    "opus": "audio/opus",
    "flac": "audio/flac",
}


def _writer():
    try:
        return get_stream_writer()
    except RuntimeError:
        return lambda _event: None


def _event(phase: str, status: str, detail: str, progress: float) -> AudioEvent:
    return {
        "type": "multimodal_voice_output",
        "phase": phase,
        "status": status,
        "detail": detail,
        "progress": progress,
    }


def _emit(event: AudioEvent) -> AudioEvent:
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


def _settings(state: MultimodalVoiceOutputState) -> tuple[str, str, str]:
    voice = str(state.get("voice") or DEFAULT_VOICE).strip().lower()
    response_format = str(state.get("response_format") or DEFAULT_FORMAT).strip().lower()
    instructions = str(state.get("speech_instructions") or DEFAULT_INSTRUCTIONS).strip() or DEFAULT_INSTRUCTIONS
    if voice not in SUPPORTED_VOICES:
        voice = DEFAULT_VOICE
    if response_format not in SUPPORTED_FORMATS:
        response_format = DEFAULT_FORMAT
    return voice, response_format, instructions


def compose_text(state: MultimodalVoiceOutputState) -> dict:
    prompt = str(state.get("prompt") or DEFAULT_PROMPT).strip() or DEFAULT_PROMPT
    voice, response_format, instructions = _settings(state)
    start = _emit(_event("compose_text", "running", "Generating text response for speech synthesis.", 0.2))
    response = create_llm("fast").invoke(
        [
            SystemMessage(
                content=(
                    "You write concise text that will be spoken aloud in a LangGraph SDK voice-output example. "
                    "Keep the answer under 70 words, concrete, and easy to understand when heard."
                )
            ),
            HumanMessage(content=f"USER REQUEST:\n{prompt}\n\nVoice: {voice}. Format: {response_format}."),
        ]
    )
    text_answer = _extract_text(response.content).strip()
    done = _emit(_event("compose_text", "completed", "Text response is ready for TTS.", 0.42))
    return {
        "prompt": prompt,
        "voice": voice,
        "response_format": response_format,
        "speech_instructions": instructions,
        "text_answer": text_answer,
        "speech_settings": {
            "voice": voice,
            "response_format": response_format,
            "instructions": instructions,
            "model": SPEECH_MODEL,
        },
        "final_status": "running",
        "audio_events": [start, done],
    }


def synthesize_audio(state: MultimodalVoiceOutputState) -> dict:
    text_answer = str(state.get("text_answer") or "").strip()
    if not text_answer:
        failure = _emit(_event("synthesize_audio", "failed", "No text response was available for speech synthesis.", 1.0))
        return {
            "final": "Text generation failed before audio synthesis.",
            "final_status": "failed",
            "audio_events": [failure],
        }

    voice, response_format, instructions = _settings(state)
    start = _emit(_event("synthesize_audio", "running", f"Calling OpenAI {SPEECH_MODEL} voice {voice}.", 0.68))
    try:
        speech = OpenAI().audio.speech.create(
            model=SPEECH_MODEL,
            voice=voice,
            input=text_answer[:900],
            instructions=instructions,
            response_format=response_format,
        )
        audio_bytes = speech.content if hasattr(speech, "content") else speech.read()
    except OpenAIError as exc:
        detail = getattr(exc, "message", str(exc))
        failure = _emit(_event("synthesize_audio", "failed", f"OpenAI speech generation failed: {detail}", 1.0))
        return {
            "final": text_answer,
            "final_status": "audio_failed",
            "audio_events": [start, failure],
        }

    mime_type = MIME_TYPES.get(response_format, "audio/mpeg")
    data_url = f"data:{mime_type};base64,{base64.b64encode(audio_bytes).decode('ascii')}"
    filename = f"langgraph-voice-output.{response_format}"
    output: AudioOutput = {
        "data_url": data_url,
        "mime_type": mime_type,
        "format": response_format,
        "size": len(audio_bytes),
        "voice": voice,
        "model": SPEECH_MODEL,
        "filename": filename,
    }
    done = _emit(_event("synthesize_audio", "completed", "OpenAI returned spoken audio.", 0.9))
    return {
        "audio_output": output,
        "audio_data_url": data_url,
        "audio_events": [start, done],
    }


def finalize(state: MultimodalVoiceOutputState) -> dict:
    if state.get("final_status") == "audio_failed":
        return {}
    if state.get("final_status") == "failed":
        return {}
    text_answer = str(state.get("text_answer") or "").strip()
    audio_output = state.get("audio_output") or {}
    if audio_output:
        detail = f"Voice output generated as {audio_output.get('format', 'audio')} with {audio_output.get('voice', 'voice')}."
    else:
        detail = "Voice output completed without audio metadata."
    done = _emit(_event("finalize", "completed", detail, 1.0))
    return {
        "final": text_answer,
        "final_status": "completed",
        "audio_events": [done],
    }


builder = StateGraph(MultimodalVoiceOutputState)
builder.add_node("compose_text", compose_text)
builder.add_node("synthesize_audio", synthesize_audio)
builder.add_node("finalize", finalize)
builder.add_edge(START, "compose_text")
builder.add_edge("compose_text", "synthesize_audio")
builder.add_edge("synthesize_audio", "finalize")
builder.add_edge("finalize", END)

graph = builder.compile()
