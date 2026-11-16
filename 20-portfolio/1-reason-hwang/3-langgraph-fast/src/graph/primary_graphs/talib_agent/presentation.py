"""Deterministic selectable inline OpenUI; full arrays remain in graph state."""

import json
import math


def build_program(state):
    dumps = lambda value: json.dumps(
        value, ensure_ascii=False, allow_nan=False, separators=(",", ":")
    )
    results = [
        state.get("results", {}).get(key, {})
        for key in state.get("current_result_ids", [])
    ]
    total = sum(len(r.get("outputs", {})) for r in results)
    per_output = max(1, min(120, 400 // max(total, 1)))
    rows, details, options = [], {}, []
    for result in results:
        identifier = result.get("id", "")
        if result.get("status") == "error":
            rows.append(
                [
                    identifier,
                    result.get("function", ""),
                    "error",
                    result.get("error", "")[:120],
                    "",
                ]
            )
            continue
        for name, output in result.get("outputs", {}).items():
            rows.append(
                [
                    identifier,
                    result["function"],
                    name,
                    output.get("lastBarValue"),
                    output.get("lastValidAt") or "준비 구간",
                ]
            )
            key = f"{identifier}:{name}"
            points = [
                {"date": date, "value": value}
                for date, value in list(
                    zip(result.get("dates", []), output.get("values", []))
                )[-per_output:]
                if isinstance(value, (int, float)) and math.isfinite(value)
            ]
            detail = {
                "points": points,
                "kind": "bar" if output.get("type") == "integer" else "line",
                "caption": f"{identifier} · {name} · {output.get('type')} · shift={output.get('displayShift', 0)} · {result.get('parameters', {})}",
                "warnings": "; ".join(result.get("warnings", []))[:300],
            }
            details[key] = detail
            options.append({"value": key, "label": key})
    if not rows:
        return None
    sources = [data.get("metadata", {}) for data in state.get("datasets", {}).values()]
    provenance = "; ".join(
        f"{m.get('ticker')} {m.get('interval')} {m.get('currency')} · {m.get('display_from')} ~ {m.get('display_to')} · {m.get('count')}봉 · {m.get('source_url')} · {m.get('fetched_at')} · {m.get('history_policy')}"
        for m in sources
    )
    nodes = [
        'Title("TA-Lib 계산 결과", "xl")',
        f"Text({dumps(provenance or '사용자 입력 배열')})",
        'Text("null은 마지막 봉의 준비 구간/입력 결측입니다. 마지막 유효 날짜는 현재 값이 아닙니다. 패턴의 정수 코드는 가격·확률이 아니며 표시 shift는 원래 계산 날짜를 변경하지 않습니다.")',
        f'Table(["ID","함수","출력","마지막 봉 값","마지막 유효 날짜"], {dumps(rows)})',
    ]
    statements = []
    if options:
        statements = [
            f"$selected = {dumps(options[0]['value'])}",
            f"details = {dumps(details)}",
        ]
        nodes.extend(
            [
                f'Select($selected,{dumps(options)},"출력 상세 선택")',
                "Text(details[$selected].caption)",
                "Text(details[$selected].warnings)",
                f'Text("선택한 출력의 마지막 최대 {per_output}봉 중 유효 값만 표시합니다. 결측을 보간하지 않으며 전체 배열은 상태에 보존됩니다. 더 긴 상세는 해당 출력만 재계산해 요청하세요.")',
                'Chart(details[$selected].kind,details[$selected].points,"date",["value"])',
            ]
        )
    statements.append("root = Col([" + ",".join(nodes) + "], 3)")
    program = "\n".join(statements)
    if len(program) > 60000:
        raise ValueError(
            "Too many output details for inline presentation; request smaller batches"
        )
    return program
