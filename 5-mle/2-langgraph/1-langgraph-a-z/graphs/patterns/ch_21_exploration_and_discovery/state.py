from __future__ import annotations

from typing import Any, Literal, TypedDict


DiscoveryStatus = Literal["ready", "blocked", "needs_review", "completed", "failed"]


class EvidenceItem(TypedDict, total=False):
    id: str
    source: str
    claim: str
    relevance: float
    confidence: float


class Hypothesis(TypedDict, total=False):
    id: str
    title: str
    rationale: str
    evidence_refs: list[str]
    assumptions: list[str]
    risks: list[str]
    cluster: str
    revision_note: str


class ReviewResult(TypedDict, total=False):
    hypothesis_id: str
    novelty: float
    plausibility: float
    evidence: float
    feasibility: float
    impact: float
    clarity: float
    safety: float
    critique: str
    reviewer_scores: list[float]
    aggregate_score: float
    passes_thresholds: bool


class ExplorationDiscoveryState(TypedDict, total=False):
    input: str
    research_goal: str
    domain: str
    constraints: dict[str, Any]
    safety_policy: dict[str, Any]
    seed_context: list[str]
    evidence_items: list[EvidenceItem]
    context_summary: str
    knowledge_gaps: list[str]
    exploration_questions: list[str]
    candidate_hypotheses: list[Hypothesis]
    review_results: list[ReviewResult]
    ranked_hypotheses: list[dict[str, Any]]
    hypothesis_clusters: list[dict[str, Any]]
    evolved_hypotheses: list[Hypothesis]
    selected_hypotheses: list[Hypothesis]
    validation_plan: list[dict[str, Any]]
    human_feedback: dict[str, Any] | None
    safety_findings: list[dict[str, Any]]
    iteration_count: int
    max_iterations: int
    quality_thresholds: dict[str, float]
    needs_human_review: bool
    discovery_status: DiscoveryStatus
    errors: list[str]
    discovery_brief: dict[str, Any] | None

