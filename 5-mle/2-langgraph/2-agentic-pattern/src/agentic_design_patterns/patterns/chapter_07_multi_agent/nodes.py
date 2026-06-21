from __future__ import annotations

import json
import re
from typing import Any

from langchain_core.messages import HumanMessage, SystemMessage

from agentic_design_patterns.patterns.chapter_07_multi_agent.prompts import (
    ANALYSIS_SYSTEM_PROMPT,
    ANALYSIS_USER_PROMPT,
    RESEARCH_SYSTEM_PROMPT,
    RESEARCH_USER_PROMPT,
    REVIEWER_SYSTEM_PROMPT,
    REVIEWER_USER_PROMPT,
    REVISE_SYSTEM_PROMPT,
    REVISE_USER_PROMPT,
    SUPERVISOR_SYSTEM_PROMPT,
    SUPERVISOR_USER_PROMPT,
    WRITER_SYSTEM_PROMPT,
    WRITER_USER_PROMPT,
)
from agentic_design_patterns.patterns.chapter_07_multi_agent.state import (
    AgentError,
    AgentMessage,
    MultiAgentState,
    TeamAssignment,
)
from agentic_design_patterns.shared.models import get_chat_model


SUPPORTED_AGENTS = (
    "research_agent",
    "analysis_agent",
    "writer_agent",
    "reviewer_agent",
)
DEFAULT_MAX_RETRIES = 1
MAX_OBJECTIVE_CHARS = 4000
HIGH_RISK_TERMS = (
    "medical",
    "medicine",
    "diagnosis",
    "legal",
    "lawsuit",
    "financial advice",
    "investment advice",
    "self-harm",
    "weapon",
    "explosive",
)


def prepare_objective(state: MultiAgentState) -> dict[str, Any]:
    raw_input = state.get("input", "")
    objective = _normalize_text("" if raw_input is None else str(raw_input))
    max_retries = _coerce_non_negative_int(
        state.get("max_retries", DEFAULT_MAX_RETRIES),
        DEFAULT_MAX_RETRIES,
    )
    retry_count = _coerce_non_negative_int(state.get("retry_count", 0), 0)
    source_material = _optional_normalized_text(state.get("source_material"))
    metadata = _metadata(state)
    metadata.update(
        {
            "pattern": "multi_agent_collaboration",
            "team": list(SUPPORTED_AGENTS),
            "input_length": len(objective),
            "source_material_available": source_material is not None,
        }
    )

    updates: dict[str, Any] = {
        "objective": objective[:MAX_OBJECTIVE_CHARS].rstrip(),
        "source_material": source_material,
        "team_plan": [],
        "communication_contract": {},
        "agent_messages": [],
        "agent_outputs": {},
        "research_findings": [],
        "analysis_findings": [],
        "context_bundle": {},
        "draft_report": None,
        "review_result": None,
        "revision_notes": [],
        "retry_count": retry_count,
        "max_retries": max_retries,
        "errors": [],
        "requires_human_review": False,
        "status": "ok",
        "final_output": None,
        "metadata": metadata,
    }

    if not objective:
        updates.update(
            {
                "status": "failed",
                "errors": [_error("prepare_objective", "Input is empty.")],
            }
        )
        return updates

    if len(objective) > MAX_OBJECTIVE_CHARS:
        updates["agent_messages"] = [
            _message(
                "prepare_objective",
                "truncated",
                f"Objective was truncated to {MAX_OBJECTIVE_CHARS} characters.",
            )
        ]

    return updates


def supervisor_plan(state: MultiAgentState) -> dict[str, Any]:
    try:
        content = _invoke_model(
            SUPERVISOR_SYSTEM_PROMPT,
            SUPERVISOR_USER_PROMPT.format(
                objective=state.get("objective", ""),
                has_source_material=state.get("source_material") is not None,
            ),
        )
    except Exception as exc:  # pragma: no cover - provider error types vary.
        return {
            "status": "failed",
            "errors": [
                _error("supervisor_plan", f"model invocation failed: {exc}")
            ],
            "agent_outputs": {
                "supervisor_plan": {"status": "failed", "error": str(exc)}
            },
        }

    parsed, parse_errors = _parse_json_object(content)
    if parse_errors:
        return {
            "status": "failed",
            "team_plan": [],
            "communication_contract": {},
            "errors": [
                _error("supervisor_plan", "; ".join(parse_errors))
            ],
            "agent_outputs": {
                "supervisor_plan": {
                    "status": "failed",
                    "raw_output": content,
                }
            },
            "agent_messages": [
                _message(
                    "supervisor_plan",
                    "failed",
                    "Supervisor returned malformed planning output.",
                )
            ],
        }

    raw_plan = parsed.get("team_plan", parsed.get("assignments", []))
    raw_contract = parsed.get("communication_contract", parsed.get("contract", {}))
    team_plan = _normalize_team_plan(raw_plan)
    communication_contract = raw_contract if isinstance(raw_contract, dict) else {}

    return {
        "team_plan": team_plan,
        "communication_contract": communication_contract,
        "agent_outputs": {
            "supervisor_plan": {
                "status": "completed",
                "agents": [assignment.get("agent") for assignment in team_plan],
            }
        },
        "agent_messages": [
            _message(
                "supervisor_plan",
                "planned",
                "Created role-specific assignments and communication rules.",
                {"assignment_count": len(team_plan)},
            )
        ],
    }


def validate_team_plan(state: MultiAgentState) -> dict[str, Any]:
    validation_errors = _validate_team_plan(
        state.get("team_plan", []),
        state.get("communication_contract", {}),
    )
    if validation_errors:
        return {
            "status": "failed",
            "errors": [
                _error("validate_team_plan", message)
                for message in validation_errors
            ],
            "agent_messages": [
                _message(
                    "validate_team_plan",
                    "failed",
                    "Team plan failed validation.",
                    {"errors": validation_errors},
                )
            ],
        }

    return {
        "status": "ok",
        "agent_messages": [
            _message(
                "validate_team_plan",
                "validated",
                "Team plan includes the required specialist roles.",
            )
        ],
    }


def research_agent(state: MultiAgentState) -> dict[str, Any]:
    assignment = _assignment_for(state, "research_agent")
    try:
        content = _invoke_model(
            RESEARCH_SYSTEM_PROMPT,
            RESEARCH_USER_PROMPT.format(
                objective=state.get("objective", ""),
                source_material=state.get("source_material") or "None provided.",
                assignment=json.dumps(assignment, sort_keys=True),
            ),
        )
        parsed, parse_errors = _parse_json_object(content)
        if parse_errors:
            raise ValueError("; ".join(parse_errors))
        findings = _extract_research_findings(parsed)
        if not findings:
            raise ValueError("Research output did not include any findings.")
    except Exception as exc:
        return {
            "errors": [_error("research_agent", str(exc))],
            "agent_outputs": {
                "research_agent": {
                    "status": "failed",
                    "error": str(exc),
                }
            },
            "agent_messages": [
                _message(
                    "research_agent",
                    "failed",
                    "Research specialist could not produce usable findings.",
                )
            ],
        }

    return {
        "research_findings": findings,
        "agent_outputs": {
            "research_agent": {
                "status": "completed",
                "findings": findings,
                "findings_count": len(findings),
            }
        },
        "agent_messages": [
            _message(
                "research_agent",
                "completed",
                "Produced grounded research findings.",
                {"findings_count": len(findings)},
            )
        ],
    }


def analysis_agent(state: MultiAgentState) -> dict[str, Any]:
    assignment = _assignment_for(state, "analysis_agent")
    try:
        content = _invoke_model(
            ANALYSIS_SYSTEM_PROMPT,
            ANALYSIS_USER_PROMPT.format(
                objective=state.get("objective", ""),
                source_material=state.get("source_material") or "None provided.",
                assignment=json.dumps(assignment, sort_keys=True),
            ),
        )
        parsed, parse_errors = _parse_json_object(content)
        if parse_errors:
            raise ValueError("; ".join(parse_errors))
        findings = _extract_analysis_findings(parsed)
        if not findings:
            raise ValueError("Analysis output did not include any findings.")
        conflicts = _string_list(parsed.get("conflicts"))
        open_questions = _string_list(parsed.get("open_questions"))
    except Exception as exc:
        return {
            "errors": [_error("analysis_agent", str(exc))],
            "agent_outputs": {
                "analysis_agent": {
                    "status": "failed",
                    "error": str(exc),
                }
            },
            "agent_messages": [
                _message(
                    "analysis_agent",
                    "failed",
                    "Analysis specialist could not produce usable findings.",
                )
            ],
        }

    return {
        "analysis_findings": findings,
        "agent_outputs": {
            "analysis_agent": {
                "status": "completed",
                "findings": findings,
                "conflicts": conflicts,
                "open_questions": open_questions,
            }
        },
        "agent_messages": [
            _message(
                "analysis_agent",
                "completed",
                "Produced implications, risks, and open questions.",
                {
                    "findings_count": len(findings),
                    "conflict_count": len(conflicts),
                },
            )
        ],
    }


def synthesize_context(state: MultiAgentState) -> dict[str, Any]:
    research_findings = state.get("research_findings", [])
    analysis_findings = state.get("analysis_findings", [])
    missing_outputs = _missing_specialist_outputs(state)
    weak_outputs = _weak_research_findings(research_findings)
    conflicts = _detect_conflicts(state)
    context_bundle = {
        "objective": state.get("objective", ""),
        "source_material_available": state.get("source_material") is not None,
        "research_findings": research_findings,
        "analysis_findings": analysis_findings,
        "conflicts": conflicts,
        "missing_outputs": missing_outputs,
        "weak_outputs": weak_outputs,
        "communication_contract": state.get("communication_contract", {}),
        "handoffs": [
            "research_agent -> writer_agent",
            "analysis_agent -> writer_agent",
            "writer_agent -> reviewer_agent",
        ],
    }

    blocking_reasons: list[str] = []
    if missing_outputs:
        blocking_reasons.append(
            "Required specialist outputs missing: " + ", ".join(missing_outputs) + "."
        )
    if weak_outputs:
        blocking_reasons.append(
            "Research findings are too weakly supported: "
            + ", ".join(weak_outputs)
            + "."
        )
    if conflicts:
        blocking_reasons.append(
            "Specialist outputs contain unresolved conflicts: "
            + "; ".join(conflicts)
        )

    if blocking_reasons:
        return {
            "context_bundle": context_bundle,
            "status": "needs_human_review",
            "requires_human_review": True,
            "revision_notes": blocking_reasons,
            "errors": [
                _error("synthesize_context", reason)
                for reason in blocking_reasons
            ],
            "agent_outputs": {
                "synthesize_context": {
                    "status": "needs_human_review",
                    "blocking_reasons": blocking_reasons,
                }
            },
            "agent_messages": [
                _message(
                    "synthesize_context",
                    "blocked",
                    "Specialist handoffs were incomplete or conflicted.",
                    {"blocking_reasons": blocking_reasons},
                )
            ],
        }

    return {
        "context_bundle": context_bundle,
        "status": "ok",
        "agent_outputs": {
            "synthesize_context": {
                "status": "completed",
                "research_findings": len(research_findings),
                "analysis_findings": len(analysis_findings),
            }
        },
        "agent_messages": [
            _message(
                "synthesize_context",
                "completed",
                "Combined specialist handoffs for the writer.",
            )
        ],
    }


def writer_agent(state: MultiAgentState) -> dict[str, Any]:
    assignment = _assignment_for(state, "writer_agent")
    try:
        content = _invoke_model(
            WRITER_SYSTEM_PROMPT,
            WRITER_USER_PROMPT.format(
                objective=state.get("objective", ""),
                context_bundle=json.dumps(
                    state.get("context_bundle", {}),
                    sort_keys=True,
                ),
                assignment=json.dumps(assignment, sort_keys=True),
            ),
        )
        draft_report = _parse_draft_report(content)
        if not draft_report:
            raise ValueError("Writer output did not include draft_report.")
    except Exception as exc:
        return {
            "status": "needs_human_review",
            "requires_human_review": True,
            "errors": [_error("writer_agent", str(exc))],
            "agent_outputs": {
                "writer_agent": {
                    "status": "failed",
                    "error": str(exc),
                }
            },
            "agent_messages": [
                _message(
                    "writer_agent",
                    "failed",
                    "Writer could not produce a usable draft.",
                )
            ],
        }

    return {
        "draft_report": draft_report,
        "status": "ok",
        "agent_outputs": {
            "writer_agent": {
                "status": "completed",
                "draft_length": len(draft_report),
            }
        },
        "agent_messages": [
            _message(
                "writer_agent",
                "completed",
                "Drafted the research brief from specialist handoffs.",
            )
        ],
    }


def reviewer_agent(state: MultiAgentState) -> dict[str, Any]:
    assignment = _assignment_for(state, "reviewer_agent")
    draft_report = state.get("draft_report") or ""
    if not draft_report.strip():
        review_result = _review_result(
            approved=False,
            issues=["Draft report is missing."],
            revision_notes=[],
            requires_human_review=True,
        )
        return {
            "status": "needs_human_review",
            "requires_human_review": True,
            "review_result": review_result,
            "agent_outputs": {
                "reviewer_agent": {
                    "status": "needs_human_review",
                    "review": review_result,
                }
            },
        }

    try:
        content = _invoke_model(
            REVIEWER_SYSTEM_PROMPT,
            REVIEWER_USER_PROMPT.format(
                objective=state.get("objective", ""),
                context_bundle=json.dumps(
                    state.get("context_bundle", {}),
                    sort_keys=True,
                ),
                draft_report=draft_report,
                assignment=json.dumps(assignment, sort_keys=True),
            ),
        )
        parsed, parse_errors = _parse_json_object(content)
        if parse_errors:
            raise ValueError("; ".join(parse_errors))
        review_result = _normalize_review_result(parsed)
    except Exception as exc:
        review_result = _review_result(
            approved=False,
            issues=[f"Reviewer output was unusable: {exc}"],
            revision_notes=[],
            requires_human_review=True,
        )
        return {
            "status": "needs_human_review",
            "requires_human_review": True,
            "review_result": review_result,
            "errors": [_error("reviewer_agent", str(exc))],
            "agent_outputs": {
                "reviewer_agent": {
                    "status": "needs_human_review",
                    "review": review_result,
                }
            },
            "agent_messages": [
                _message(
                    "reviewer_agent",
                    "failed",
                    "Reviewer could not produce a usable decision.",
                )
            ],
        }

    if _is_high_risk_topic(state.get("objective", "")):
        review_result["approved"] = False
        review_result["requires_human_review"] = True
        review_result["issues"] = [
            *review_result.get("issues", []),
            "High-risk topic requires human review before finalization.",
        ]

    revision_notes = _string_list(review_result.get("revision_notes"))
    requires_human_review = bool(review_result.get("requires_human_review", False))
    approved = bool(review_result.get("approved", False))
    status: str
    reviewer_status: str

    if approved and not requires_human_review:
        status = "ok"
        reviewer_status = "approved"
    elif revision_notes and state.get("retry_count", 0) < state.get("max_retries", 1):
        status = "needs_revision"
        reviewer_status = "needs_revision"
    else:
        status = "needs_human_review"
        reviewer_status = "needs_human_review"
        requires_human_review = True

    return {
        "status": status,
        "requires_human_review": requires_human_review,
        "review_result": review_result,
        "revision_notes": revision_notes,
        "agent_outputs": {
            "reviewer_agent": {
                "status": reviewer_status,
                "review": review_result,
            }
        },
        "agent_messages": [
            _message(
                "reviewer_agent",
                reviewer_status,
                "Reviewed the writer draft against specialist outputs.",
                {
                    "approved": approved,
                    "issue_count": len(review_result.get("issues", [])),
                },
            )
        ],
    }


def revise_draft(state: MultiAgentState) -> dict[str, Any]:
    retry_count = state.get("retry_count", 0) + 1
    revision_notes = state.get("revision_notes", [])
    draft_report = state.get("draft_report") or ""
    if not revision_notes or not draft_report:
        return {
            "retry_count": retry_count,
            "status": "needs_human_review",
            "requires_human_review": True,
            "errors": [
                _error(
                    "revise_draft",
                    "Cannot revise without both a draft and reviewer notes.",
                )
            ],
        }

    try:
        content = _invoke_model(
            REVISE_SYSTEM_PROMPT,
            REVISE_USER_PROMPT.format(
                objective=state.get("objective", ""),
                context_bundle=json.dumps(
                    state.get("context_bundle", {}),
                    sort_keys=True,
                ),
                draft_report=draft_report,
                revision_notes=json.dumps(revision_notes, sort_keys=True),
            ),
        )
        revised_draft = _parse_draft_report(content)
        if not revised_draft:
            raise ValueError("Revision output did not include draft_report.")
    except Exception as exc:
        return {
            "retry_count": retry_count,
            "status": "needs_human_review",
            "requires_human_review": True,
            "errors": [_error("revise_draft", str(exc))],
            "agent_outputs": {
                "writer_agent": {
                    "status": "revision_failed",
                    "error": str(exc),
                    "revision_attempt": retry_count,
                }
            },
            "agent_messages": [
                _message(
                    "revise_draft",
                    "failed",
                    "Revision attempt could not produce a usable draft.",
                    {"retry_count": retry_count},
                )
            ],
        }

    return {
        "draft_report": revised_draft,
        "retry_count": retry_count,
        "status": "ok",
        "agent_outputs": {
            "writer_agent": {
                "status": "revised",
                "draft_length": len(revised_draft),
                "revision_attempt": retry_count,
            }
        },
        "agent_messages": [
            _message(
                "revise_draft",
                "completed",
                "Applied reviewer notes to the writer draft.",
                {"retry_count": retry_count},
            )
        ],
    }


def finalize(state: MultiAgentState) -> dict[str, Any]:
    final_output = {
        "status": "ok",
        "brief": state.get("draft_report"),
        "review": state.get("review_result") or {},
        "agents": _agent_statuses(state),
        "specialist_outputs": {
            "research_findings": state.get("research_findings", []),
            "analysis_findings": state.get("analysis_findings", []),
        },
        "trace": _trace_summary(state),
    }
    return {
        "status": "ok",
        "requires_human_review": False,
        "final_output": final_output,
        "agent_messages": [
            _message(
                "finalize",
                "completed",
                "Finalized the approved multi-agent research brief.",
            )
        ],
    }


def mark_needs_human_review(state: MultiAgentState) -> dict[str, Any]:
    final_output = {
        "status": "needs_human_review",
        "brief": state.get("draft_report"),
        "review": state.get("review_result") or {},
        "agents": _agent_statuses(state),
        "errors": state.get("errors", []),
        "context": {
            "missing_outputs": state.get("context_bundle", {}).get(
                "missing_outputs",
                [],
            ),
            "conflicts": state.get("context_bundle", {}).get("conflicts", []),
            "revision_notes": state.get("revision_notes", []),
        },
        "trace": _trace_summary(state),
    }
    return {
        "status": "needs_human_review",
        "requires_human_review": True,
        "final_output": final_output,
        "agent_messages": [
            _message(
                "mark_needs_human_review",
                "completed",
                "Stopped for human review instead of inventing or over-trusting output.",
            )
        ],
    }


def handle_failure(state: MultiAgentState) -> dict[str, Any]:
    final_output = {
        "status": "failed",
        "brief": None,
        "errors": state.get("errors", []),
        "agents": _agent_statuses(state),
        "trace": _trace_summary(state),
    }
    return {
        "status": "failed",
        "requires_human_review": False,
        "final_output": final_output,
        "agent_messages": [
            _message(
                "handle_failure",
                "completed",
                "Stopped because the workflow could not be initialized safely.",
            )
        ],
    }


def _invoke_model(system_prompt: str, user_prompt: str) -> str:
    response = get_chat_model().invoke(
        [
            SystemMessage(content=system_prompt),
            HumanMessage(content=user_prompt),
        ]
    )
    content = getattr(response, "content", response)
    if isinstance(content, list):
        return "\n".join(str(part) for part in content)
    return str(content)


def _parse_json_object(raw_text: str) -> tuple[dict[str, Any], list[str]]:
    candidate = _strip_code_fence(raw_text)
    try:
        parsed = json.loads(candidate)
    except json.JSONDecodeError as exc:
        return {}, [f"Malformed JSON: {exc.msg}."]

    if not isinstance(parsed, dict):
        return {}, ["Expected a JSON object."]

    return parsed, []


def _parse_draft_report(raw_text: str) -> str:
    parsed, parse_errors = _parse_json_object(raw_text)
    if not parse_errors:
        draft = parsed.get("draft_report", parsed.get("brief"))
        return _normalize_text("" if draft is None else str(draft))
    return _normalize_text(raw_text)


def _strip_code_fence(raw_text: str) -> str:
    text = raw_text.strip()
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?", "", text, flags=re.IGNORECASE).strip()
        text = re.sub(r"```$", "", text).strip()
    return text


def _normalize_team_plan(raw_plan: Any) -> list[TeamAssignment]:
    if not isinstance(raw_plan, list):
        return []

    team_plan: list[TeamAssignment] = []
    for raw_assignment in raw_plan:
        if not isinstance(raw_assignment, dict):
            continue
        agent = _normalize_agent_name(
            raw_assignment.get("agent", raw_assignment.get("name"))
        )
        dependencies = [
            dependency
            for dependency in (
                _normalize_agent_name(item)
                for item in _list_value(raw_assignment.get("dependencies"))
            )
            if dependency
        ]
        team_plan.append(
            {
                "agent": agent or "",
                "role": _normalize_text(str(raw_assignment.get("role", ""))),
                "task": _normalize_text(str(raw_assignment.get("task", ""))),
                "expected_output": _normalize_text(
                    str(raw_assignment.get("expected_output", ""))
                ),
                "dependencies": dependencies,
            }
        )
    return team_plan


def _validate_team_plan(
    team_plan: list[TeamAssignment],
    communication_contract: dict[str, Any],
) -> list[str]:
    errors: list[str] = []
    if not team_plan:
        errors.append("Team plan is empty or malformed.")
        return errors

    agents = [assignment.get("agent", "") for assignment in team_plan]
    unknown_agents = sorted(
        {agent for agent in agents if agent not in SUPPORTED_AGENTS}
    )
    if unknown_agents:
        errors.append("Unsupported agent names: " + ", ".join(unknown_agents) + ".")

    missing_agents = [agent for agent in SUPPORTED_AGENTS if agent not in agents]
    if missing_agents:
        errors.append("Missing required agents: " + ", ".join(missing_agents) + ".")

    duplicate_agents = sorted(
        {agent for agent in agents if agent and agents.count(agent) > 1}
    )
    if duplicate_agents:
        errors.append("Duplicate agent assignments: " + ", ".join(duplicate_agents) + ".")

    for assignment in team_plan:
        agent = assignment.get("agent", "unknown")
        if not assignment.get("task"):
            errors.append(f"{agent} assignment is missing a task.")
        if not assignment.get("expected_output"):
            errors.append(f"{agent} assignment is missing expected_output.")

    if not isinstance(communication_contract, dict) or not communication_contract:
        errors.append("Communication contract is missing or malformed.")

    cycle = _find_dependency_cycle(team_plan)
    if cycle:
        errors.append("Circular dependency detected: " + " -> ".join(cycle) + ".")

    return errors


def _find_dependency_cycle(team_plan: list[TeamAssignment]) -> list[str]:
    dependencies = {
        assignment.get("agent", ""): assignment.get("dependencies", [])
        for assignment in team_plan
        if assignment.get("agent")
    }
    visiting: set[str] = set()
    visited: set[str] = set()
    path: list[str] = []

    def visit(agent: str) -> list[str]:
        if agent in visiting:
            if agent in path:
                return path[path.index(agent) :] + [agent]
            return [agent, agent]
        if agent in visited:
            return []

        visiting.add(agent)
        path.append(agent)
        for dependency in dependencies.get(agent, []):
            if dependency in dependencies:
                cycle = visit(dependency)
                if cycle:
                    return cycle
        visiting.remove(agent)
        visited.add(agent)
        path.pop()
        return []

    for agent in dependencies:
        cycle = visit(agent)
        if cycle:
            return cycle
    return []


def _assignment_for(state: MultiAgentState, agent_name: str) -> TeamAssignment:
    for assignment in state.get("team_plan", []):
        if assignment.get("agent") == agent_name:
            return assignment
    return {
        "agent": agent_name,
        "role": agent_name.replace("_", " "),
        "task": "Complete the assigned role.",
        "expected_output": "Structured output.",
        "dependencies": [],
    }


def _extract_research_findings(parsed: dict[str, Any]) -> list[dict[str, str]]:
    raw_findings = parsed.get("findings", parsed.get("research_findings", []))
    findings: list[dict[str, str]] = []
    for item in _list_value(raw_findings):
        if isinstance(item, dict):
            claim = _normalize_text(str(item.get("claim", item.get("finding", ""))))
            evidence = _normalize_text(str(item.get("evidence", item.get("source", ""))))
        else:
            claim = _normalize_text(str(item))
            evidence = "Model output did not provide explicit evidence."
        if claim:
            findings.append({"claim": claim, "evidence": evidence})
    return findings


def _extract_analysis_findings(parsed: dict[str, Any]) -> list[dict[str, str]]:
    raw_findings = parsed.get("findings", parsed.get("analysis_findings", []))
    findings: list[dict[str, str]] = []
    for item in _list_value(raw_findings):
        if isinstance(item, dict):
            point = _normalize_text(str(item.get("point", item.get("finding", ""))))
            rationale = _normalize_text(str(item.get("rationale", item.get("why", ""))))
            risk = _normalize_text(str(item.get("risk", item.get("tradeoff", ""))))
        else:
            point = _normalize_text(str(item))
            rationale = ""
            risk = ""
        if point:
            findings.append(
                {
                    "point": point,
                    "rationale": rationale,
                    "risk": risk,
                }
            )
    return findings


def _missing_specialist_outputs(state: MultiAgentState) -> list[str]:
    missing: list[str] = []
    research_output = state.get("agent_outputs", {}).get("research_agent", {})
    analysis_output = state.get("agent_outputs", {}).get("analysis_agent", {})
    if research_output.get("status") != "completed" or not state.get(
        "research_findings"
    ):
        missing.append("research_agent")
    if analysis_output.get("status") != "completed" or not state.get(
        "analysis_findings"
    ):
        missing.append("analysis_agent")
    return missing


def _weak_research_findings(findings: list[dict[str, str]]) -> list[str]:
    weak: list[str] = []
    for index, finding in enumerate(findings, start=1):
        evidence = _normalize_text(finding.get("evidence", ""))
        if not evidence or evidence.lower() == "none":
            weak.append(f"research finding {index}")
    return weak


def _detect_conflicts(state: MultiAgentState) -> list[str]:
    conflicts: list[str] = []
    analysis_output = state.get("agent_outputs", {}).get("analysis_agent", {})
    conflicts.extend(_string_list(analysis_output.get("conflicts")))
    for finding in state.get("research_findings", []):
        claim = finding.get("claim", "")
        if re.search(r"\b(conflict|contradict|disagree)\b", claim, re.IGNORECASE):
            conflicts.append(claim)
    return conflicts


def _normalize_review_result(parsed: dict[str, Any]) -> dict[str, Any]:
    unsupported_claims = _string_list(parsed.get("unsupported_claims"))
    issues = _string_list(parsed.get("issues"))
    if unsupported_claims:
        issues = [*issues, *[f"Unsupported claim: {claim}" for claim in unsupported_claims]]

    approved = bool(parsed.get("approved", False))
    if issues or unsupported_claims:
        approved = False

    return _review_result(
        approved=approved,
        issues=issues,
        unsupported_claims=unsupported_claims,
        missing_sections=_string_list(parsed.get("missing_sections")),
        revision_notes=_string_list(parsed.get("revision_notes")),
        requires_human_review=bool(parsed.get("requires_human_review", False)),
    )


def _review_result(
    *,
    approved: bool,
    issues: list[str],
    revision_notes: list[str],
    requires_human_review: bool,
    unsupported_claims: list[str] | None = None,
    missing_sections: list[str] | None = None,
) -> dict[str, Any]:
    return {
        "approved": approved,
        "issues": issues,
        "unsupported_claims": unsupported_claims or [],
        "missing_sections": missing_sections or [],
        "revision_notes": revision_notes,
        "requires_human_review": requires_human_review,
    }


def _agent_statuses(state: MultiAgentState) -> dict[str, str]:
    statuses: dict[str, str] = {}
    for agent, output in state.get("agent_outputs", {}).items():
        if isinstance(output, dict):
            statuses[agent] = str(output.get("status", "unknown"))
        else:
            statuses[agent] = "unknown"
    return statuses


def _trace_summary(state: MultiAgentState) -> dict[str, Any]:
    return {
        "message_count": len(state.get("agent_messages", [])),
        "error_count": len(state.get("errors", [])),
        "retry_count": state.get("retry_count", 0),
        "max_retries": state.get("max_retries", DEFAULT_MAX_RETRIES),
    }


def _message(
    agent: str,
    event: str,
    summary: str,
    data: dict[str, Any] | None = None,
) -> AgentMessage:
    message: AgentMessage = {
        "agent": agent,
        "event": event,
        "summary": summary,
    }
    if data is not None:
        message["data"] = data
    return message


def _error(agent: str, message: str) -> AgentError:
    return {"agent": agent, "message": message}


def _metadata(state: MultiAgentState) -> dict[str, Any]:
    metadata = state.get("metadata", {})
    if isinstance(metadata, dict):
        return dict(metadata)
    return {}


def _optional_normalized_text(value: Any) -> str | None:
    if value is None:
        return None
    text = _normalize_text(str(value))
    return text or None


def _normalize_text(text: str) -> str:
    return re.sub(r"\s+", " ", text).strip()


def _normalize_agent_name(value: Any) -> str | None:
    if value is None:
        return None
    normalized = re.sub(r"[\s-]+", "_", str(value).strip().lower())
    return normalized or None


def _list_value(value: Any) -> list[Any]:
    if isinstance(value, list):
        return value
    if value is None:
        return []
    return [value]


def _string_list(value: Any) -> list[str]:
    return [
        text
        for text in (_normalize_text(str(item)) for item in _list_value(value))
        if text
    ]


def _coerce_non_negative_int(value: Any, default: int) -> int:
    try:
        return max(0, int(value))
    except (TypeError, ValueError):
        return default


def _is_high_risk_topic(objective: str) -> bool:
    normalized = objective.lower()
    return any(term in normalized for term in HIGH_RISK_TERMS)
