from __future__ import annotations

import json
import re
from statistics import pstdev
from typing import Any

from langchain_core.messages import HumanMessage, SystemMessage

from agentic_design_patterns.patterns.chapter_21_exploration_and_discovery.prompts import (
    CONTEXT_SYSTEM_PROMPT,
    CONTEXT_USER_PROMPT,
    EVOLVE_SYSTEM_PROMPT,
    EVOLVE_USER_PROMPT,
    HYPOTHESIS_SYSTEM_PROMPT,
    HYPOTHESIS_USER_PROMPT,
    REVIEW_SYSTEM_PROMPT,
    REVIEW_USER_PROMPT,
)
from agentic_design_patterns.patterns.chapter_21_exploration_and_discovery.state import (
    EvidenceItem,
    ExplorationDiscoveryState,
    Hypothesis,
    ReviewResult,
)
from agentic_design_patterns.shared.models import get_chat_model


DEFAULT_THRESHOLDS = {
    "novelty": 0.55,
    "plausibility": 0.6,
    "evidence": 0.45,
    "feasibility": 0.55,
    "safety": 0.8,
}
HIGH_IMPACT_DOMAINS = {"biomedical", "medical", "security", "finance", "legal", "physical"}
DEFAULT_DISALLOWED_TERMS = {
    "weapon",
    "malware",
    "phishing",
    "exploit",
    "bypass authentication",
    "evade detection",
}
REVIEW_SCORE_KEYS = ("novelty", "plausibility", "evidence", "feasibility", "safety")


def prepare_discovery_task(state: ExplorationDiscoveryState) -> dict[str, Any]:
    goal = _clean_text(state.get("research_goal") or state.get("input") or "")
    domain = _clean_text(state.get("domain") or "general").lower()
    errors: list[str] = []

    if not goal:
        errors.append("research_goal is required.")

    max_iterations = _nonnegative_int(state.get("max_iterations"), default=1)
    thresholds = dict(DEFAULT_THRESHOLDS)
    thresholds.update(_coerce_thresholds(state.get("quality_thresholds", {})))

    updates: dict[str, Any] = {
        "input": _clean_text(state.get("input") or goal),
        "research_goal": goal,
        "domain": domain,
        "constraints": dict(state.get("constraints", {}) or {}),
        "safety_policy": dict(state.get("safety_policy", {}) or {}),
        "seed_context": _coerce_str_list(state.get("seed_context", [])),
        "evidence_items": _normalize_evidence_items(state.get("evidence_items", [])),
        "context_summary": "",
        "knowledge_gaps": [],
        "exploration_questions": [],
        "candidate_hypotheses": [],
        "review_results": [],
        "ranked_hypotheses": [],
        "hypothesis_clusters": [],
        "evolved_hypotheses": [],
        "selected_hypotheses": [],
        "validation_plan": [],
        "human_feedback": state.get("human_feedback"),
        "safety_findings": [],
        "iteration_count": _nonnegative_int(state.get("iteration_count"), default=0),
        "max_iterations": max_iterations,
        "quality_thresholds": thresholds,
        "needs_human_review": False,
        "discovery_status": "ready",
        "errors": errors,
        "discovery_brief": None,
    }
    if errors:
        updates["discovery_status"] = "failed"
    return updates


def safety_screen_goal(state: ExplorationDiscoveryState) -> dict[str, Any]:
    if state.get("discovery_status") == "failed":
        return {}

    policy = state.get("safety_policy", {})
    goal = state.get("research_goal", "").lower()
    domain = state.get("domain", "general").lower()
    disallowed_terms = set(policy.get("disallowed_terms", DEFAULT_DISALLOWED_TERMS))
    high_impact_domains = set(policy.get("high_impact_domains", HIGH_IMPACT_DOMAINS))
    findings = list(state.get("safety_findings", []))
    needs_human_review = bool(state.get("needs_human_review", False))
    blocked = False

    for term in disallowed_terms:
        if str(term).lower() in goal:
            findings.append(
                {
                    "type": "blocked_goal",
                    "term": str(term),
                    "message": f"Goal contains disallowed exploration term: {term}.",
                }
            )
            blocked = True

    if domain in high_impact_domains and not policy.get("allow_autonomous_high_impact", False):
        findings.append(
            {
                "type": "high_impact_domain",
                "domain": domain,
                "message": "High-impact discovery requires human review.",
            }
        )
        needs_human_review = True

    status = "blocked" if blocked else state.get("discovery_status", "ready")
    return {
        "safety_findings": findings,
        "needs_human_review": needs_human_review,
        "discovery_status": status,
    }


def explore_context(state: ExplorationDiscoveryState) -> dict[str, Any]:
    evidence = list(state.get("evidence_items", []))
    for index, text in enumerate(state.get("seed_context", []), start=len(evidence) + 1):
        evidence.append(
            {
                "id": f"seed-{index}",
                "source": "seed_context",
                "claim": text,
                "relevance": 0.7,
                "confidence": 0.5,
            }
        )

    sparse_note = ""
    if not evidence:
        sparse_note = " Evidence is sparse; hypotheses must be treated as speculative."

    try:
        payload = _invoke_json(
            CONTEXT_SYSTEM_PROMPT,
            CONTEXT_USER_PROMPT.format(
                research_goal=state.get("research_goal", ""),
                domain=state.get("domain", "general"),
                constraints=json.dumps(state.get("constraints", {}), sort_keys=True),
                seed_context=json.dumps(state.get("seed_context", []), sort_keys=True),
            ),
        )
        summary = _clean_text(payload.get("context_summary", ""))
        gaps = _coerce_str_list(payload.get("knowledge_gaps", []))
        questions = _coerce_str_list(payload.get("exploration_questions", []))
    except ValueError as exc:
        summary = _fallback_context_summary(state, evidence)
        gaps = ["Model context summary was malformed; verify evidence manually."]
        questions = [f"What missing evidence would most change confidence in {state.get('research_goal', 'the goal')}?"]
        return {
            "evidence_items": evidence,
            "context_summary": summary + sparse_note,
            "knowledge_gaps": gaps,
            "exploration_questions": questions,
            "errors": [*state.get("errors", []), str(exc)],
        }

    if not summary:
        summary = _fallback_context_summary(state, evidence)
    return {
        "evidence_items": evidence,
        "context_summary": summary + sparse_note,
        "knowledge_gaps": gaps,
        "exploration_questions": questions,
    }


def identify_knowledge_gaps(state: ExplorationDiscoveryState) -> dict[str, Any]:
    gaps = list(state.get("knowledge_gaps", []))
    questions = list(state.get("exploration_questions", []))
    if not state.get("evidence_items"):
        gaps.append("No local evidence was supplied.")
        questions.append("What direct observations or records can validate the first hypothesis?")
    if not gaps:
        gaps.append("Potential alternative explanations are not yet ruled out.")
    if not questions:
        questions.append("Which assumption would be cheapest to test first?")
    return {
        "knowledge_gaps": _dedupe_strings(gaps),
        "exploration_questions": _dedupe_strings(questions),
    }


def generate_hypotheses(state: ExplorationDiscoveryState) -> dict[str, Any]:
    try:
        payload = _invoke_json(
            HYPOTHESIS_SYSTEM_PROMPT,
            HYPOTHESIS_USER_PROMPT.format(
                research_goal=state.get("research_goal", ""),
                context_summary=state.get("context_summary", ""),
                evidence_items=json.dumps(state.get("evidence_items", []), sort_keys=True),
                knowledge_gaps=json.dumps(state.get("knowledge_gaps", []), sort_keys=True),
            ),
        )
    except ValueError as exc:
        return {
            "errors": [*state.get("errors", []), str(exc)],
            "discovery_status": "needs_review",
            "needs_human_review": True,
        }

    hypotheses = _normalize_hypotheses(payload.get("hypotheses", []))
    if not hypotheses:
        return {
            "errors": [*state.get("errors", []), "No hypotheses were generated."],
            "discovery_status": "failed",
        }
    return {"candidate_hypotheses": hypotheses}


def review_hypotheses(state: ExplorationDiscoveryState) -> dict[str, Any]:
    hypotheses = state.get("evolved_hypotheses") or state.get("candidate_hypotheses", [])
    if not hypotheses:
        return {
            "errors": [*state.get("errors", []), "No hypotheses are available for review."],
            "discovery_status": "failed",
        }

    try:
        payload = _invoke_json(
            REVIEW_SYSTEM_PROMPT,
            REVIEW_USER_PROMPT.format(
                quality_thresholds=json.dumps(state.get("quality_thresholds", {}), sort_keys=True),
                hypotheses=json.dumps(hypotheses, sort_keys=True),
            ),
        )
    except ValueError as exc:
        return {
            "errors": [*state.get("errors", []), str(exc)],
            "discovery_status": "needs_review",
            "needs_human_review": True,
        }

    reviews = _normalize_reviews(payload.get("reviews", []), state.get("quality_thresholds", {}))
    if not reviews:
        return {
            "errors": [*state.get("errors", []), "No review results were generated."],
            "discovery_status": "failed",
        }
    return {"review_results": reviews}


def rank_hypotheses(state: ExplorationDiscoveryState) -> dict[str, Any]:
    hypotheses = state.get("evolved_hypotheses") or state.get("candidate_hypotheses", [])
    by_id = {item.get("id", ""): item for item in hypotheses}
    ranked: list[dict[str, Any]] = []
    safety_findings = list(state.get("safety_findings", []))

    for review in state.get("review_results", []):
        hypothesis_id = review.get("hypothesis_id", "")
        hypothesis = by_id.get(hypothesis_id)
        if not hypothesis:
            continue
        aggregate = _aggregate_review_score(review)
        passes = _passes_thresholds(review, state.get("quality_thresholds", {}))
        if review.get("safety", 1.0) < state.get("quality_thresholds", {}).get("safety", 0.8):
            safety_findings.append(
                {
                    "type": "hypothesis_safety",
                    "hypothesis_id": hypothesis_id,
                    "message": "Hypothesis safety score is below threshold.",
                }
            )
        ranked.append(
            {
                "hypothesis": hypothesis,
                "review": {**review, "aggregate_score": aggregate, "passes_thresholds": passes},
                "aggregate_score": aggregate,
                "passes_thresholds": passes,
                "rank_rationale": review.get("critique", ""),
            }
        )

    ranked.sort(key=lambda item: item["aggregate_score"], reverse=True)
    return {"ranked_hypotheses": ranked, "safety_findings": safety_findings}


def cluster_hypotheses(state: ExplorationDiscoveryState) -> dict[str, Any]:
    clusters: dict[str, list[dict[str, Any]]] = {}
    selected: list[Hypothesis] = []
    seen_titles: set[str] = set()

    for item in state.get("ranked_hypotheses", []):
        hypothesis = item.get("hypothesis", {})
        cluster_name = _clean_text(hypothesis.get("cluster", "")) or _title_key(hypothesis.get("title", ""))
        clusters.setdefault(cluster_name, []).append(item)
        title_key = _title_key(hypothesis.get("title", ""))
        if item.get("passes_thresholds") and title_key not in seen_titles:
            selected.append(hypothesis)
            seen_titles.add(title_key)

    cluster_list = [
        {
            "cluster": name,
            "hypothesis_ids": [entry.get("hypothesis", {}).get("id") for entry in entries],
            "representative_id": entries[0].get("hypothesis", {}).get("id") if entries else None,
        }
        for name, entries in clusters.items()
    ]
    return {"hypothesis_clusters": cluster_list, "selected_hypotheses": selected[:3]}


def decide_refinement(state: ExplorationDiscoveryState) -> dict[str, Any]:
    if state.get("discovery_status") in {"failed", "needs_review"}:
        return {}

    needs_review = bool(state.get("needs_human_review")) or _has_reviewer_disagreement(state)
    if needs_review:
        return {"needs_human_review": True, "discovery_status": "needs_review"}

    selected = state.get("selected_hypotheses", [])
    if selected:
        return {"discovery_status": "ready"}

    if state.get("iteration_count", 0) < state.get("max_iterations", 1):
        return {"discovery_status": "ready"}

    return {
        "discovery_status": "failed",
        "errors": [*state.get("errors", []), "No hypotheses met quality thresholds."],
    }


def evolve_hypotheses(state: ExplorationDiscoveryState) -> dict[str, Any]:
    try:
        payload = _invoke_json(
            EVOLVE_SYSTEM_PROMPT,
            EVOLVE_USER_PROMPT.format(
                ranked_hypotheses=json.dumps(state.get("ranked_hypotheses", [])[:3], sort_keys=True),
                review_results=json.dumps(state.get("review_results", []), sort_keys=True),
            ),
        )
    except ValueError as exc:
        return {
            "errors": [*state.get("errors", []), str(exc)],
            "discovery_status": "needs_review",
            "needs_human_review": True,
        }

    evolved = _normalize_hypotheses(payload.get("hypotheses", []))
    return {
        "evolved_hypotheses": evolved,
        "candidate_hypotheses": evolved or state.get("candidate_hypotheses", []),
        "iteration_count": state.get("iteration_count", 0) + 1,
    }


def plan_validation_steps(state: ExplorationDiscoveryState) -> dict[str, Any]:
    plan = []
    for hypothesis in state.get("selected_hypotheses", []):
        title = hypothesis.get("title", "Selected hypothesis")
        plan.append(
            {
                "hypothesis": title,
                "next_step": f"Collect targeted evidence that would confirm or refute: {title}.",
                "success_signal": "The new evidence materially changes reviewer confidence.",
            }
        )
    return {"validation_plan": plan, "discovery_status": "completed"}


def request_human_review(state: ExplorationDiscoveryState) -> dict[str, Any]:
    feedback = state.get("human_feedback") or {}
    status = "needs_review"
    selected = list(state.get("selected_hypotheses", []))
    if feedback.get("approved") and selected:
        status = "completed"
    return {
        "needs_human_review": True,
        "discovery_status": status,
        "selected_hypotheses": selected,
    }


def finalize_discovery_brief(state: ExplorationDiscoveryState) -> dict[str, Any]:
    status = state.get("discovery_status", "failed")
    if status == "ready":
        status = "completed" if state.get("selected_hypotheses") else "failed"

    limitations = list(state.get("knowledge_gaps", []))
    if not state.get("evidence_items"):
        limitations.append("Evidence is sparse; selected hypotheses are speculative.")

    brief = {
        "status": status,
        "summary": _brief_summary(status, state),
        "selected_hypotheses": state.get("selected_hypotheses", []),
        "ranked_hypotheses": state.get("ranked_hypotheses", []),
        "hypothesis_clusters": state.get("hypothesis_clusters", []),
        "validation_plan": state.get("validation_plan", []),
        "limitations": _dedupe_strings(limitations),
        "safety_notes": state.get("safety_findings", []),
        "needs_human_review": bool(state.get("needs_human_review", False)),
        "errors": state.get("errors", []),
    }
    return {"discovery_status": status, "discovery_brief": brief}


def _invoke_json(system_prompt: str, user_prompt: str) -> dict[str, Any]:
    response = get_chat_model().invoke(
        [SystemMessage(content=system_prompt), HumanMessage(content=user_prompt)]
    )
    content = getattr(response, "content", response)
    if isinstance(content, list):
        content = " ".join(str(part) for part in content)
    try:
        parsed = json.loads(str(content))
    except json.JSONDecodeError as exc:
        raise ValueError(f"Malformed model JSON: {exc.msg}") from exc
    if not isinstance(parsed, dict):
        raise ValueError("Malformed model JSON: expected an object.")
    return parsed


def _normalize_evidence_items(raw_items: Any) -> list[EvidenceItem]:
    if not isinstance(raw_items, list):
        return []
    normalized: list[EvidenceItem] = []
    for index, item in enumerate(raw_items, start=1):
        if isinstance(item, str):
            normalized.append(
                {
                    "id": f"e{index}",
                    "source": "provided",
                    "claim": item,
                    "relevance": 0.7,
                    "confidence": 0.5,
                }
            )
        elif isinstance(item, dict):
            normalized.append(
                {
                    "id": _clean_text(item.get("id") or f"e{index}"),
                    "source": _clean_text(item.get("source") or "provided"),
                    "claim": _clean_text(item.get("claim") or item.get("text") or ""),
                    "relevance": _score(item.get("relevance"), 0.7),
                    "confidence": _score(item.get("confidence"), 0.5),
                }
            )
    return [item for item in normalized if item.get("claim")]


def _normalize_hypotheses(raw_items: Any) -> list[Hypothesis]:
    if not isinstance(raw_items, list):
        return []
    hypotheses: list[Hypothesis] = []
    for index, item in enumerate(raw_items, start=1):
        if not isinstance(item, dict):
            continue
        title = _clean_text(item.get("title", ""))
        if not title:
            continue
        hypotheses.append(
            {
                "id": _clean_text(item.get("id") or f"h{index}"),
                "title": title,
                "rationale": _clean_text(item.get("rationale", "")),
                "evidence_refs": _coerce_str_list(item.get("evidence_refs", [])),
                "assumptions": _coerce_str_list(item.get("assumptions", [])),
                "risks": _coerce_str_list(item.get("risks", [])),
                "cluster": _clean_text(item.get("cluster", "")),
                "revision_note": _clean_text(item.get("revision_note", "")),
            }
        )
    return hypotheses


def _normalize_reviews(raw_items: Any, thresholds: dict[str, float]) -> list[ReviewResult]:
    if not isinstance(raw_items, list):
        return []
    reviews: list[ReviewResult] = []
    for item in raw_items:
        if not isinstance(item, dict):
            continue
        review: ReviewResult = {
            "hypothesis_id": _clean_text(item.get("hypothesis_id", "")),
            "novelty": _score(item.get("novelty"), 0.5),
            "plausibility": _score(item.get("plausibility"), 0.5),
            "evidence": _score(item.get("evidence"), 0.5),
            "feasibility": _score(item.get("feasibility"), 0.5),
            "impact": _score(item.get("impact"), 0.5),
            "clarity": _score(item.get("clarity"), 0.5),
            "safety": _score(item.get("safety"), 1.0),
            "critique": _clean_text(item.get("critique", "")),
            "reviewer_scores": [_score(score, 0.5) for score in item.get("reviewer_scores", [])]
            if isinstance(item.get("reviewer_scores", []), list)
            else [],
        }
        review["aggregate_score"] = _aggregate_review_score(review)
        review["passes_thresholds"] = _passes_thresholds(review, thresholds)
        if review["hypothesis_id"]:
            reviews.append(review)
    return reviews


def _passes_thresholds(review: dict[str, Any], thresholds: dict[str, float]) -> bool:
    return all(float(review.get(key, 0.0)) >= thresholds.get(key, 0.0) for key in REVIEW_SCORE_KEYS)


def _aggregate_review_score(review: dict[str, Any]) -> float:
    scores = [float(review.get(key, 0.0)) for key in REVIEW_SCORE_KEYS]
    scores.extend([float(review.get("impact", 0.0)), float(review.get("clarity", 0.0))])
    return round(sum(scores) / len(scores), 3)


def _has_reviewer_disagreement(state: ExplorationDiscoveryState) -> bool:
    for review in state.get("review_results", []):
        scores = review.get("reviewer_scores", [])
        if len(scores) >= 2 and pstdev(scores) >= 0.25:
            return True
    return False


def _fallback_context_summary(
    state: ExplorationDiscoveryState, evidence: list[EvidenceItem]
) -> str:
    if not evidence:
        return f"No local evidence was provided for: {state.get('research_goal', '')}."
    claims = "; ".join(item.get("claim", "") for item in evidence[:3])
    return f"Local evidence themes: {claims}"


def _brief_summary(status: str, state: ExplorationDiscoveryState) -> str:
    if status == "blocked":
        return "The exploration goal was blocked by the configured safety policy."
    if status == "needs_review":
        return "The discovery workflow requires human review before use."
    if status == "completed":
        return f"{len(state.get('selected_hypotheses', []))} hypothesis candidate(s) were selected for validation."
    return "The discovery workflow did not produce usable hypotheses."


def _coerce_thresholds(raw: Any) -> dict[str, float]:
    if not isinstance(raw, dict):
        return {}
    return {str(key): _score(value, DEFAULT_THRESHOLDS.get(str(key), 0.5)) for key, value in raw.items()}


def _coerce_str_list(raw: Any) -> list[str]:
    if not isinstance(raw, list):
        return []
    return [_clean_text(item) for item in raw if _clean_text(item)]


def _dedupe_strings(items: list[str]) -> list[str]:
    seen = set()
    deduped = []
    for item in items:
        key = item.lower()
        if key not in seen:
            seen.add(key)
            deduped.append(item)
    return deduped


def _clean_text(value: Any) -> str:
    return re.sub(r"\s+", " ", str(value or "")).strip()


def _title_key(title: str) -> str:
    words = re.findall(r"[a-z0-9]+", title.lower())
    return " ".join(words[:6])


def _score(value: Any, default: float) -> float:
    try:
        return max(0.0, min(1.0, float(value)))
    except (TypeError, ValueError):
        return default


def _nonnegative_int(value: Any, default: int) -> int:
    try:
        return max(0, int(value))
    except (TypeError, ValueError):
        return default
