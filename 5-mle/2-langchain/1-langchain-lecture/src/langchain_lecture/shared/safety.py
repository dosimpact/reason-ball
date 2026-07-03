"""개인정보 마스킹과 위험 요청 차단 같은 안전 유틸입니다."""

from __future__ import annotations

import re
from dataclasses import dataclass
from enum import Enum


EMAIL_PATTERN = re.compile(r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b")
PHONE_PATTERN = re.compile(r"\b(?:\+?82[-.\s]?)?0?1[016789][-.\s]?\d{3,4}[-.\s]?\d{4}\b")


class ToolRisk(str, Enum):
    SAFE = "safe"
    RISKY = "risky"


@dataclass(frozen=True)
class ToolPolicy:
    name: str
    risk: ToolRisk
    description: str


@dataclass(frozen=True)
class GuardrailResult:
    allowed: bool
    text: str
    reason: str = ""


def mask_pii(text: str) -> str:
    masked = EMAIL_PATTERN.sub("[EMAIL]", text)
    return PHONE_PATTERN.sub("[PHONE]", masked)


def block_forbidden_request(text: str) -> GuardrailResult:
    forbidden_terms = ["비밀번호", "password", "delete all", "파일 삭제", "결제"]
    lowered = text.lower()
    for term in forbidden_terms:
        if term.lower() in lowered:
            return GuardrailResult(False, text, f"Forbidden request contains {term!r}.")
    return GuardrailResult(True, text)


def requires_approval(policy: ToolPolicy) -> bool:
    return policy.risk == ToolRisk.RISKY
