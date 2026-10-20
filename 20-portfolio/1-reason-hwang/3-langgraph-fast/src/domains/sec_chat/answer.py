"""모델이 작성한 요약과 원문 인용을 검증하고 Intelligent UI 프로그램으로 변환한다."""
from __future__ import annotations

import json
import re
from typing import Literal

from pydantic import BaseModel, Field

from .source import ITEMS


class Finding(BaseModel):
    item: Literal["1", "1A", "3", "7", "8"]
    heading: str = Field(min_length=1, max_length=250)
    summary: str = Field(min_length=1, max_length=3000)
    quote: str = Field(min_length=12, max_length=700)


class Answer(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    findings: list[Finding] = Field(min_length=1, max_length=60)
    limitations: str = Field(max_length=2000)


class DraftFinding(BaseModel):
    item: Literal["1", "1A", "3", "7", "8"]
    heading: str = Field(min_length=1, max_length=250)
    summary: str = Field(min_length=1, max_length=3000)
    evidence_id: str = Field(min_length=3, max_length=30)


class DraftAnswer(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    findings: list[DraftFinding] = Field(min_length=1, max_length=60)
    limitations: str = Field(max_length=2000)


def evidence_packets(evidence: dict[str, str]) -> dict[str, dict]:
    packets = {}
    for code, text in evidence.items():
        number = 0
        for span in text.split("\n[... 발췌 경계 ...]\n"):
            cursor = 0
            while cursor < len(span):
                end = min(cursor + 700, len(span))
                if end < len(span):
                    boundary = max(span.rfind("\n", cursor + 350, end), span.rfind(". ", cursor + 350, end))
                    if boundary >= 0:
                        end = boundary + 1
                quote = span[cursor:end].strip()
                cursor = end
                if len(quote) >= 12:
                    number += 1
                    packets[f"{code}:{number}"] = {"item": code, "text": quote}
    return packets


def resolve_draft(draft: DraftAnswer, packets: dict[str, dict]) -> Answer:
    invalid = []
    for finding in draft.findings:
        packet = packets.get(finding.evidence_id)
        if packet is None or packet["item"] != finding.item:
            actual = packet["item"] if packet else "missing"
            invalid.append(f"{finding.evidence_id}: requested Item {finding.item}, evidence Item {actual}")
    if invalid:
        raise ValueError("evidence_id는 같은 Item이어야 합니다. " + "; ".join(invalid))
    findings = []
    for finding in draft.findings:
        packet = packets[finding.evidence_id]
        findings.append(Finding(item=finding.item, heading=finding.heading, summary=finding.summary, quote=packet["text"]))
    return Answer(title=draft.title, findings=findings, limitations=draft.limitations)


def validate_answer(answer: Answer, evidence: dict[str, str]) -> None:
    compact = lambda value: re.sub(r"\s+", " ", value).strip()
    for finding in answer.findings:
        if finding.item not in evidence or compact(finding.quote) not in compact(evidence[finding.item]):
            raise ValueError(f"Item {finding.item} 인용문이 제공된 원문과 일치하지 않습니다.")


def evidence_for_question(source: dict, codes: list[str], question: str, budget: int = 180_000) -> dict[str, str]:
    """작은 Item은 모두 보존하고 큰 Item은 분산 발췌와 질문 키워드를 함께 사용한다."""
    selected = {code: source["sections"][code] for code in codes if code in source["sections"]}
    if not selected:
        raise ValueError("요청한 Item의 원문이 없습니다.")
    if sum(map(len, selected.values())) <= budget:
        return selected
    per_item = budget // len(selected)
    terms = set(re.findall(r"[a-z]{3,}", question.lower()))
    result = {}
    for code, text in selected.items():
        if len(text) <= per_item:
            result[code] = text
            continue
        chunks = [text[start:start + 4000] for start in range(0, len(text), 4000)]
        count = max(1, per_item // 4000)
        spread = {round(index * (len(chunks) - 1) / max(1, count // 2 - 1)) for index in range(max(1, count // 2))}
        ranked = sorted(range(len(chunks)), key=lambda index: sum(chunks[index].lower().count(term) for term in terms), reverse=True)
        for index in ranked:
            if len(spread) >= count:
                break
            spread.add(index)
        result[code] = "\n[... 발췌 경계 ...]\n".join(chunks[index] for index in sorted(spread))
    return result


def render_program(answer: Answer, source: dict, evidence: dict[str, str]) -> str:
    literal = lambda value: json.dumps(value, ensure_ascii=False)
    filing = source["filing"]
    provenance = f"CIK {filing['cik']} · 10-K {filing['accessionNo']} · 제출 {filing.get('filingDate')}"
    if source.get("issuerNote"):
        provenance += " · " + source["issuerNote"]
    freshness = f"SEC 동기화 확인: {source['checkedAt']}" if source["checkedAt"] else "저장 문서 기준 · SEC 최신성 미확인"
    coverage = "; ".join(f"Item {code}: {len(text):,}/{len(source['sections'][code]):,}자" for code, text in evidence.items())
    rows = [{"item": f"Item {f.item} · {ITEMS[f.item]}", "heading": f.heading, "summary": f.summary, "quote": f.quote} for f in answer.findings]
    return "\n".join([
        'root = Col([Title(title, "xl"), Text(provenance, "sm", "muted"), Link("SEC 원문 공시", sourceUrl), Text(freshness, "sm"), Text(coverage, "xs", "muted"), Checkbox($showEvidence, "원문 인용 표시"), findings, Card([Title("분석 범위와 한계", "sm"), Text(limitations, "sm")])], 4)',
        '$showEvidence = true',
        'findings = Col(@Each(rows, "r", Card(@Concat([Badge(r.item, "info"), Title(r.heading, "md"), Text(r.summary, "md")], $showEvidence ? [Text(r.quote, "sm", "muted")] : []))), 3)',
        f'title = {literal(answer.title)}', f'provenance = {literal(provenance)}',
        f'sourceUrl = {literal(source["sourceUrl"])}', f'freshness = {literal(freshness)}',
        f'coverage = {literal(coverage)}', f'rows = {literal(rows)}',
        f'limitations = {literal(answer.limitations or "원문에 기재된 사실과 모델 요약을 구분해서 확인하세요.")}',
    ])
