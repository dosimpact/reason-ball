"""
평가 하네스 실행 스크립트.

사용:
    python run.py                  # 전체 golden dataset 평가 후 결과를 results.json 에 저장
    python run.py --limit 3        # 앞 3개만
    python run.py --no-judge       # LLM-as-judge 생략 (rule-based + tool trace 만)

평가 항목
---------
1) Rule-based   — 응답 텍스트에 expected_keywords 가 모두 포함되는가
2) Tool trace   — 호출된 tool 이름 set 이 expected_tool_calls 의 superset 인가
3) LLM-as-judge — Haiku 로 1~5점 평가 (입력/출력/기대 키워드 제공)

요약
----
pass = (rule_based AND tool_trace AND judge_score >= 4)
"""
from __future__ import annotations

import argparse
import json
import os
from datetime import datetime
from pathlib import Path
from typing import Any

from langchain_core.messages import AIMessage, HumanMessage, SystemMessage, ToolMessage

from common.llm import create_llm
from graph import graph

DATASET_PATH = Path(__file__).parent / "golden_dataset.json"
RESULTS_PATH = Path(__file__).parent / "results.json"

JUDGE_SYSTEM = (
    "You are a strict evaluator. Score the assistant response on a 1-5 integer scale "
    "(5 = perfect, 1 = wrong/empty). Consider correctness, presence of expected keywords, "
    "and helpful tone. Reply ONLY in JSON: "
    '{"score": <int 1-5>, "reason": "<short reason>"}'
)


def _extract_text(msg: Any) -> str:
    if isinstance(msg, AIMessage):
        c = msg.content
        if isinstance(c, list):
            return " ".join(b.get("text", "") for b in c if isinstance(b, dict))
        return str(c)
    return ""


def _collect_tool_calls(messages: list[Any]) -> list[str]:
    names: list[str] = []
    for m in messages:
        if isinstance(m, AIMessage) and m.tool_calls:
            for tc in m.tool_calls:
                names.append(tc.get("name") if isinstance(tc, dict) else getattr(tc, "name", ""))
        elif isinstance(m, ToolMessage):
            # ToolMessage 자체는 결과지만 디버깅용으로 표시
            pass
    return [n for n in names if n]


def rule_based_check(answer: str, expected_keywords: list[str]) -> bool:
    if not expected_keywords:
        return True
    low = answer.lower()
    return all(k.lower() in low for k in expected_keywords)


def tool_trace_check(actual: list[str], expected: list[str]) -> bool:
    return set(expected).issubset(set(actual))


def llm_judge(question: str, answer: str, expected_keywords: list[str]) -> dict[str, Any]:
    llm = create_llm("fast")
    user = (
        f"Question: {question}\n"
        f"Expected keywords (must appear): {expected_keywords}\n"
        f"Assistant answer:\n{answer}\n\n"
        "Respond with JSON only."
    )
    resp = llm.invoke([SystemMessage(content=JUDGE_SYSTEM), HumanMessage(content=user)])
    text = resp.content
    if isinstance(text, list):
        text = " ".join(b.get("text", "") for b in text if isinstance(b, dict))
    text = str(text).strip()
    # 가장 단순한 JSON 추출
    try:
        start = text.find("{")
        end = text.rfind("}")
        return json.loads(text[start : end + 1])
    except Exception:
        return {"score": 0, "reason": f"failed to parse judge response: {text[:200]}"}


def evaluate(dataset: list[dict[str, Any]], use_judge: bool = True) -> dict[str, Any]:
    inputs = [{"messages": [HumanMessage(content=row["input"])]} for row in dataset]
    print(f"[eval] running graph.batch on {len(inputs)} cases ...")
    outputs = graph.batch(inputs)

    rows: list[dict[str, Any]] = []
    for row, out in zip(dataset, outputs):
        messages = out["messages"]
        answer = _extract_text(messages[-1])
        actual_tools = _collect_tool_calls(messages)

        rb = rule_based_check(answer, row.get("expected_keywords", []))
        tt = tool_trace_check(actual_tools, row.get("expected_tool_calls", []))

        judge: dict[str, Any] = {"score": None, "reason": "skipped"}
        if use_judge:
            judge = llm_judge(row["input"], answer, row.get("expected_keywords", []))

        score = judge.get("score") or 0
        passed = bool(rb and tt and (score >= 4 if use_judge else True))
        rows.append({
            "id": row["id"],
            "input": row["input"],
            "answer": answer,
            "expected_keywords": row.get("expected_keywords", []),
            "expected_tool_calls": row.get("expected_tool_calls", []),
            "actual_tool_calls": actual_tools,
            "rule_based": rb,
            "tool_trace": tt,
            "judge_score": judge.get("score"),
            "judge_reason": judge.get("reason"),
            "pass": passed,
        })

    summary = {
        "total": len(rows),
        "pass": sum(1 for r in rows if r["pass"]),
        "fail": sum(1 for r in rows if not r["pass"]),
        "rule_based_pass": sum(1 for r in rows if r["rule_based"]),
        "tool_trace_pass": sum(1 for r in rows if r["tool_trace"]),
        "avg_judge_score": (
            round(
                sum((r["judge_score"] or 0) for r in rows) / len(rows),
                3,
            )
            if rows and use_judge
            else None
        ),
        "use_judge": use_judge,
        "timestamp": datetime.utcnow().isoformat() + "Z",
    }
    return {"summary": summary, "rows": rows}


def _print_summary(report: dict[str, Any]) -> None:
    s = report["summary"]
    print("=" * 60)
    print(f"PASS  {s['pass']}/{s['total']}    FAIL {s['fail']}")
    print(f"  rule_based : {s['rule_based_pass']}/{s['total']}")
    print(f"  tool_trace : {s['tool_trace_pass']}/{s['total']}")
    if s.get("avg_judge_score") is not None:
        print(f"  avg_judge  : {s['avg_judge_score']}/5")
    print("=" * 60)
    for r in report["rows"]:
        flag = "PASS" if r["pass"] else "FAIL"
        print(
            f"[{flag}] {r['id']:<10}  rb={r['rule_based']!s:<5} "
            f"tt={r['tool_trace']!s:<5} judge={r['judge_score']}"
        )
        if not r["pass"]:
            print(f"        actual_tools={r['actual_tool_calls']}")
            print(f"        answer={r['answer'][:120]!r}")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--limit", type=int, default=None)
    parser.add_argument("--no-judge", action="store_true")
    parser.add_argument("--out", type=str, default=str(RESULTS_PATH))
    args = parser.parse_args()

    dataset = json.loads(DATASET_PATH.read_text(encoding="utf-8"))
    if args.limit:
        dataset = dataset[: args.limit]

    report = evaluate(dataset, use_judge=not args.no_judge)
    Path(args.out).write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    _print_summary(report)
    print(f"\nresults saved to: {args.out}")
    if os.environ.get("LANGSMITH_API_KEY"):
        print("(LANGSMITH_API_KEY detected — see README §7 for tracing setup)")


if __name__ == "__main__":
    main()
