from __future__ import annotations

import json
import re
from collections import Counter
from difflib import SequenceMatcher
from typing import Any

from langchain_core.messages import HumanMessage, SystemMessage

from agentic_design_patterns.patterns.chapter_19_evaluation_and_monitoring.prompts import (
    JUDGE_SYSTEM_PROMPT,
    JUDGE_USER_PROMPT,
)
from agentic_design_patterns.patterns.chapter_19_evaluation_and_monitoring.state import (
    EvaluationMonitoringState,
)
from agentic_design_patterns.shared.models import get_chat_model


SUPPORTED_TRAJECTORY_MODES = {
    "exact",
    "in_order",
    "any_order",
    "precision_recall",
    "single_tool",
}
DEFAULT_MIN_SIMILARITY = 0.72
DEFAULT_MIN_KEYWORD_COVERAGE = 1.0
DEFAULT_MIN_TRAJECTORY_RECALL = 1.0
DEFAULT_MIN_JUDGE_SCORE = 0.7


def prepare_evaluation(state: EvaluationMonitoringState) -> dict[str, Any]:
    errors: list[str] = []
    agent_run = state.get("agent_run")
    if not isinstance(agent_run, dict):
        return {
            "errors": ["agent_run is required and must be a mapping."],
            "alerts": [],
            "evaluation_status": "invalid",
            "evaluation_report": None,
        }

    actual_output = _first_text(
        state.get("actual_output"),
        agent_run.get("final_output"),
        agent_run.get("output"),
        agent_run.get("response"),
    )
    if not actual_output:
        errors.append("Recorded run is missing a final output.")

    actual_trajectory = _normalize_trajectory(
        state.get("actual_trajectory", agent_run.get("tool_calls", agent_run.get("trajectory", [])))
    )
    expected_trajectory = _normalize_trajectory(state.get("expected_trajectory", []))
    run_metadata = dict(agent_run.get("metadata", {}))
    if isinstance(agent_run.get("metrics"), dict):
        run_metadata.update(agent_run["metrics"])
    run_metadata.update(dict(state.get("run_metadata", {})))

    mode = str(state.get("trajectory_match_mode", "exact"))
    if mode not in SUPPORTED_TRAJECTORY_MODES:
        errors.append(f"Unsupported trajectory_match_mode: {mode}.")

    return {
        "input": str(state.get("input") or agent_run.get("name") or "evaluation run"),
        "actual_output": actual_output,
        "reference_output": state.get("reference_output"),
        "actual_trajectory": actual_trajectory,
        "expected_trajectory": expected_trajectory,
        "trajectory_match_mode": mode,
        "run_metadata": run_metadata,
        "thresholds": dict(state.get("thresholds", {})),
        "rubric": state.get("rubric"),
        "baseline_metrics": state.get("baseline_metrics"),
        "response_metrics": {},
        "operational_metrics": {},
        "trajectory_metrics": {},
        "judge_result": None,
        "audit_findings": [],
        "drift_signals": {},
        "alerts": [],
        "errors": errors,
        "evaluation_status": "needs_review" if errors else "passed",
        "evaluation_report": None,
    }


def score_response_quality(state: EvaluationMonitoringState) -> dict[str, Any]:
    thresholds = state.get("thresholds", {})
    reference = state.get("reference_output")
    actual = state.get("actual_output", "")
    required_keywords = [str(item).lower() for item in thresholds.get("required_keywords", [])]

    if not reference and not required_keywords:
        return {
            "response_metrics": {
                "status": "not_applicable",
                "passed": True,
                "reason": "No reference output or required keywords configured.",
            }
        }

    exact_match = _normalize_text(actual) == _normalize_text(reference or "")
    similarity = SequenceMatcher(
        None, _normalize_text(actual), _normalize_text(reference or "")
    ).ratio() if reference else None
    keyword_coverage = _keyword_coverage(actual, required_keywords)
    min_similarity = _float_threshold(thresholds, "min_similarity", DEFAULT_MIN_SIMILARITY)
    min_keyword_coverage = _float_threshold(
        thresholds, "min_keyword_coverage", DEFAULT_MIN_KEYWORD_COVERAGE
    )
    passed = bool(
        exact_match
        or (similarity is not None and similarity >= min_similarity)
        or (required_keywords and keyword_coverage >= min_keyword_coverage)
    )

    return {
        "response_metrics": {
            "status": "scored",
            "exact_match": exact_match,
            "similarity": similarity,
            "min_similarity": min_similarity,
            "keyword_coverage": keyword_coverage,
            "min_keyword_coverage": min_keyword_coverage,
            "required_keywords": required_keywords,
            "passed": passed,
        }
    }


def score_operational_metrics(state: EvaluationMonitoringState) -> dict[str, Any]:
    metadata = state.get("run_metadata", {})
    thresholds = state.get("thresholds", {})
    alerts = list(state.get("alerts", []))
    metrics = {
        "latency_ms": _number(metadata.get("latency_ms")),
        "total_tokens": _number(metadata.get("total_tokens")),
        "cost_usd": _number(metadata.get("cost_usd")),
        "passed": True,
        "missing": [],
    }

    for metric, threshold_name in [
        ("latency_ms", "max_latency_ms"),
        ("total_tokens", "max_total_tokens"),
        ("cost_usd", "max_cost_usd"),
    ]:
        limit = _number(thresholds.get(threshold_name))
        metrics[threshold_name] = limit
        if limit is None:
            continue
        observed = metrics[metric]
        if observed is None:
            metrics["missing"].append(metric)
            continue
        if observed > limit:
            metrics["passed"] = False
            alerts.append(
                _alert(
                    "warning",
                    metric,
                    f"Observed {metric} {observed:g} exceeded limit {limit:g}.",
                    "Inspect the run for resource or latency regressions.",
                )
            )

    return {"operational_metrics": metrics, "alerts": alerts}


def evaluate_trajectory(state: EvaluationMonitoringState) -> dict[str, Any]:
    errors = list(state.get("errors", []))
    actual = _action_names(state.get("actual_trajectory", []))
    expected = _action_names(state.get("expected_trajectory", []))
    mode = state.get("trajectory_match_mode", "exact")

    if mode not in SUPPORTED_TRAJECTORY_MODES:
        return {
            "errors": errors,
            "trajectory_metrics": {
                "status": "invalid",
                "match_mode": mode,
                "passed": False,
            },
        }
    if not expected:
        return {
            "trajectory_metrics": {
                "status": "not_applicable",
                "match_mode": mode,
                "passed": True,
                "reason": "No expected trajectory configured.",
            }
        }

    missing = _missing_actions(actual, expected)
    extra = _missing_actions(expected, actual)
    order_violations = []
    if mode == "exact":
        passed = actual == expected
    elif mode == "in_order":
        passed = _is_subsequence(expected, actual)
        if not passed and not missing:
            order_violations.append("Expected actions were present but not in order.")
    elif mode == "any_order":
        passed = not missing
    elif mode == "single_tool":
        passed = len(expected) == 1 and expected[0] in actual
    else:
        precision, recall = _precision_recall(actual, expected)
        passed = recall >= _float_threshold(
            state.get("thresholds", {}),
            "min_trajectory_recall",
            DEFAULT_MIN_TRAJECTORY_RECALL,
        )

    precision, recall = _precision_recall(actual, expected)
    alerts = list(state.get("alerts", []))
    if not passed:
        alerts.append(
            _alert(
                "critical",
                "trajectory",
                "Observed tool/action trajectory did not satisfy the expected sequence.",
                "Block release and inspect tool routing.",
            )
        )

    return {
        "trajectory_metrics": {
            "status": "scored",
            "match_mode": mode,
            "actual_actions": actual,
            "expected_actions": expected,
            "missing_actions": missing,
            "extra_actions": extra,
            "order_violations": order_violations,
            "precision": precision,
            "recall": recall,
            "passed": passed,
        },
        "alerts": alerts,
    }


def audit_requirements(state: EvaluationMonitoringState) -> dict[str, Any]:
    thresholds = state.get("thresholds", {})
    output = state.get("actual_output", "")
    metadata = state.get("run_metadata", {})
    findings: list[dict[str, Any]] = []
    alerts = list(state.get("alerts", []))

    for phrase in thresholds.get("forbidden_phrases", []):
        phrase_text = str(phrase)
        if phrase_text and phrase_text.lower() in output.lower():
            finding = {
                "type": "safety",
                "severity": "critical",
                "requirement": "forbidden_phrases",
                "reason": f"Output contains forbidden phrase: {phrase_text}.",
                "passed": False,
            }
            findings.append(finding)
            alerts.append(
                _alert("critical", "safety", finding["reason"], "Escalate for policy review.")
            )

    for key, expected in thresholds.get("required_metadata", {}).items():
        if metadata.get(key) != expected:
            findings.append(
                {
                    "type": "contract",
                    "severity": "warning",
                    "requirement": f"metadata.{key}",
                    "reason": f"Expected metadata {key}={expected!r}.",
                    "passed": False,
                }
            )

    if not findings:
        findings.append(
            {
                "type": "audit",
                "severity": "info",
                "requirement": "configured_requirements",
                "reason": "No configured audit requirement failed.",
                "passed": True,
            }
        )

    return {"audit_findings": findings, "alerts": alerts}


def decide_judge_need(state: EvaluationMonitoringState) -> dict[str, Any]:
    rubric = state.get("rubric")
    needs_judge = isinstance(rubric, dict) and bool(rubric)
    return {"drift_signals": {**state.get("drift_signals", {}), "needs_judge": needs_judge}}


def run_rubric_judge(state: EvaluationMonitoringState) -> dict[str, Any]:
    fake_result = state.get("rubric", {}).get("fake_result") if isinstance(state.get("rubric"), dict) else None
    if isinstance(fake_result, dict):
        return {"judge_result": dict(fake_result)}

    model = get_chat_model()
    prompt = JUDGE_USER_PROMPT.format(
        run_name=state.get("input", "evaluation run"),
        user_input=state.get("agent_run", {}).get("user_input", ""),
        actual_output=state.get("actual_output", ""),
        reference_output=state.get("reference_output") or "",
        rubric=json.dumps(state.get("rubric", {}), sort_keys=True),
        thresholds=json.dumps(state.get("thresholds", {}), sort_keys=True),
    )
    response = model.invoke([SystemMessage(content=JUDGE_SYSTEM_PROMPT), HumanMessage(content=prompt)])
    content = getattr(response, "content", response)
    try:
        parsed = json.loads(str(content))
    except json.JSONDecodeError:
        parsed = {"raw": str(content)}
    return {"judge_result": parsed}


def validate_judge_result(state: EvaluationMonitoringState) -> dict[str, Any]:
    result = state.get("judge_result")
    errors = list(state.get("errors", []))
    if result is None:
        return {"judge_result": None, "errors": errors}
    if not isinstance(result, dict):
        errors.append("Judge result is malformed.")
        return {"judge_result": {"passed": False, "status": "malformed"}, "errors": errors}

    score = _number(result.get("score"))
    if score is None or score < 0 or score > 1:
        errors.append("Judge result must include score between 0 and 1.")
        result = {**result, "passed": False, "status": "malformed"}
    else:
        min_score = _float_threshold(
            state.get("thresholds", {}),
            "min_judge_score",
            DEFAULT_MIN_JUDGE_SCORE,
        )
        result = {
            **result,
            "score": score,
            "min_score": min_score,
            "passed": bool(result.get("passed", score >= min_score)) and score >= min_score,
            "status": "scored",
            "concerns": list(result.get("concerns", [])),
            "recommended_action": str(result.get("recommended_action", "")),
        }
    return {"judge_result": result, "errors": errors}


def detect_regressions_and_anomalies(state: EvaluationMonitoringState) -> dict[str, Any]:
    baseline = state.get("baseline_metrics")
    alerts = list(state.get("alerts", []))
    signals: dict[str, Any] = {k: v for k, v in state.get("drift_signals", {}).items() if k != "needs_judge"}
    if not baseline:
        signals["status"] = "not_applicable"
        signals["reason"] = "No baseline metrics configured."
        return {"drift_signals": signals, "alerts": alerts}

    signals["status"] = "scored"
    current_similarity = state.get("response_metrics", {}).get("similarity")
    baseline_similarity = _number(baseline.get("response_similarity"))
    allowed_drop = _float_threshold(state.get("thresholds", {}), "max_similarity_drop", 0.1)
    if current_similarity is not None and baseline_similarity is not None:
        drop = baseline_similarity - float(current_similarity)
        signals["similarity_drop"] = drop
        if drop > allowed_drop:
            signals["response_drift"] = True
            alerts.append(
                _alert(
                    "warning",
                    "response_similarity",
                    f"Similarity dropped by {drop:.2f} from baseline.",
                    "Compare current prompt/model version with the baseline.",
                )
            )
        else:
            signals["response_drift"] = False

    current_latency = state.get("operational_metrics", {}).get("latency_ms")
    baseline_latency = _number(baseline.get("latency_ms"))
    latency_factor = _float_threshold(state.get("thresholds", {}), "max_latency_regression_factor", 1.5)
    if current_latency is not None and baseline_latency:
        ratio = float(current_latency) / baseline_latency
        signals["latency_ratio"] = ratio
        if ratio > latency_factor:
            signals["latency_regression"] = True
            alerts.append(
                _alert(
                    "warning",
                    "latency_ms",
                    f"Latency is {ratio:.2f}x the baseline.",
                    "Inspect model, tool, or infrastructure latency.",
                )
            )
        else:
            signals["latency_regression"] = False

    return {"drift_signals": signals, "alerts": alerts}


def decide_evaluation_status(state: EvaluationMonitoringState) -> dict[str, Any]:
    if state.get("evaluation_status") == "invalid":
        return {"evaluation_status": "invalid"}
    if any("Unsupported trajectory_match_mode" in error for error in state.get("errors", [])):
        return {"evaluation_status": "invalid"}
    if state.get("errors"):
        return {"evaluation_status": "needs_review"}

    critical_alerts = [
        alert for alert in state.get("alerts", []) if alert.get("severity") == "critical"
    ]
    if critical_alerts:
        return {"evaluation_status": "failed"}

    groups = [
        state.get("response_metrics", {}),
        state.get("operational_metrics", {}),
        state.get("trajectory_metrics", {}),
    ]
    if any(group.get("passed") is False for group in groups):
        return {"evaluation_status": "failed"}
    if any(finding.get("passed") is False for finding in state.get("audit_findings", [])):
        return {"evaluation_status": "failed"}
    if state.get("judge_result") and state.get("judge_result", {}).get("passed") is False:
        return {"evaluation_status": "failed"}
    if state.get("alerts"):
        return {"evaluation_status": "warning"}
    return {"evaluation_status": "passed"}


def finalize_report(state: EvaluationMonitoringState) -> dict[str, Any]:
    status = state.get("evaluation_status", "invalid")
    recommended_action = _recommended_action(state)
    report = {
        "status": status,
        "summary": _summary(status, state),
        "metrics": {
            "response": state.get("response_metrics", {}),
            "operational": state.get("operational_metrics", {}),
            "trajectory": state.get("trajectory_metrics", {}),
        },
        "judge": state.get("judge_result"),
        "audit_findings": state.get("audit_findings", []),
        "drift_signals": state.get("drift_signals", {}),
        "alerts": state.get("alerts", []),
        "errors": state.get("errors", []),
        "recommended_action": recommended_action,
        "evidence": {
            "run_name": state.get("input"),
            "model": state.get("run_metadata", {}).get("model"),
            "agent_version": state.get("run_metadata", {}).get("agent_version"),
        },
    }
    return {"evaluation_report": report, "evaluation_status": status}


def _first_text(*values: Any) -> str:
    for value in values:
        if isinstance(value, str) and value.strip():
            return value.strip()
    return ""


def _normalize_text(text: str | None) -> str:
    return re.sub(r"\s+", " ", str(text or "").strip().lower())


def _normalize_trajectory(value: Any) -> list[dict[str, Any]]:
    if not isinstance(value, list):
        return []
    normalized = []
    for item in value:
        if isinstance(item, dict):
            normalized.append(dict(item))
        elif isinstance(item, str):
            normalized.append({"action": item})
    return normalized


def _action_names(items: list[dict[str, Any]]) -> list[str]:
    names = []
    for item in items:
        name = item.get("action") or item.get("tool") or item.get("name") or item.get("type")
        if name:
            names.append(str(name))
    return names


def _missing_actions(observed: list[str], expected: list[str]) -> list[str]:
    observed_counts = Counter(observed)
    missing = []
    for action, expected_count in Counter(expected).items():
        if observed_counts[action] < expected_count:
            missing.extend([action] * (expected_count - observed_counts[action]))
    return missing


def _is_subsequence(expected: list[str], actual: list[str]) -> bool:
    iterator = iter(actual)
    return all(any(action == candidate for candidate in iterator) for action in expected)


def _precision_recall(actual: list[str], expected: list[str]) -> tuple[float, float]:
    if not actual and not expected:
        return (1.0, 1.0)
    actual_counts = Counter(actual)
    expected_counts = Counter(expected)
    overlap = sum(min(actual_counts[action], expected_counts[action]) for action in expected_counts)
    precision = overlap / len(actual) if actual else 0.0
    recall = overlap / len(expected) if expected else 1.0
    return (precision, recall)


def _keyword_coverage(text: str, keywords: list[str]) -> float:
    if not keywords:
        return 0.0
    normalized = _normalize_text(text)
    matches = sum(1 for keyword in keywords if keyword in normalized)
    return matches / len(keywords)


def _number(value: Any) -> float | None:
    try:
        if value is None or value == "":
            return None
        return float(value)
    except (TypeError, ValueError):
        return None


def _float_threshold(thresholds: dict[str, Any], key: str, default: float) -> float:
    value = _number(thresholds.get(key))
    return default if value is None else value


def _alert(
    severity: str,
    metric: str,
    reason: str,
    recommended_action: str,
) -> dict[str, str]:
    return {
        "severity": severity,
        "metric": metric,
        "reason": reason,
        "recommended_action": recommended_action,
    }


def _recommended_action(state: EvaluationMonitoringState) -> str:
    alerts = state.get("alerts", [])
    if any(alert.get("severity") == "critical" for alert in alerts):
        return "Block release and inspect failed evaluation dimensions."
    if state.get("errors"):
        return "Send the run to human review and fix malformed evaluation inputs."
    if alerts:
        return "Review warnings before promotion."
    return "No follow-up required."


def _summary(status: str, state: EvaluationMonitoringState) -> str:
    if status == "passed":
        return "The recorded run satisfied the configured evaluation contract."
    if status == "invalid":
        return "The evaluation input was invalid and could not be fully scored."
    metric_groups = {
        "response": state.get("response_metrics", {}),
        "operational": state.get("operational_metrics", {}),
        "trajectory": state.get("trajectory_metrics", {}),
    }
    failing = [
        name
        for name, metrics in metric_groups.items()
        if metrics.get("passed") is False
    ]
    if failing:
        return f"The recorded run failed {', '.join(failing)} checks."
    if state.get("alerts"):
        return "The recorded run produced monitoring alerts that require review."
    return "The recorded run needs review before it can be accepted."
