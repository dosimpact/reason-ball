from __future__ import annotations

import re
from typing import Any

from agentic_design_patterns.shared.models import get_chat_model


DEFAULT_CRITERIA_WEIGHTS = {
    "urgency": 0.35,
    "importance": 0.25,
    "dependency_impact": 0.15,
    "resource_fit": 0.15,
    "cost_benefit": 0.05,
    "user_preference": 0.05,
}
DEFAULT_POLICY = {
    "labels": ["P0", "P1", "P2"],
    "default_priority": "P1",
    "default_assignee": "Worker A",
    "allow_default_priority": True,
    "allow_default_assignment": True,
    "max_reprioritization_passes": 1,
    "select_limit": 2,
    "urgency_keywords": {
        "P0": ["urgent", "asap", "critical", "outage", "incident", "immediately"],
        "P1": ["important", "soon", "this week"],
        "P2": ["routine", "later", "low priority"],
    },
}
DEFAULT_WORKERS = [
    {"name": "Worker A", "skills": ["general", "frontend", "backend"], "capacity": 2},
    {"name": "Worker B", "skills": ["general", "backend", "security"], "capacity": 1},
]
VALID_PRIORITIES = {"P0", "P1", "P2"}
NEGATED_URGENCY_RE = re.compile(r"\b(?:not|no|isn't|is not|not very)\s+(?:an?\s+)?(?:urgent|critical|asap)\b", re.I)


def prepare_prioritization_context(state: dict[str, Any]) -> dict[str, Any]:
    policy = {**DEFAULT_POLICY, **dict(state.get("priority_policy", {}) or {})}
    weights = {**DEFAULT_CRITERIA_WEIGHTS, **dict(state.get("criteria_weights", {}) or {})}
    workers = state.get("workers") or DEFAULT_WORKERS
    warnings = list(state.get("warnings", []))
    status = "ok"

    has_input = bool(str(state.get("input", "")).strip() or state.get("new_task_requests"))
    has_backlog = bool(state.get("existing_tasks"))
    if not has_input and not has_backlog:
        status = "empty"
        warnings.append("No input or existing backlog was provided; returning an empty priority plan.")

    return {
        "priority_policy": policy,
        "criteria_weights": weights,
        "workers": [dict(worker) for worker in workers],
        "environment_context": dict(state.get("environment_context", {}) or {}),
        "tasks": [],
        "task_evaluations": {},
        "dependency_graph": {},
        "blocked_tasks": [],
        "resource_fit": {},
        "ranked_tasks": [],
        "selected_next_actions": [],
        "assignments": [],
        "reprioritization_reason": None,
        "reprioritization_passes": int(state.get("reprioritization_passes", 0) or 0),
        "needs_review": False,
        "warnings": warnings,
        "errors": list(state.get("errors", [])),
        "priority_plan": None,
        "final_response": None,
        "status": status,
    }


def ingest_tasks(state: dict[str, Any]) -> dict[str, Any]:
    tasks: list[dict[str, Any]] = []
    for task in state.get("existing_tasks", []) or []:
        if isinstance(task, dict):
            copied = dict(task)
            copied.setdefault("source", "backlog")
            tasks.append(copied)

    requests = list(state.get("new_task_requests", []) or [])
    raw_input = str(state.get("input", "") or "").strip()
    if raw_input and not requests:
        requests = _split_task_requests(raw_input)

    for request in requests:
        tasks.append(_task_from_text(str(request)))

    return {"tasks": tasks}


def normalize_tasks(state: dict[str, Any]) -> dict[str, Any]:
    policy = state.get("priority_policy", DEFAULT_POLICY)
    workers = state.get("workers", DEFAULT_WORKERS)
    worker_names = {str(worker.get("name")) for worker in workers}
    warnings = list(state.get("warnings", []))
    errors = list(state.get("errors", []))
    normalized: list[dict[str, Any]] = []

    for index, task in enumerate(state.get("tasks", []), start=1):
        description = str(task.get("description", "") or "").strip()
        if not description:
            errors.append(f"Task at position {index} is missing a description.")
            continue

        task_id = str(task.get("id") or f"TASK-{index:03d}")
        priority = _normalize_priority(task.get("priority"))
        rationale = list(task.get("rationale", []))
        if priority is None:
            if policy.get("allow_default_priority", True):
                priority = policy.get("default_priority", "P1")
                warnings.append(f"{task_id} used default priority {priority}.")
                rationale.append("default priority")
            else:
                errors.append(f"{task_id} has missing or invalid priority and defaults are disabled.")
        assignee = task.get("assigned_to") or task.get("assignee")
        assignee = str(assignee).strip() if assignee else None
        if assignee and assignee not in worker_names:
            warnings.append(f"{task_id} preferred assignee {assignee} is unavailable.")

        normalized.append(
            {
                "id": task_id,
                "description": description,
                "priority": priority,
                "assigned_to": assignee,
                "status": str(task.get("status", "open") or "open").lower(),
                "deadline": task.get("deadline"),
                "dependencies": _as_string_list(task.get("dependencies")),
                "required_skills": _as_string_list(task.get("required_skills") or task.get("skills")),
                "required_resources": _as_string_list(task.get("required_resources") or task.get("resources")),
                "importance": _coerce_float(task.get("importance"), 0.5),
                "effort": _coerce_float(task.get("effort"), 0.5),
                "created_order": int(task.get("created_order", index)),
                "rationale": rationale,
                "executable": True,
                "blocked_reason": None,
            }
        )

    if errors:
        return {"tasks": normalized, "errors": errors, "needs_review": True, "status": "needs_review"}
    return {"tasks": normalized, "warnings": warnings, "errors": errors}


def evaluate_task_criteria(state: dict[str, Any]) -> dict[str, Any]:
    context = state.get("environment_context", {})
    weights = state.get("criteria_weights", DEFAULT_CRITERIA_WEIGHTS)
    evaluations: dict[str, dict[str, Any]] = {}
    tasks: list[dict[str, Any]] = []

    for task in state.get("tasks", []):
        copied = dict(task)
        description = copied["description"]
        priority = copied.get("priority") or "P1"
        urgency, urgency_signals = _urgency_score(description, priority, context)
        importance = max(_priority_importance(priority), _coerce_float(copied.get("importance"), 0.5))
        dependency_impact = 1.0 if copied.get("dependencies") else 0.5
        resource_fit = 0.5
        effort = _coerce_float(copied.get("effort"), 0.5)
        cost_benefit = max(0.0, min(1.0, importance - (effort * 0.25) + 0.2))
        user_preference = 1.0 if _matches_user_override(copied, context) else 0.5
        total = (
            urgency * weights["urgency"]
            + importance * weights["importance"]
            + dependency_impact * weights["dependency_impact"]
            + resource_fit * weights["resource_fit"]
            + cost_benefit * weights["cost_benefit"]
            + user_preference * weights["user_preference"]
        )
        signals = [*urgency_signals]
        if user_preference == 1.0:
            signals.append("user priority override")
        evaluations[copied["id"]] = {
            "urgency": round(urgency, 3),
            "importance": round(importance, 3),
            "dependency_impact": round(dependency_impact, 3),
            "resource_fit": round(resource_fit, 3),
            "cost_benefit": round(cost_benefit, 3),
            "user_preference": round(user_preference, 3),
            "total_score": round(total, 3),
            "signals": signals,
        }
        copied["score"] = round(total, 3)
        copied["rationale"] = [*copied.get("rationale", []), *signals]
        tasks.append(copied)

    return {"tasks": tasks, "task_evaluations": evaluations}


def analyze_dependencies(state: dict[str, Any]) -> dict[str, Any]:
    tasks = [dict(task) for task in state.get("tasks", [])]
    task_by_id = {task["id"]: task for task in tasks}
    graph = {task["id"]: list(task.get("dependencies", [])) for task in tasks}
    blocked = list(state.get("blocked_tasks", []))
    errors = list(state.get("errors", []))

    for task in tasks:
        incomplete = [
            dep for dep in task.get("dependencies", [])
            if task_by_id.get(dep, {}).get("status") not in {"done", "complete", "completed"}
        ]
        if incomplete:
            _block_task(task, f"Waiting for dependency {', '.join(incomplete)}.")
            blocked.append({"id": task["id"], "reason": task["blocked_reason"]})

    if _has_cycle(graph):
        errors.append("Dependency cycle detected; automatic prioritization requires human review.")
        return {
            "tasks": tasks,
            "dependency_graph": graph,
            "blocked_tasks": blocked,
            "errors": errors,
            "needs_review": True,
            "status": "needs_review",
        }
    return {"tasks": tasks, "dependency_graph": graph, "blocked_tasks": blocked}


def check_resource_fit(state: dict[str, Any]) -> dict[str, Any]:
    workers = state.get("workers", [])
    worker_by_name = {str(worker.get("name")): worker for worker in workers}
    resource_fit: dict[str, dict[str, Any]] = {}
    blocked = list(state.get("blocked_tasks", []))
    tasks: list[dict[str, Any]] = []

    for task in state.get("tasks", []):
        copied = dict(task)
        required_skills = set(copied.get("required_skills", []))
        preferred = copied.get("assigned_to")
        candidate = worker_by_name.get(preferred) if preferred else None
        if candidate is None and required_skills:
            candidate = next((worker for worker in workers if required_skills.issubset(set(worker.get("skills", [])))), None)
        if candidate is None and not required_skills:
            candidate = worker_by_name.get(DEFAULT_POLICY["default_assignee"]) or (workers[0] if workers else None)

        available = bool(candidate and int(candidate.get("capacity", 0) or 0) > 0)
        resource_fit[copied["id"]] = {
            "available": available,
            "candidate_worker": candidate.get("name") if candidate else None,
            "required_skills": sorted(required_skills),
        }
        if not available and required_skills:
            _block_task(copied, f"No available worker has required skills: {', '.join(sorted(required_skills))}.")
            blocked.append({"id": copied["id"], "reason": copied["blocked_reason"]})
        tasks.append(copied)

    return {"tasks": tasks, "resource_fit": resource_fit, "blocked_tasks": _dedupe_blocked(blocked)}


def rank_tasks(state: dict[str, Any]) -> dict[str, Any]:
    ranked: list[dict[str, Any]] = []
    for task in state.get("tasks", []):
        copied = dict(task)
        evaluation = state.get("task_evaluations", {}).get(copied["id"], {})
        score = _coerce_float(evaluation.get("total_score", copied.get("score")), 0.0)
        if copied.get("blocked_reason"):
            score -= 0.2
        copied["score"] = round(max(0.0, score), 3)
        copied["priority"] = _priority_from_score_and_signals(copied, evaluation)
        ranked.append(copied)

    ranked.sort(key=lambda task: (-task["score"], _deadline_key(task.get("deadline")), task.get("effort", 0.5), task["created_order"]))
    return {"ranked_tasks": ranked}


def decide_reprioritization(state: dict[str, Any]) -> dict[str, Any]:
    context = state.get("environment_context", {})
    max_passes = int(state.get("priority_policy", {}).get("max_reprioritization_passes", 1))
    passes = int(state.get("reprioritization_passes", 0))
    reason = _reprioritization_reason(context)
    if reason and passes < max_passes:
        tasks = [dict(task) for task in state.get("tasks", [])]
        if context.get("critical_event"):
            event = str(context["critical_event"])
            tasks.append(
                {
                    "id": "TASK-CRITICAL",
                    "description": event,
                    "priority": "P0",
                    "assigned_to": context.get("preferred_worker"),
                    "status": "open",
                    "deadline": context.get("deadline_change"),
                    "dependencies": [],
                    "required_skills": _as_string_list(context.get("required_skills")),
                    "required_resources": [],
                    "importance": 1.0,
                    "effort": 0.4,
                    "created_order": 0,
                    "rationale": ["dynamic critical event"],
                    "executable": True,
                    "blocked_reason": None,
                }
            )
        return {"tasks": tasks, "reprioritization_reason": reason, "reprioritization_passes": passes + 1}
    return {"reprioritization_reason": reason}


def assign_selected_tasks(state: dict[str, Any]) -> dict[str, Any]:
    policy = state.get("priority_policy", DEFAULT_POLICY)
    workers = {str(worker.get("name")): dict(worker) for worker in state.get("workers", [])}
    warnings = list(state.get("warnings", []))
    assignments: list[dict[str, Any]] = []
    selected: list[dict[str, Any]] = []
    ranked: list[dict[str, Any]] = []
    needs_review = bool(state.get("needs_review", False))
    limit = int(policy.get("select_limit", 2) or 2)

    for task in state.get("ranked_tasks", []):
        copied = dict(task)
        if len(selected) >= limit or copied.get("blocked_reason"):
            ranked.append(copied)
            continue
        assignee = copied.get("assigned_to")
        worker = workers.get(assignee) if assignee else None
        if worker is None:
            default_name = policy.get("default_assignee", "Worker A")
            worker = workers.get(default_name)
            if worker and policy.get("allow_default_assignment", True):
                assignee = default_name
                copied["assigned_to"] = assignee
                copied.setdefault("rationale", []).append("default assignee")
                warnings.append(f"{copied['id']} used default assignee {assignee}.")
            else:
                needs_review = True
                copied["blocked_reason"] = "No valid assignee and default assignment is disabled or unavailable."
        if worker and int(worker.get("capacity", 0) or 0) <= 0:
            needs_review = True
            copied["blocked_reason"] = f"Assigned worker {worker.get('name')} has no remaining capacity."
        if copied.get("blocked_reason"):
            ranked.append(copied)
            continue
        workers[assignee]["capacity"] = int(workers[assignee].get("capacity", 0) or 0) - 1
        assignment = {"task_id": copied["id"], "worker": assignee, "reason": "highest executable priority"}
        assignments.append(assignment)
        selected.append({"task_id": copied["id"], "priority": copied["priority"], "assigned_to": assignee})
        ranked.append(copied)

    if _competing_unavailable_p0(state.get("ranked_tasks", []), workers):
        needs_review = True
        warnings.append("Multiple P0 tasks compete for unavailable worker capacity.")

    return {
        "ranked_tasks": ranked,
        "assignments": assignments,
        "selected_next_actions": selected,
        "warnings": warnings,
        "needs_review": needs_review,
        "status": "needs_review" if needs_review else state.get("status", "ok"),
    }


def request_human_review(state: dict[str, Any]) -> dict[str, Any]:
    warnings = list(state.get("warnings", []))
    if "Human review required before execution." not in warnings:
        warnings.append("Human review required before execution.")
    return {"needs_review": True, "warnings": warnings, "status": "needs_review"}


def finalize_priority_plan(state: dict[str, Any]) -> dict[str, Any]:
    plan = {
        "ranked_tasks": state.get("ranked_tasks", state.get("tasks", [])),
        "selected_next_actions": state.get("selected_next_actions", []),
        "assignments": state.get("assignments", []),
        "blocked_tasks": state.get("blocked_tasks", []),
        "warnings": state.get("warnings", []),
        "errors": state.get("errors", []),
        "needs_review": bool(state.get("needs_review", False)),
        "reprioritization_reason": state.get("reprioritization_reason"),
    }
    lines = ["Prioritized task board:"]
    if not plan["ranked_tasks"]:
        lines.append("- No tasks to prioritize.")
    for task in plan["ranked_tasks"]:
        assignee = task.get("assigned_to") or "unassigned"
        blocked = f" blocked: {task['blocked_reason']}" if task.get("blocked_reason") else ""
        lines.append(f"- {task['id']} [{task.get('priority')}] {task['description']} -> {assignee}{blocked}")
    return {"priority_plan": plan, "final_response": "\n".join(lines)}


def extract_tasks_with_model(request: str) -> Any:
    """Optional extension point for model-based extraction without provider coupling."""
    model = get_chat_model()
    return model.invoke(request)


def _split_task_requests(raw_input: str) -> list[str]:
    parts = [part.strip(" .") for part in re.split(r"\n+|;|\band\b create\b", raw_input) if part.strip(" .")]
    return parts or [raw_input]


def _task_from_text(text: str) -> dict[str, Any]:
    assignee_match = re.search(r"\bWorker\s+[A-Z]\b", text)
    return {
        "description": _clean_description(text),
        "priority": _priority_from_text(text),
        "assigned_to": assignee_match.group(0) if assignee_match else None,
        "required_skills": _skills_from_text(text),
        "importance": 0.9 if re.search(r"\b(login|outage|security|payment|incident)\b", text, re.I) else 0.5,
        "effort": 0.4 if re.search(r"\b(review|triage|fix)\b", text, re.I) else 0.6,
        "source": "input",
    }


def _clean_description(text: str) -> str:
    cleaned = re.sub(r"^(create|add|make)\s+(a\s+)?task\s+to\s+", "", text.strip(), flags=re.I)
    cleaned = re.sub(r"\s+should\s+go\s+to\s+Worker\s+[A-Z]\b", "", cleaned, flags=re.I)
    return cleaned.strip(" .") or text.strip()


def _priority_from_text(text: str) -> str | None:
    if NEGATED_URGENCY_RE.search(text):
        return None
    lowered = text.lower()
    if any(word in lowered for word in DEFAULT_POLICY["urgency_keywords"]["P0"]):
        return "P0"
    if any(word in lowered for word in DEFAULT_POLICY["urgency_keywords"]["P2"]):
        return "P2"
    if any(word in lowered for word in DEFAULT_POLICY["urgency_keywords"]["P1"]):
        return "P1"
    return None


def _skills_from_text(text: str) -> list[str]:
    lowered = text.lower()
    skills = []
    for keyword, skill in {"login": "backend", "api": "backend", "security": "security", "frontend": "frontend"}.items():
        if keyword in lowered:
            skills.append(skill)
    return sorted(set(skills))


def _normalize_priority(value: Any) -> str | None:
    if value is None:
        return None
    priority = str(value).strip().upper()
    return priority if priority in VALID_PRIORITIES else None


def _urgency_score(description: str, priority: str, context: dict[str, Any]) -> tuple[float, list[str]]:
    if NEGATED_URGENCY_RE.search(description):
        return (0.35, ["negated urgency"])
    lowered = description.lower()
    if context.get("critical_event") and str(context["critical_event"]).lower() in lowered:
        return (1.0, ["critical event"])
    if priority == "P0":
        return (1.0, ["urgent request"])
    if priority == "P2":
        return (0.25, ["low priority"])
    return (0.55, ["normal urgency"])


def _priority_importance(priority: str) -> float:
    return {"P0": 1.0, "P1": 0.6, "P2": 0.25}.get(priority, 0.5)


def _matches_user_override(task: dict[str, Any], context: dict[str, Any]) -> bool:
    override = str(context.get("user_priority_override", "")).lower()
    return bool(override and override in task.get("description", "").lower())


def _priority_from_score_and_signals(task: dict[str, Any], evaluation: dict[str, Any]) -> str:
    if "negated urgency" not in evaluation.get("signals", []) and evaluation.get("urgency", 0) >= 0.95:
        return "P0"
    score = _coerce_float(task.get("score"), 0.0)
    if score >= 0.72:
        return "P0"
    if score >= 0.4:
        return "P1"
    return "P2"


def _reprioritization_reason(context: dict[str, Any]) -> str | None:
    for key in ("critical_event", "deadline_change", "resource_change", "user_priority_override"):
        if context.get(key):
            return key
    return None


def _block_task(task: dict[str, Any], reason: str) -> None:
    task["executable"] = False
    task["blocked_reason"] = reason
    task.setdefault("rationale", []).append(reason)


def _has_cycle(graph: dict[str, list[str]]) -> bool:
    visiting: set[str] = set()
    visited: set[str] = set()

    def visit(node: str) -> bool:
        if node in visiting:
            return True
        if node in visited:
            return False
        visiting.add(node)
        for dep in graph.get(node, []):
            if dep in graph and visit(dep):
                return True
        visiting.remove(node)
        visited.add(node)
        return False

    return any(visit(node) for node in graph)


def _as_string_list(value: Any) -> list[str]:
    if value is None:
        return []
    if isinstance(value, str):
        return [value] if value.strip() else []
    if isinstance(value, list):
        return [str(item) for item in value if str(item).strip()]
    return [str(value)]


def _coerce_float(value: Any, default: float) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def _deadline_key(value: Any) -> str:
    return str(value or "9999-99-99")


def _dedupe_blocked(blocked: list[dict[str, Any]]) -> list[dict[str, Any]]:
    seen = set()
    result = []
    for item in blocked:
        key = item.get("id")
        if key in seen:
            continue
        seen.add(key)
        result.append(item)
    return result


def _competing_unavailable_p0(tasks: list[dict[str, Any]], workers: dict[str, dict[str, Any]]) -> bool:
    demand: dict[str, int] = {}
    for task in tasks:
        if task.get("priority") == "P0" and task.get("assigned_to"):
            demand[task["assigned_to"]] = demand.get(task["assigned_to"], 0) + 1
    return any(count > int(workers.get(worker, {}).get("capacity", 0) or 0) + count for worker, count in demand.items())

