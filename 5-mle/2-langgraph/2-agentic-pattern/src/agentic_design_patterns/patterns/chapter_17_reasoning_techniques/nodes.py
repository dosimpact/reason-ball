from __future__ import annotations

import ast
import operator
import re
from typing import Any

from langchain_core.messages import HumanMessage, SystemMessage

from agentic_design_patterns.patterns.chapter_17_reasoning_techniques.prompts import (
    CORRECTION_SYSTEM_PROMPT,
    CORRECTION_USER_PROMPT,
    SYNTHESIS_SYSTEM_PROMPT,
    SYNTHESIS_USER_PROMPT,
)
from agentic_design_patterns.patterns.chapter_17_reasoning_techniques.state import (
    ReasoningAction,
    ReasoningTechniquesState,
)
from agentic_design_patterns.shared.models import get_chat_model


DEFAULT_BUDGETS: dict[str, dict[str, int]] = {
    "minimal": {
        "branches": 1,
        "reflection_rounds": 1,
        "retrieval_calls": 1,
        "computation_calls": 1,
    },
    "standard": {
        "branches": 2,
        "reflection_rounds": 2,
        "retrieval_calls": 3,
        "computation_calls": 1,
    },
    "deep": {
        "branches": 3,
        "reflection_rounds": 3,
        "retrieval_calls": 5,
        "computation_calls": 2,
    },
}

DEFAULT_KNOWLEDGE_BASE: list[dict[str, Any]] = [
    {
        "id": "kb_quantum_bits",
        "topics": ["classical", "quantum", "bits", "qubits", "representation"],
        "claim": "Classical computers use bits that are 0 or 1, while quantum computers use qubits.",
        "confidence": 0.95,
    },
    {
        "id": "kb_quantum_superposition",
        "topics": ["quantum", "superposition", "entanglement", "processing"],
        "claim": "Qubits can represent superposition states and quantum algorithms can exploit entanglement.",
        "confidence": 0.9,
    },
    {
        "id": "kb_quantum_applications",
        "topics": ["quantum", "application", "applications", "molecular", "drug", "simulation"],
        "claim": "Molecular simulation for drug discovery is a common quantum computing application area.",
        "confidence": 0.9,
    },
    {
        "id": "kb_reasoning_cot",
        "topics": ["reasoning", "chain", "thought", "decomposition"],
        "claim": "Chain-of-Thought style workflows decompose a problem into intermediate reasoning steps.",
        "confidence": 0.88,
    },
    {
        "id": "kb_react",
        "topics": ["reasoning", "react", "tools", "observation"],
        "claim": "ReAct interleaves reasoning, tool actions, and observations to adapt the next step.",
        "confidence": 0.88,
    },
]

STOPWORDS = {
    "a",
    "about",
    "and",
    "are",
    "as",
    "between",
    "compare",
    "does",
    "for",
    "how",
    "in",
    "is",
    "it",
    "name",
    "of",
    "one",
    "the",
    "to",
    "useful",
    "what",
    "while",
    "with",
}


def prepare_question(state: ReasoningTechniquesState) -> dict[str, Any]:
    normalized_input = _normalize_text(state.get("input", ""))
    depth, depth_error = _normalize_depth(state.get("reasoning_depth", "standard"))
    budget = _merge_budget(depth, state.get("reasoning_budget", {}))
    errors = [depth_error] if depth_error else []
    status = "ok" if normalized_input else "invalid_input"
    if not normalized_input:
        errors.append("Input is empty.")

    return {
        "normalized_input": normalized_input,
        "reasoning_depth": depth,
        "reasoning_budget": budget,
        "budget_used": {
            "branches": 0,
            "reflection_rounds": 0,
            "retrieval_calls": 0,
            "computation_calls": 0,
            "model_calls": 0,
        },
        "subquestions": [],
        "candidate_branches": [],
        "selected_branch_id": None,
        "action_plan": [],
        "next_action": None,
        "observations": [],
        "supporting_evidence": [],
        "contradictions": [],
        "knowledge_gaps": [],
        "computation_requests": [],
        "computation_results": [],
        "draft_answer": None,
        "critique": None,
        "revised_answer": None,
        "reasoning_summary": None,
        "answer_ready": False,
        "budget_exhausted": False,
        "status": status,
        "errors": errors,
        "final_output": None,
        "allow_computation": bool(state.get("allow_computation", True)),
        "classification": {},
    }


def classify_reasoning_need(state: ReasoningTechniquesState) -> dict[str, Any]:
    text = state.get("normalized_input", "")
    tokens = _keywords(text)
    needs_computation = _extract_expression(text) is not None
    needs_retrieval = any(
        token in tokens
        for token in {
            "application",
            "applications",
            "classical",
            "compare",
            "quantum",
            "reasoning",
            "react",
        }
    )
    simple = len(tokens) <= 5 and not needs_computation and not needs_retrieval
    return {
        "classification": {
            "simple": simple,
            "needs_retrieval": needs_retrieval,
            "needs_computation": needs_computation,
            "needs_branching": not simple,
        }
    }


def decompose_question(state: ReasoningTechniquesState) -> dict[str, Any]:
    text = state.get("normalized_input", "")
    subquestions: list[dict[str, Any]] = []
    if any(word in text.lower() for word in ["compare", "difference", "versus", " vs "]):
        subquestions.extend(
            [
                _subquestion("representation", "Explain the core representations.", "representation"),
                _subquestion("processing", "Explain the processing model.", "processing"),
            ]
        )
    if any(word in text.lower() for word in ["application", "use case", "useful"]):
        subquestions.append(
            _subquestion("application", "Identify one supported application.", "application")
        )
    if "reasoning" in text.lower() or "react" in text.lower():
        subquestions.extend(
            [
                _subquestion("reasoning", "Explain the reasoning technique.", "reasoning"),
                _subquestion("tool_use", "Explain how tool observations guide the next step.", "react"),
            ]
        )
    expression = _extract_expression(text)
    if expression:
        subquestions.append(
            {
                "id": "computation",
                "question": f"Compute {expression}.",
                "topic": "computation",
                "needs_evidence": False,
                "needs_computation": True,
                "resolved": False,
            }
        )
    if not subquestions:
        subquestions.append(_subquestion("direct", text, "general"))
    return {"subquestions": _dedupe_subquestions(subquestions)}


def generate_reasoning_branches(state: ReasoningTechniquesState) -> dict[str, Any]:
    subquestions = state.get("subquestions", [])
    max_branches = state.get("reasoning_budget", {}).get("branches", 2)
    branch_templates = [
        ("branch_decomposition_first", "Resolve each subquestion with evidence before synthesis.", "coverage"),
        ("branch_evidence_first", "Gather strongest fixture evidence, then map it to subquestions.", "evidence"),
        ("branch_compute_first", "Verify symbolic or numeric parts before factual synthesis.", "computation"),
    ]
    branches = [
        {
            "id": branch_id,
            "strategy": strategy,
            "focus": focus,
            "subquestion_ids": [item["id"] for item in subquestions],
        }
        for branch_id, strategy, focus in branch_templates[: max(1, int(max_branches))]
    ]
    used = dict(state.get("budget_used", {}))
    used["branches"] = len(branches)
    return {
        "candidate_branches": branches,
        "selected_branch_id": branches[0]["id"] if branches else None,
        "budget_used": used,
    }


def select_next_action(state: ReasoningTechniquesState) -> dict[str, Any]:
    budget = state.get("reasoning_budget", {})
    used = state.get("budget_used", {})
    for subquestion in state.get("subquestions", []):
        if subquestion.get("resolved"):
            continue
        if subquestion.get("needs_computation"):
            if not state.get("allow_computation", True):
                return {
                    "next_action": {
                        "type": "compute",
                        "subquestion_id": subquestion["id"],
                        "expression": _extract_expression(subquestion["question"]) or "",
                        "reason": "Computation is required but disabled.",
                    }
                }
            if used.get("computation_calls", 0) < budget.get("computation_calls", 1):
                return {
                    "next_action": {
                        "type": "compute",
                        "subquestion_id": subquestion["id"],
                        "expression": _extract_expression(subquestion["question"]) or "",
                        "reason": "PALM-style local computation can verify this part.",
                    }
                }
        if subquestion.get("needs_evidence") and used.get("retrieval_calls", 0) < budget.get("retrieval_calls", 1):
            return {
                "next_action": {
                    "type": "retrieve",
                    "subquestion_id": subquestion["id"],
                    "query": f"{state.get('normalized_input', '')} {subquestion.get('topic', '')}",
                    "reason": "Retrieve fixture-backed evidence for an unresolved subquestion.",
                }
            }
    return {"next_action": {"type": "synthesize", "reason": "No useful tool action remains."}}


def retrieve_evidence(state: ReasoningTechniquesState) -> dict[str, Any]:
    action = state.get("next_action") or {}
    used = dict(state.get("budget_used", {}))
    used["retrieval_calls"] = used.get("retrieval_calls", 0) + 1
    errors = list(state.get("errors", []))
    observations = list(state.get("observations", []))
    evidence = list(state.get("supporting_evidence", []))
    try:
        records = _call_retriever(state, action)
    except Exception as exc:
        errors.append(f"Retrieval failed for {action.get('subquestion_id')}: {exc}")
        observations.append(
            {
                "type": "retrieval",
                "subquestion_id": action.get("subquestion_id", ""),
                "status": "error",
                "query": action.get("query", ""),
                "message": str(exc),
            }
        )
        return {"budget_used": used, "errors": errors, "observations": observations, "status": "tool_error"}

    for record in records:
        normalized = _normalize_evidence(record)
        if normalized and normalized["id"] not in {item["id"] for item in evidence}:
            evidence.append(normalized)
    observations.append(
        {
            "type": "retrieval",
            "subquestion_id": action.get("subquestion_id", ""),
            "status": "ok" if records else "missing",
            "query": action.get("query", ""),
            "result": records,
        }
    )
    return {"budget_used": used, "observations": observations, "supporting_evidence": evidence}


def execute_computation(state: ReasoningTechniquesState) -> dict[str, Any]:
    action = state.get("next_action") or {}
    used = dict(state.get("budget_used", {}))
    used["computation_calls"] = used.get("computation_calls", 0) + 1
    errors = list(state.get("errors", []))
    observations = list(state.get("observations", []))
    requests = [*state.get("computation_requests", []), dict(action)]
    results = list(state.get("computation_results", []))
    expression = str(action.get("expression") or "")

    if not state.get("allow_computation", True):
        errors.append("Computation is disabled for this run.")
        observations.append({"type": "computation", "subquestion_id": action.get("subquestion_id", ""), "status": "disabled"})
        return {"budget_used": used, "errors": errors, "observations": observations, "computation_requests": requests}

    try:
        tool = state.get("computation_tool") or safe_arithmetic
        value = tool(expression)
        result = {"subquestion_id": action.get("subquestion_id", ""), "expression": expression, "result": value}
        results.append(result)
        observations.append({"type": "computation", "subquestion_id": action.get("subquestion_id", ""), "status": "ok", "result": result})
    except Exception as exc:
        errors.append(f"Computation failed for {expression!r}: {exc}")
        observations.append({"type": "computation", "subquestion_id": action.get("subquestion_id", ""), "status": "error", "message": str(exc)})
    return {"budget_used": used, "errors": errors, "observations": observations, "computation_requests": requests, "computation_results": results}


def record_observation(state: ReasoningTechniquesState) -> dict[str, Any]:
    subquestions = [dict(item) for item in state.get("subquestions", [])]
    evidence_by_topic = _evidence_topics(state.get("supporting_evidence", []))
    computation_ids = {item.get("subquestion_id") for item in state.get("computation_results", [])}
    for item in subquestions:
        if item.get("needs_computation"):
            item["resolved"] = item["id"] in computation_ids
        elif item.get("needs_evidence"):
            item["resolved"] = item.get("topic") in evidence_by_topic
        else:
            item["resolved"] = True
    return {
        "subquestions": subquestions,
        "contradictions": _detect_contradictions(state.get("supporting_evidence", [])),
        "action_plan": [*state.get("action_plan", []), state.get("next_action") or {}],
        "next_action": None,
    }


def reflect_on_progress(state: ReasoningTechniquesState) -> dict[str, Any]:
    used = dict(state.get("budget_used", {}))
    used["reflection_rounds"] = used.get("reflection_rounds", 0) + 1
    gaps = [
        item["question"]
        for item in state.get("subquestions", [])
        if not item.get("resolved")
    ]
    budget = state.get("reasoning_budget", {})
    exhausted = (
        used["reflection_rounds"] >= budget.get("reflection_rounds", 1)
        or used.get("retrieval_calls", 0) >= budget.get("retrieval_calls", 1)
        and any(item.get("needs_evidence") and not item.get("resolved") for item in state.get("subquestions", []))
        or used.get("computation_calls", 0) >= budget.get("computation_calls", 1)
        and any(item.get("needs_computation") and not item.get("resolved") for item in state.get("subquestions", []))
    )
    contradictions = state.get("contradictions", [])
    answer_ready = not gaps and not contradictions
    status = state.get("status", "ok")
    if contradictions:
        status = "partial"
    elif gaps and exhausted:
        status = "partial" if state.get("supporting_evidence") or state.get("computation_results") else "insufficient_evidence"
    return {
        "budget_used": used,
        "knowledge_gaps": gaps,
        "budget_exhausted": bool(exhausted and gaps),
        "answer_ready": answer_ready,
        "status": status,
    }


def synthesize_answer(state: ReasoningTechniquesState) -> dict[str, Any]:
    evidence = state.get("supporting_evidence", [])
    computations = state.get("computation_results", [])
    gaps = state.get("knowledge_gaps", [])
    used = dict(state.get("budget_used", {}))
    if evidence or computations:
        try:
            model = get_chat_model()
            response = model.invoke(
                [
                    SystemMessage(content=SYNTHESIS_SYSTEM_PROMPT),
                    HumanMessage(
                        content=SYNTHESIS_USER_PROMPT.format(
                            question=state.get("normalized_input", ""),
                            evidence=evidence,
                            computations=computations,
                            gaps=gaps,
                        )
                    ),
                ]
            )
            used["model_calls"] = used.get("model_calls", 0) + 1
            draft = str(response.content)
        except Exception as exc:
            draft = _fallback_answer(state)
            return {
                "draft_answer": draft,
                "budget_used": used,
                "errors": [*state.get("errors", []), f"Synthesis model failed: {exc}"],
            }
    else:
        draft = _fallback_answer(state)
    return {"draft_answer": draft, "budget_used": used}


def self_correct_answer(state: ReasoningTechniquesState) -> dict[str, Any]:
    claims = [item["claim"] for item in state.get("supporting_evidence", [])]
    gaps = state.get("knowledge_gaps", [])
    contradictions = state.get("contradictions", [])
    critique = {
        "has_gaps": bool(gaps),
        "has_contradictions": bool(contradictions),
        "supported_claim_count": len(claims),
    }
    used = dict(state.get("budget_used", {}))
    draft = state.get("draft_answer") or _fallback_answer(state)
    try:
        model = get_chat_model()
        response = model.invoke(
            [
                SystemMessage(content=CORRECTION_SYSTEM_PROMPT),
                HumanMessage(
                    content=CORRECTION_USER_PROMPT.format(
                        question=state.get("normalized_input", ""),
                        draft=draft,
                        claims=claims,
                        gaps=gaps,
                        contradictions=contradictions,
                    )
                ),
            ]
        )
        used["model_calls"] = used.get("model_calls", 0) + 1
        revised = _strip_unsupported(str(response.content), claims, gaps, contradictions)
    except Exception:
        revised = _strip_unsupported(draft, claims, gaps, contradictions)
    status = state.get("status", "ok")
    if gaps or contradictions:
        status = "partial" if claims or state.get("computation_results") else "insufficient_evidence"
    return {"critique": critique, "revised_answer": revised, "budget_used": used, "status": status}


def finalize_response(state: ReasoningTechniquesState) -> dict[str, Any]:
    status = state.get("status", "ok")
    if status == "tool_error" and (state.get("supporting_evidence") or state.get("computation_results")):
        status = "partial"
    answer = state.get("revised_answer") or state.get("draft_answer") or _fallback_answer(state)
    summary = _reasoning_summary(state)
    final = {
        "status": status,
        "answer": answer,
        "reasoning_summary": summary,
        "supporting_evidence": state.get("supporting_evidence", []),
        "knowledge_gaps": state.get("knowledge_gaps", []),
        "contradictions": state.get("contradictions", []),
        "selected_branch_id": state.get("selected_branch_id"),
        "budget_used": state.get("budget_used", {}),
        "errors": state.get("errors", []),
    }
    return {"final_output": final, "reasoning_summary": summary, "status": status}


def safe_arithmetic(expression: str) -> int | float:
    tree = ast.parse(expression, mode="eval")
    return _eval_arithmetic(tree.body)


def _eval_arithmetic(node: ast.AST) -> int | float:
    ops = {
        ast.Add: operator.add,
        ast.Sub: operator.sub,
        ast.Mult: operator.mul,
        ast.Div: operator.truediv,
        ast.Pow: operator.pow,
    }
    if isinstance(node, ast.Constant) and isinstance(node.value, (int, float)):
        return node.value
    if isinstance(node, ast.BinOp) and type(node.op) in ops:
        return ops[type(node.op)](_eval_arithmetic(node.left), _eval_arithmetic(node.right))
    if isinstance(node, ast.UnaryOp) and isinstance(node.op, ast.USub):
        return -_eval_arithmetic(node.operand)
    raise ValueError("Only basic arithmetic expressions are allowed.")


def _normalize_text(value: Any) -> str:
    return re.sub(r"\s+", " ", str(value or "")).strip()


def _normalize_depth(value: Any) -> tuple[str, str | None]:
    depth = str(value or "standard").lower()
    if depth in DEFAULT_BUDGETS:
        return depth, None
    return "standard", f"Unsupported reasoning_depth {value!r}; using 'standard'."


def _merge_budget(depth: str, overrides: Any) -> dict[str, int]:
    budget = dict(DEFAULT_BUDGETS[depth])
    if isinstance(overrides, dict):
        for key in budget:
            if key in overrides:
                budget[key] = max(0, int(overrides[key]))
    return budget


def _keywords(text: str) -> set[str]:
    return {token for token in re.findall(r"[a-zA-Z][a-zA-Z0-9_-]*", text.lower()) if token not in STOPWORDS}


def _extract_expression(text: str) -> str | None:
    match = re.search(r"(-?\d+(?:\.\d+)?(?:\s*[+\-*/]\s*-?\d+(?:\.\d+)?)+)", text)
    return match.group(1).replace(" ", "") if match else None


def _subquestion(identifier: str, question: str, topic: str) -> dict[str, Any]:
    return {
        "id": identifier,
        "question": question,
        "topic": topic,
        "needs_evidence": True,
        "needs_computation": False,
        "resolved": False,
    }


def _dedupe_subquestions(items: list[dict[str, Any]]) -> list[dict[str, Any]]:
    seen: set[str] = set()
    output = []
    for item in items:
        if item["id"] not in seen:
            output.append(item)
            seen.add(item["id"])
    return output


def _call_retriever(state: ReasoningTechniquesState, action: ReasoningAction) -> list[dict[str, Any]]:
    retriever = state.get("retriever")
    kb = state.get("knowledge_base") or DEFAULT_KNOWLEDGE_BASE
    if retriever:
        return list(retriever(query=action.get("query", ""), subquestion_id=action.get("subquestion_id", ""), knowledge_base=kb))
    topic = next(
        (item.get("topic", "") for item in state.get("subquestions", []) if item.get("id") == action.get("subquestion_id")),
        "",
    )
    query_terms = _keywords(f"{action.get('query', '')} {topic}")
    matches = []
    for record in kb:
        topics = {str(topic).lower() for topic in record.get("topics", [])}
        claim_terms = _keywords(record.get("claim", ""))
        if query_terms & (topics | claim_terms):
            matches.append(record)
    return matches[:3]


def _normalize_evidence(record: dict[str, Any]) -> dict[str, Any] | None:
    if not isinstance(record, dict) or not record.get("id") or not record.get("claim"):
        return None
    return {
        "id": str(record["id"]),
        "claim": str(record["claim"]),
        "topics": [str(topic).lower() for topic in record.get("topics", [])],
        "confidence": float(record.get("confidence", 0.5)),
        "contradicts": record.get("contradicts"),
    }


def _evidence_topics(evidence: list[dict[str, Any]]) -> set[str]:
    topics: set[str] = set()
    for item in evidence:
        topics.update(item.get("topics", []))
    return topics


def _detect_contradictions(evidence: list[dict[str, Any]]) -> list[dict[str, Any]]:
    ids = {item.get("id") for item in evidence}
    contradictions = []
    for item in evidence:
        target = item.get("contradicts")
        if target and target in ids:
            contradictions.append(
                {
                    "evidence_id": item.get("id"),
                    "contradicts": target,
                    "resolved": False,
                    "message": f"{item.get('id')} conflicts with {target}.",
                }
            )
    return contradictions


def _fallback_answer(state: ReasoningTechniquesState) -> str:
    claims = [item["claim"] for item in state.get("supporting_evidence", [])]
    computations = [
        f"{item['expression']} = {item['result']}"
        for item in state.get("computation_results", [])
    ]
    parts = claims + computations
    if parts:
        answer = " ".join(parts)
        if state.get("knowledge_gaps"):
            return f"{answer} This answer is partial because evidence is missing for: {', '.join(state['knowledge_gaps'])}."
        return answer
    return "I do not have enough supported evidence to answer this question."


def _strip_unsupported(
    answer: str,
    claims: list[str],
    gaps: list[str],
    contradictions: list[dict[str, Any]],
) -> str:
    if gaps or contradictions:
        supported = " ".join(claims)
        if supported:
            return f"{supported} This answer is partial because unresolved gaps or contradictions remain."
        return "I do not have enough supported evidence to answer this question."
    return answer.strip()


def _reasoning_summary(state: ReasoningTechniquesState) -> str:
    used = state.get("budget_used", {})
    return (
        "The graph decomposed the task, explored "
        f"{used.get('branches', 0)} branch(es), made "
        f"{used.get('retrieval_calls', 0)} retrieval call(s), "
        f"{used.get('computation_calls', 0)} computation call(s), and used "
        f"{used.get('reflection_rounds', 0)} reflection round(s) before finalizing."
    )

